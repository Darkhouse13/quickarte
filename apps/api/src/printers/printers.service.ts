import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  branches,
  printJobs,
  printerAssignments,
  printers,
} from "@quickarte/db-schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import {
  DatabaseService,
  type TenantedDrizzleClient,
} from "../database/database.service";
import type {
  BranchPrintersResponseDto,
  CreatePrinterBodyDto,
  PrinterAssignmentInputDto,
  PrinterAssignmentResponseDto,
  PrinterResponseDto,
  ReplacePrinterAssignmentsBodyDto,
  TestPrintResponseDto,
  UpdatePrinterBodyDto,
} from "./printers.dto";

@Injectable()
export class PrintersService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async listBranchPrinters(
    businessId: string,
    branchId: string,
  ): Promise<BranchPrintersResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);

      const [printerRows, assignmentRows] = await Promise.all([
        tx
          .select()
          .from(printers)
          .where(
            and(
              eq(printers.businessId, businessId),
              eq(printers.branchId, branchId),
              isNull(printers.deletedAt),
            ),
          )
          .orderBy(asc(printers.createdAt), asc(printers.name)),
        tx
          .select()
          .from(printerAssignments)
          .where(
            and(
              eq(printerAssignments.businessId, businessId),
              eq(printerAssignments.branchId, branchId),
            ),
          )
          .orderBy(asc(printerAssignments.role), asc(printerAssignments.priority)),
      ]);

      return {
        printers: printerRows.map((row) => this.toPrinterResponse(row)),
        assignments: assignmentRows.map((row) => this.toAssignmentResponse(row)),
      };
    });
  }

  async createPrinter(
    businessId: string,
    branchId: string,
    input: CreatePrinterBodyDto,
  ): Promise<PrinterResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException("Printer name is required");
      }

      const [created] = await tx
        .insert(printers)
        .values({
          businessId,
          branchId,
          name,
          // Legacy Quickarte station is retained for old print flows. Module 2
          // branch routing is modeled by printer_assignments.
          station: "counter",
          connectionType: input.connectionType,
          address: emptyToNull(input.address),
          model: emptyToNull(input.model),
          notes: emptyToNull(input.notes),
          webprintToken:
            input.connectionType === "webprint" ? generateWebprintToken() : null,
          enabled: input.enabled,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!created) {
        throw new BadRequestException("Printer could not be created");
      }
      return this.toPrinterResponse(created);
    });
  }

  async updatePrinter(
    businessId: string,
    branchId: string,
    printerId: string,
    input: UpdatePrinterBodyDto,
  ): Promise<PrinterResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      const existing = await this.findPrinter(tx, businessId, branchId, printerId);

      const nextConnectionType = input.connectionType ?? existing.connectionType;
      const [updated] = await tx
        .update(printers)
        .set({
          name:
            input.name === undefined
              ? existing.name
              : requireNonEmpty(input.name, "Printer name is required"),
          connectionType: nextConnectionType,
          address:
            input.address === undefined ? existing.address : emptyToNull(input.address),
          model: input.model === undefined ? existing.model : emptyToNull(input.model),
          notes: input.notes === undefined ? existing.notes : emptyToNull(input.notes),
          enabled: input.enabled ?? existing.enabled,
          webprintToken:
            nextConnectionType === "webprint"
              ? existing.webprintToken ?? generateWebprintToken()
              : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(printers.id, printerId),
            eq(printers.businessId, businessId),
            eq(printers.branchId, branchId),
            isNull(printers.deletedAt),
          ),
        )
        .returning();

      if (!updated) {
        throw new NotFoundException("Printer not found");
      }
      return this.toPrinterResponse(updated);
    });
  }

  async deletePrinter(
    businessId: string,
    branchId: string,
    printerId: string,
  ): Promise<{ id: string }> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      await this.findPrinter(tx, businessId, branchId, printerId);

      await tx
        .delete(printerAssignments)
        .where(
          and(
            eq(printerAssignments.businessId, businessId),
            eq(printerAssignments.branchId, branchId),
            eq(printerAssignments.printerId, printerId),
          ),
        );

      const [updated] = await tx
        .update(printers)
        .set({ enabled: false, deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(printers.id, printerId),
            eq(printers.businessId, businessId),
            eq(printers.branchId, branchId),
            isNull(printers.deletedAt),
          ),
        )
        .returning({ id: printers.id });

      if (!updated) {
        throw new NotFoundException("Printer not found");
      }
      return updated;
    });
  }

  async enqueueTestPrint(
    businessId: string,
    branchId: string,
    printerId: string,
  ): Promise<TestPrintResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      const printer = await this.findPrinter(tx, businessId, branchId, printerId);
      if (!printer.enabled) {
        throw new BadRequestException("Printer is disabled");
      }

      const now = new Date();
      const [job] = await tx
        .insert(printJobs)
        .values({
          orderId: null,
          printerId: printer.id,
          status: printer.connectionType === "manual" ? "manual" : "pending",
          attempts: 0,
          payloadText: formatTestPrintPayload(now),
          printedAt: printer.connectionType === "manual" ? now : null,
        })
        .returning({ id: printJobs.id });

      if (!job) {
        throw new BadRequestException("Test print could not be queued");
      }

      await tx
        .update(printers)
        .set({ lastTestPrintAt: now, updatedAt: now })
        .where(
          and(
            eq(printers.id, printer.id),
            eq(printers.businessId, businessId),
            eq(printers.branchId, branchId),
          ),
        );

      return {
        jobId: job.id,
        queued: true,
        lastTestPrintAt: now.toISOString(),
      };
    });
  }

  async replaceAssignments(
    businessId: string,
    branchId: string,
    input: ReplacePrinterAssignmentsBodyDto,
  ): Promise<BranchPrintersResponseDto> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      await this.validateAssignments(tx, businessId, branchId, input.assignments);

      await tx
        .delete(printerAssignments)
        .where(
          and(
            eq(printerAssignments.businessId, businessId),
            eq(printerAssignments.branchId, branchId),
          ),
        );

      if (input.assignments.length > 0) {
        await tx.insert(printerAssignments).values(
          input.assignments.map((assignment) => ({
            businessId,
            branchId,
            printerId: assignment.printerId,
            role: assignment.role,
            priority: assignment.priority,
            fallbackPrinterId: assignment.fallbackPrinterId ?? null,
            enabled: assignment.enabled,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }
    });

    return this.listBranchPrinters(businessId, branchId);
  }

  private async assertBranch(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
  ): Promise<void> {
    const [branch] = await tx
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.businessId, businessId),
          eq(branches.id, branchId),
          isNull(branches.deletedAt),
        ),
      )
      .limit(1);

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
  }

  private async findPrinter(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
    printerId: string,
  ): Promise<typeof printers.$inferSelect> {
    const [printer] = await tx
      .select()
      .from(printers)
      .where(
        and(
          eq(printers.id, printerId),
          eq(printers.businessId, businessId),
          eq(printers.branchId, branchId),
          isNull(printers.deletedAt),
        ),
      )
      .limit(1);

    if (!printer) {
      throw new NotFoundException("Printer not found");
    }
    return printer;
  }

  private async validateAssignments(
    tx: TenantedDrizzleClient,
    businessId: string,
    branchId: string,
    assignments: PrinterAssignmentInputDto[],
  ): Promise<void> {
    const duplicateKeys = new Set<string>();
    for (const assignment of assignments) {
      if (assignment.fallbackPrinterId === assignment.printerId) {
        throw new BadRequestException("Fallback printer cannot be the same printer");
      }
      const key = `${assignment.role}:${assignment.printerId}`;
      if (duplicateKeys.has(key)) {
        throw new BadRequestException("Duplicate printer assignment");
      }
      duplicateKeys.add(key);
    }

    const printerIds = Array.from(
      new Set(
        assignments.flatMap((assignment) => [
          assignment.printerId,
          assignment.fallbackPrinterId,
        ]).filter((id): id is string => Boolean(id)),
      ),
    );
    if (printerIds.length === 0) {
      return;
    }

    const rows = await tx
      .select({ id: printers.id })
      .from(printers)
      .where(
        and(
          eq(printers.businessId, businessId),
          eq(printers.branchId, branchId),
          isNull(printers.deletedAt),
          inArray(printers.id, printerIds),
        ),
      );
    const found = new Set(rows.map((row) => row.id));
    const missing = printerIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestException("Assignment references an unknown printer");
    }
  }

  private toPrinterResponse(row: typeof printers.$inferSelect): PrinterResponseDto {
    return {
      id: row.id,
      businessId: row.businessId,
      branchId: row.branchId,
      name: row.name,
      connectionType: row.connectionType as PrinterResponseDto["connectionType"],
      address: row.address,
      model: row.model,
      notes: row.notes,
      enabled: row.enabled,
      lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
      lastTestPrintAt: row.lastTestPrintAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAssignmentResponse(
    row: typeof printerAssignments.$inferSelect,
  ): PrinterAssignmentResponseDto {
    return {
      id: row.id,
      branchId: row.branchId,
      printerId: row.printerId,
      role: row.role as PrinterAssignmentResponseDto["role"],
      priority: row.priority,
      fallbackPrinterId: row.fallbackPrinterId,
      enabled: row.enabled,
    };
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireNonEmpty(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new BadRequestException(message);
  }
  return trimmed;
}

function generateWebprintToken(): string {
  return randomBytes(32).toString("base64url");
}

function formatTestPrintPayload(now = new Date()): string {
  return [
    "=== TEST D'IMPRESSION ===",
    "Quickarte",
    formatFrenchDateTime(now),
    "Si vous lisez ceci, votre",
    "imprimante fonctionne.",
  ].join("\n");
}

function formatFrenchDateTime(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}
