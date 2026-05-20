import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from "class-validator";
import { Type } from "class-transformer";

@ValidatorConstraint({ name: "paymentMethodBuiltinOrCustom", async: false })
class PaymentMethodBuiltinOrCustom implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const value = args.object as PaymentMethodInputDto;
    const hasBuiltin = typeof value.methodCode === "string" && value.methodCode.length > 0;
    const hasCustom = typeof value.customName === "string" && value.customName.trim().length > 0;
    return hasBuiltin !== hasCustom;
  }

  defaultMessage(): string {
    return "Payment methods must provide either methodCode or customName, but not both.";
  }
}

export class PaymentMethodInputDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  methodCode?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  customName?: string | null;

  @ApiProperty({ type: Boolean, default: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  cashDrawerAutoOpen!: boolean;

  @ApiProperty({ type: Number, default: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true, type: "object", additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;

  @Validate(PaymentMethodBuiltinOrCustom)
  private readonly _builtinOrCustom?: this;
}

export class PaymentMethodsPutBodyDto {
  @ApiProperty({ type: () => [PaymentMethodInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodInputDto)
  methods!: PaymentMethodInputDto[];
}

export class PaymentMethodDefinitionResponseDto {
  @ApiProperty({ type: String })
  code!: string;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  category!: string;

  @ApiProperty({ type: Boolean })
  isBuiltin!: boolean;

  @ApiProperty({ type: Number })
  sortOrder!: number;
}

export class PaymentMethodDefinitionsResponseDto {
  @ApiProperty({ type: () => [PaymentMethodDefinitionResponseDto] })
  definitions!: PaymentMethodDefinitionResponseDto[];
}

export class BranchPaymentMethodResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  branchId!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  methodCode!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  customName!: string | null;

  @ApiProperty({ type: String })
  label!: string;

  @ApiProperty({ type: String })
  category!: string;

  @ApiProperty({ type: Boolean })
  enabled!: boolean;

  @ApiProperty({ type: Boolean })
  cashDrawerAutoOpen!: boolean;

  @ApiProperty({ type: Number })
  sortOrder!: number;

  @ApiPropertyOptional({ nullable: true, type: "object", additionalProperties: true })
  metadata!: unknown;
}

export class BranchPaymentMethodsResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  branchId!: string;

  @ApiProperty({ type: () => [BranchPaymentMethodResponseDto] })
  methods!: BranchPaymentMethodResponseDto[];
}
