import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export const TAX_APPLICATION_LEVELS = ["item", "category"] as const;
export const PRICE_DISPLAY_MODES = ["ttc", "ht_plus_tva"] as const;

export type TaxApplicationLevel = (typeof TAX_APPLICATION_LEVELS)[number];
export type PriceDisplayMode = (typeof PRICE_DISPLAY_MODES)[number];

@ValidatorConstraint({ name: "serviceChargeRateRule", async: false })
class ServiceChargeRateRule implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const input = args.object as BranchTaxConfigPutBodyDto;
    if (value === null || value === undefined) {
      return input.serviceChargeEnabled === false;
    }
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
  }

  defaultMessage(): string {
    return "serviceChargeRate is required and must be between 0 and 100 when serviceChargeEnabled is true.";
  }
}

export class BranchTaxConfigPutBodyDto {
  @ApiProperty({ type: String, example: "ma_tva_10" })
  @IsString()
  defaultTaxRateId!: string;

  @ApiProperty({ enum: TAX_APPLICATION_LEVELS, default: "category" })
  @IsIn(TAX_APPLICATION_LEVELS)
  taxApplicationLevel!: TaxApplicationLevel;

  @ApiProperty({ enum: PRICE_DISPLAY_MODES, default: "ttc" })
  @IsIn(PRICE_DISPLAY_MODES)
  priceDisplayMode!: PriceDisplayMode;

  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  serviceChargeEnabled!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 0, maximum: 100 })
  @Type(() => Number)
  @Validate(ServiceChargeRateRule)
  serviceChargeRate?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  serviceChargeLabel?: string | null;
}

export class TaxRateResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String, example: "MA" })
  countryCode!: string;

  @ApiProperty({ type: String, example: "TVA 10% (restauration)" })
  label!: string;

  @ApiProperty({ type: Number, example: 10 })
  rate!: number;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;
}

export class TaxRatesResponseDto {
  @ApiProperty({ type: () => [TaxRateResponseDto] })
  rates!: TaxRateResponseDto[];
}

export class BranchTaxConfigResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  branchId!: string;

  @ApiProperty({ type: String })
  defaultTaxRateId!: string;

  @ApiProperty({ enum: TAX_APPLICATION_LEVELS })
  taxApplicationLevel!: TaxApplicationLevel;

  @ApiProperty({ enum: PRICE_DISPLAY_MODES })
  priceDisplayMode!: PriceDisplayMode;

  @ApiProperty({ type: Boolean })
  serviceChargeEnabled!: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true })
  serviceChargeRate!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  serviceChargeLabel!: string | null;

  @ApiProperty({ type: Boolean })
  isDefaultPresentation!: boolean;
}
