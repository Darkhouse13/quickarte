import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { branchReceiptSettings, branches } from "@quickarte/db-schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  DatabaseService,
  type TenantedDrizzleClient,
} from "../database/database.service";
import type {
  BilingualMode,
  PaperWidth,
  QrCodeMode,
  ReceiptLineDto,
  ReceiptSettingsPutBodyDto,
  ReceiptSettingsResponseDto,
  ReceiptPreviewResponseDto,
} from "./receipt-settings.dto";
import { BILINGUAL_MODES, PAPER_WIDTHS, QR_CODE_MODES } from "./receipt-settings.dto";

const DEFAULT_SETTINGS: Omit<ReceiptSettingsResponseDto, "branchId"> = {
  logoUrl: null,
  headerLines: [],
  footerLines: [],
  showItemCodes: false,
  showTaxBreakdown: true,
  showServerName: true,
  showTableNumber: true,
  bilingualMode: "fr_only",
  paperWidth: "80mm",
  qrCodeMode: "none",
  qrCodeUrl: null,
  isDefaultPresentation: true,
};

const RECEIPT_SAMPLE_LINES = [
  { code: "CF-ESP", fr: "Espresso", ar: "اسبريسو", qty: "2", total: "30.00" },
  { code: "TJN-CKN", fr: "Tajine poulet", ar: "طاجين دجاج", qty: "1", total: "90.00" },
] as const;

@Injectable()
export class ReceiptSettingsService {
  constructor(
    @Inject(DatabaseService) private readonly databaseService: DatabaseService,
  ) {}

  async getSettings(
    businessId: string,
    branchId: string,
  ): Promise<ReceiptSettingsResponseDto> {
    return this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);

      const [row] = await tx
        .select()
        .from(branchReceiptSettings)
        .where(
          and(
            eq(branchReceiptSettings.businessId, businessId),
            eq(branchReceiptSettings.branchId, branchId),
          ),
        )
        .limit(1);

      if (!row) {
        return { branchId, ...DEFAULT_SETTINGS };
      }

