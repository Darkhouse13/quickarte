import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  branchPaymentMethods,
  branches,
  paymentMethodDefinitions,
} from "@quickarte/db-schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { DatabaseService, type TenantedDrizzleClient } from "../database/database.service";
import type {
  BranchPaymentMethodsResponseDto,
  PaymentMethodDefinitionResponseDto,
  PaymentMethodInputDto,
  PaymentMethodsPutBodyDto,
} from "./payment-methods.dto";

@Injectable()
export class PaymentMethodsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async listDefinitions(businessId: string): Promise<PaymentMethodDefinitionResponseDto[]> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      const rows = await tx
        .select()
        .from(paymentMethodDefinitions)
        .orderBy(paymentMethodDefinitions.sortOrder, paymentMethodDefinitions.code);
      return rows.map((row) => ({ ...row }));
    });
  }

  async getBranchMethods(
    businessId: string,
    branchId: string,
  ): Promise<BranchPaymentMethodsResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      const definitions = await tx
        .select()
        .from(paymentMethodDefinitions)
        .orderBy(paymentMethodDefinitions.sortOrder, paymentMethodDefinitions.code);
      const definitionByCode = new Map(definitions.map((row) => [row.code, row]));

      const methods = await tx
        .select()
        .from(branchPaymentMethods)
        .where(and(eq(branchPaymentMethods.businessId, businessId), eq(branchPaymentMethods.branchId, branchId)))
        .orderBy(branchPaymentMethods.sortOrder, branchPaymentMethods.id);

      return {
        branchId,
        methods: methods.map((row) => {
          const definition = row.methodCode ? definitionByCode.get(row.methodCode) : null;
          return {
            id: row.id,
            branchId: row.branchId,
            methodCode: row.methodCode,
            customName: row.customName,
            label: definition?.label ?? row.customName ?? row.methodCode ?? "Custom",
            category: definition?.category ?? "custom",
            enabled: row.enabled,
            cashDrawerAutoOpen: row.cashDrawerAutoOpen,
            sortOrder: row.sortOrder,
            metadata: row.metadata,
          };
        }),
      };
    });
  }

  async replaceBranchMethods(
    businessId: string,
    branchId: string,
    input: PaymentMethodsPutBodyDto,
  ): Promise<BranchPaymentMethodsResponseDto> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      this.validateRows(input.methods);

      const builtinCodes = input.methods
        .map((row) => row.methodCode)
        .filter((code): code is string => typeof code === "string" && code.length > 0);
      if (builtinCodes.length > 0) {
        const definitions = await tx
          .select({ code: paymentMethodDefinitions.code })
          .from(paymentMethodDefinitions)
          .where(inArray(paymentMethodDefinitions.code, builtinCodes));
        const knownCodes = new Set(definitions.map((row) => row.code));
        const unknown = builtinCodes.find((code) => !knownCodes.has(code));
        if (unknown) {
          throw new BadRequestException({
            type: "https://api.quickarte.ma/problems/payment-method-unknown",
            message: `Unknown payment method code: ${unknown}`,
          });
        }
      }

      await tx
        .delete(branchPaymentMethods)
        .where(and(eq(branchPaymentMethods.businessId, businessId), eq(branchPaymentMethods.branchId, branchId)));

      if (input.methods.length > 0) {
        await tx.insert(branchPaymentMethods).values(
          input.methods.map((row) => ({
            businessId,
            branchId,
            methodCode: row.methodCode ?? null,
            customName: row.customName?.trim() || null,
            enabled: row.enabled,
            cashDrawerAutoOpen: row.cashDrawerAutoOpen,
            sortOrder: row.sortOrder,
            metadata: row.metadata ?? null,
          })),
        );
      }
    });

    return this.getBranchMethods(businessId, branchId);
  }

  private validateRows(rows: PaymentMethodInputDto[]): void {
    const seenBuiltinCodes = new Set<string>();
    for (const row of rows) {
      const methodCode = row.methodCode ?? null;
      const customName = row.customName?.trim() ?? null;
      if ((methodCode && customName) || (!methodCode && !customName)) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/payment-method-shape-invalid",
          message: "Payment methods must provide either methodCode or customName, but not both.",
        });
      }
      if (methodCode) {
        if (seenBuiltinCodes.has(methodCode)) {
          throw new BadRequestException({
            type: "https://api.quickarte.ma/problems/payment-method-duplicate",
            message: `Duplicate payment method: ${methodCode}`,
          });
        }
        seenBuiltinCodes.add(methodCode);
      }
    }
  }

  private async assertBranch(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
  ): Promise<void> {
    const [branch] = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.businessId, businessId), eq(branches.id, branchId), isNull(branches.deletedAt)))
      .limit(1);

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }
}
