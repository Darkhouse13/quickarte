import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export const PRINTER_CONNECTION_TYPES = [
  "manual",
  "escpos_lan",
  "escpos_usb",
  "webprint",
  "bluetooth",
] as const;

export const PRINTER_ASSIGNMENT_ROLES = [
  "receipt",
  "kitchen",
  "bar",
  "customer_copy",
] as const;

export type PrinterConnectionType = (typeof PRINTER_CONNECTION_TYPES)[number];
export type PrinterAssignmentRole = (typeof PRINTER_ASSIGNMENT_ROLES)[number];

export class PrinterResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  businessId!: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  branchId!: string | null;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ enum: PRINTER_CONNECTION_TYPES })
  connectionType!: PrinterConnectionType;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  model!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: Boolean })
  enabled!: boolean;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  lastSeenAt!: string | null;

  @ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
  lastTestPrintAt!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}

export class PrinterAssignmentResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  branchId!: string;

  @ApiProperty({ type: String, format: "uuid" })
  printerId!: string;

  @ApiProperty({ enum: PRINTER_ASSIGNMENT_ROLES })
  role!: PrinterAssignmentRole;

  @ApiProperty({ type: Number })
  priority!: number;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  fallbackPrinterId!: string | null;

  @ApiProperty({ type: Boolean })
  enabled!: boolean;
}

export class BranchPrintersResponseDto {
  @ApiProperty({ type: () => [PrinterResponseDto] })
  printers!: PrinterResponseDto[];

  @ApiProperty({ type: () => [PrinterAssignmentResponseDto] })
  assignments!: PrinterAssignmentResponseDto[];
}

export class CreatePrinterBodyDto {
  @ApiProperty({ type: String })
  @IsString()
  name!: string;

  @ApiProperty({ enum: PRINTER_CONNECTION_TYPES })
  @IsIn(PRINTER_CONNECTION_TYPES)
  connectionType!: PrinterConnectionType;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  model?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiProperty({ type: Boolean, default: true })
  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePrinterBodyDto {
  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: PRINTER_CONNECTION_TYPES })
  @IsOptional()
  @IsIn(PRINTER_CONNECTION_TYPES)
  connectionType?: PrinterConnectionType;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  model?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class TestPrintResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  jobId!: string;

  @ApiProperty({ type: Boolean })
  queued!: boolean;

  @ApiProperty({ type: String, format: "date-time" })
  lastTestPrintAt!: string;
}

export class DeletePrinterResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;
}

export class PrinterAssignmentInputDto {
  @ApiProperty({ enum: PRINTER_ASSIGNMENT_ROLES })
  @IsIn(PRINTER_ASSIGNMENT_ROLES)
  role!: PrinterAssignmentRole;

  @ApiProperty({ type: String, format: "uuid" })
  @IsUUID()
  printerId!: string;

  @ApiPropertyOptional({ type: String, format: "uuid", nullable: true })
  @ValidateIf((input: PrinterAssignmentInputDto) => input.fallbackPrinterId !== null)
  @IsUUID()
  fallbackPrinterId?: string | null;

  @ApiProperty({ type: Number, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority!: number;

  @ApiProperty({ type: Boolean, default: true })
  @IsBoolean()
  enabled!: boolean;
}

export class ReplacePrinterAssignmentsBodyDto {
  @ApiProperty({ type: () => [PrinterAssignmentInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrinterAssignmentInputDto)
  assignments!: PrinterAssignmentInputDto[];
}