      return this.toResponse(row, false);
    });
  }

  async upsertSettings(
    businessId: string,
    branchId: string,
    input: ReceiptSettingsPutBodyDto,
  ): Promise<ReceiptSettingsResponseDto> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
      this.validateSettings(input);

      await tx
        .insert(branchReceiptSettings)
        .values({
          businessId,
          branchId,
          logoUrl: input.logoUrl?.trim() || null,
          headerLines: this.normalizeLines(input.headerLines),
          footerLines: this.normalizeLines(input.footerLines),
          showItemCodes: input.showItemCodes,
          showTaxBreakdown: input.showTaxBreakdown,
          showServerName: input.showServerName,
          showTableNumber: input.showTableNumber,
          bilingualMode: input.bilingualMode,
          paperWidth: input.paperWidth,
          qrCodeMode: input.qrCodeMode,
          qrCodeUrl: input.qrCodeMode === "custom_url" ? input.qrCodeUrl?.trim() : null,
        })
        .onConflictDoUpdate({
          target: branchReceiptSettings.branchId,
          set: {
            businessId,
            logoUrl: input.logoUrl?.trim() || null,
            headerLines: this.normalizeLines(input.headerLines),
            footerLines: this.normalizeLines(input.footerLines),
            showItemCodes: input.showItemCodes,
            showTaxBreakdown: input.showTaxBreakdown,
            showServerName: input.showServerName,
            showTableNumber: input.showTableNumber,
            bilingualMode: input.bilingualMode,
            paperWidth: input.paperWidth,
            qrCodeMode: input.qrCodeMode,
            qrCodeUrl: input.qrCodeMode === "custom_url" ? input.qrCodeUrl?.trim() : null,
            updatedAt: sql`now()`,
          },
        });
    });

    return this.getSettings(businessId, branchId);
  }

  async preview(
    businessId: string,
    branchId: string,
    input: ReceiptSettingsPutBodyDto,
  ): Promise<ReceiptPreviewResponseDto> {
    await this.databaseService.withTenant(businessId, async (tx) => {
      await this.assertBranch(tx, businessId, branchId);
    });
    this.validateSettings(input);

    const columns = input.paperWidth === "58mm" ? 32 : 48;
    const renderedText = this.renderPreview(input, columns);

    return {
      renderedText,
      paperWidth: input.paperWidth,
      columns,
      sampleTotal: "120.00",
    };
  }

  private validateSettings(input: ReceiptSettingsPutBodyDto): void {
    if (!BILINGUAL_MODES.includes(input.bilingualMode)) {
      throw new BadRequestException({
        type: "https://api.quickarte.ma/problems/receipt-bilingual-mode-invalid",
        message: "Invalid bilingual mode.",
      });
    }
    if (!PAPER_WIDTHS.includes(input.paperWidth)) {
      throw new BadRequestException({
        type: "https://api.quickarte.ma/problems/receipt-paper-width-invalid",
        message: "Invalid paper width.",
      });
    }
    if (!QR_CODE_MODES.includes(input.qrCodeMode)) {
      throw new BadRequestException({
        type: "https://api.quickarte.ma/problems/receipt-qr-code-mode-invalid",
        message: "Invalid QR code mode.",
      });
    }
    this.validateLines(input.headerLines, "headerLines");
    this.validateLines(input.footerLines, "footerLines");
    if (input.qrCodeMode === "custom_url" && !input.qrCodeUrl?.trim()) {
      throw new BadRequestException({
        type: "https://api.quickarte.ma/problems/receipt-custom-qr-url-required",
        message: "qrCodeUrl is required when qrCodeMode is custom_url.",
      });
    }
  }

  private validateLines(lines: ReceiptLineDto[], field: string): void {
    for (const line of lines) {
      if (!line.text?.trim()) {
        throw new BadRequestException({
          type: "https://api.quickarte.ma/problems/receipt-line-invalid",
          message: `${field} contains an empty receipt line.`,
        });
      }
    }
  }

  private normalizeLines(lines: ReceiptLineDto[]): ReceiptLineDto[] {
    return lines.map((line) => ({
      locale: line.locale,
      text: line.text.trim(),
    }));
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

  private toResponse(
    row: typeof branchReceiptSettings.$inferSelect,
    isDefaultPresentation: boolean,
  ): ReceiptSettingsResponseDto {
    return {
      branchId: row.branchId,
      logoUrl: row.logoUrl,
      headerLines: this.coerceLines(row.headerLines),
      footerLines: this.coerceLines(row.footerLines),
      showItemCodes: row.showItemCodes,
      showTaxBreakdown: row.showTaxBreakdown,
      showServerName: row.showServerName,
      showTableNumber: row.showTableNumber,
      bilingualMode: row.bilingualMode as BilingualMode,
      paperWidth: row.paperWidth as PaperWidth,
      qrCodeMode: row.qrCodeMode as QrCodeMode,
      qrCodeUrl: row.qrCodeUrl,
      isDefaultPresentation,
    };
  }

  private coerceLines(value: unknown): ReceiptLineDto[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter(
        (line): line is ReceiptLineDto =>
          line &&
          typeof line === "object" &&
          "locale" in line &&
          "text" in line &&
          typeof (line as ReceiptLineDto).text === "string",
      )
      .map((line) => ({ locale: line.locale, text: line.text }));
  }

  private renderPreview(input: ReceiptSettingsPutBodyDto, columns: number): string {
    const lines: string[] = [];
    lines.push(this.center("MIZAN SAMPLE", columns));
    lines.push(...this.renderLocalizedLines(input.headerLines, input.bilingualMode, columns));
    lines.push("-".repeat(columns));

    if (input.showServerName) {
      lines.push(this.padLabel("Serveur", "Amal", columns));
    }
    if (input.showTableNumber) {
      lines.push(this.padLabel("Table", "12", columns));
    }
    lines.push("-".repeat(columns));

    for (const item of RECEIPT_SAMPLE_LINES) {
      const name = this.localizedItemName(item, input.bilingualMode);
      const label = input.showItemCodes ? `${item.code} ${name}` : name;
      lines.push(this.padLabel(`${item.qty} x ${label}`, `${item.total} MAD`, columns));
    }

    if (input.showTaxBreakdown) {
      lines.push(this.padLabel("TVA 10%", "10.91 MAD", columns));
    }
    lines.push(this.padLabel("TOTAL", "120.00 MAD", columns));
    lines.push("-".repeat(columns));

    lines.push(...this.renderQrLines(input));
    lines.push(...this.renderLocalizedLines(input.footerLines, input.bilingualMode, columns));

    return lines.filter((line) => line.length > 0).join("\n");
  }

  private renderLocalizedLines(
    lines: ReceiptLineDto[],
    mode: BilingualMode,
    columns: number,
  ): string[] {
    const wantedLocales =
      mode === "ar_only" ? ["ar"] : mode === "fr_only" ? ["fr"] : ["fr", "ar", "darija"];
    return lines
      .filter((line) => wantedLocales.includes(line.locale))
      .map((line) => this.center(line.text, columns));
  }

  private localizedItemName(
    item: (typeof RECEIPT_SAMPLE_LINES)[number],
    mode: BilingualMode,
  ): string {
    if (mode === "ar_only") {
      return item.ar;
    }
    if (mode === "stacked") {
      return `${item.fr} / ${item.ar}`;
    }
    if (mode === "side_by_side") {
      return `${item.fr} | ${item.ar}`;
    }
    return item.fr;
  }

  private renderQrLines(input: ReceiptSettingsPutBodyDto): string[] {
    if (input.qrCodeMode === "none") {
      return [];
    }
    if (input.qrCodeMode === "custom_url") {
      return [`QR: ${input.qrCodeUrl}`];
    }
    if (input.qrCodeMode === "fidelity_signup") {
      return ["QR: inscription fidelite"];
    }
    return ["QR: lien social"];
  }

  private center(value: string, columns: number): string {
    if (value.length >= columns) {
      return value.slice(0, columns);
    }
    const left = Math.floor((columns - value.length) / 2);
    return `${" ".repeat(left)}${value}`;
  }

  private padLabel(label: string, value: string, columns: number): string {
    const minGap = 1;
    const availableLabelWidth = Math.max(1, columns - value.length - minGap);
    const renderedLabel = label.length > availableLabelWidth
      ? label.slice(0, availableLabelWidth)
      : label;
    const gap = Math.max(minGap, columns - renderedLabel.length - value.length);
    return `${renderedLabel}${" ".repeat(gap)}${value}`;
  }
}
