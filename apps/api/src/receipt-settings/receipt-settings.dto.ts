import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const RECEIPT_LINE_LOCALES = ["fr", "ar", "darija"] as const;
export const BILINGUAL_MODES = ["fr_only", "ar_only", "stacked", "side_by_side"] as const;
export const PAPER_WIDTHS = ["58mm", "80mm"] as const;
export const QR_CODE_MODES = ["none", "fidelity_signup", "social_link", "custom_url"] as const;

export type ReceiptLineLocale = (typeof RECEIPT_LINE_LOCALES)[number];
export type BilingualMode = (typeof BILINGUAL_MODES)[number];
export type PaperWidth = (typeof PAPER_WIDTHS)[number];
export type QrCodeMode = (typeof QR_CODE_MODES)[number];

@ValidatorConstraint({ name: "nonBlankReceiptLine", async: false })
class NonBlankReceiptLine implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === "string" && value.trim().length > 0;
  }

  defaultMessage(): string {
    return "Receipt lines must contain non-empty text.";
  }
}

@ValidatorConstraint({ name: "customQrUrlRequired", async: false })
class CustomQrUrlRequired implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const input = args.object as ReceiptSettingsPutBodyDto;
    if (input.qrCodeMode !== "custom_url") {
      return true;
    }
    return typeof value === "string" && value.trim().length > 0;
  }

  defaultMessage(): string {
    return "qrCodeUrl is required when qrCodeMode is custom_url.";
  }
}

export class ReceiptLineDto {
  @ApiProperty({ enum: RECEIPT_LINE_LOCALES })
  @IsIn(RECEIPT_LINE_LOCALES)
  locale!: ReceiptLineLocale;

  @ApiProperty({ type: String })
  @Validate(NonBlankReceiptLine)
  text!: string;
}

export class ReceiptSettingsPutBodyDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiProperty({ type: () => [ReceiptLineDto], default: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  headerLines!: ReceiptLineDto[];

  @ApiProperty({ type: () => [ReceiptLineDto], default: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  footerLines!: ReceiptLineDto[];

  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  showItemCodes!: boolean;

  @ApiProperty({ type: Boolean, default: true })
  @IsBoolean()
  showTaxBreakdown!: boolean;

  @ApiProperty({ type: Boolean, default: true })
  @IsBoolean()
  showServerName!: boolean;

  @ApiProperty({ type: Boolean, default: true })
  @IsBoolean()
  showTableNumber!: boolean;

  @ApiProperty({ enum: BILINGUAL_MODES, default: "fr_only" })
  @IsIn(BILINGUAL_MODES)
  bilingualMode!: BilingualMode;

  @ApiProperty({ enum: PAPER_WIDTHS, default: "80mm" })
  @IsIn(PAPER_WIDTHS)
  paperWidth!: PaperWidth;

  @ApiProperty({ enum: QR_CODE_MODES, default: "none" })
  @IsIn(QR_CODE_MODES)
  qrCodeMode!: QrCodeMode;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Validate(CustomQrUrlRequired)
  qrCodeUrl?: string | null;
}

export class ReceiptSettingsResponseDto extends ReceiptSettingsPutBodyDto {
  @ApiProperty({ type: String, format: "uuid" })
  branchId!: string;

  @ApiProperty({ type: Boolean })
  isDefaultPresentation!: boolean;
}

export class ReceiptPreviewResponseDto {
  @ApiProperty({ type: String })
  renderedText!: string;

  @ApiProperty({ enum: PAPER_WIDTHS })
  paperWidth!: PaperWidth;

  @ApiProperty({ type: Number })
  columns!: number;

  @ApiProperty({ type: String, example: "120.00" })
  sampleTotal!: string;
}
