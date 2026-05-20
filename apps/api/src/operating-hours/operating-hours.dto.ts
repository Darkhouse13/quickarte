import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from "class-validator";
import { Type } from "class-transformer";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

@ValidatorConstraint({ name: "operatingHourTimeRule", async: false })
class OperatingHourTimeRule implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const value = args.object as OperatingHourInputDto;
    if (value.isClosed) {
      return value.opensAt == null && value.closesAt == null;
    }
    return TIME_PATTERN.test(value.opensAt ?? "") && TIME_PATTERN.test(value.closesAt ?? "");
  }

  defaultMessage(): string {
    return "Closed days must not include times; open days require opensAt and closesAt in HH:mm format.";
  }
}

export class OperatingHourInputDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiPropertyOptional({ type: String, nullable: true, pattern: TIME_PATTERN.source })
  @Validate(OperatingHourTimeRule)
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  opensAt?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, pattern: TIME_PATTERN.source })
  @IsOptional()
  @IsString()
  @Matches(TIME_PATTERN)
  closesAt?: string | null;

  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  isClosed!: boolean;

  @ApiProperty({ type: Number, default: 0 })
  @IsInt()
  @Min(0)
  position!: number;
}

export class ClosedDayInputDto {
  @ApiProperty({ type: String, format: "date" })
  @IsISO8601({ strict: true })
  date!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  reason?: string | null;
}

export class OperatingHoursPutBodyDto {
  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  ramadanModeEnabled!: boolean;

  @ApiProperty({ type: () => [OperatingHourInputDto] })
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => OperatingHourInputDto)
  normal!: OperatingHourInputDto[];

  @ApiProperty({ type: () => [OperatingHourInputDto] })
  @IsArray()
  @ArrayMaxSize(42)
  @ValidateNested({ each: true })
  @Type(() => OperatingHourInputDto)
  ramadan!: OperatingHourInputDto[];

  @ApiProperty({ type: () => [ClosedDayInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClosedDayInputDto)
  closedDays!: ClosedDayInputDto[];
}

export class OperatingHourResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, enum: ["normal", "ramadan"] })
  @IsIn(["normal", "ramadan"])
  scheduleType!: "normal" | "ramadan";

  @ApiProperty({ type: Number, minimum: 0, maximum: 6 })
  dayOfWeek!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  opensAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  closesAt!: string | null;

  @ApiProperty({ type: Boolean })
  isClosed!: boolean;

  @ApiProperty({ type: Number })
  position!: number;
}

export class ClosedDayResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "date" })
  date!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  reason!: string | null;
}

export class OperatingHoursResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  branchId!: string;

  @ApiProperty({ type: Boolean })
  ramadanModeEnabled!: boolean;

  @ApiProperty({ type: () => [OperatingHourResponseDto] })
  normal!: OperatingHourResponseDto[];

  @ApiProperty({ type: () => [OperatingHourResponseDto] })
  ramadan!: OperatingHourResponseDto[];

  @ApiProperty({ type: () => [ClosedDayResponseDto] })
  closedDays!: ClosedDayResponseDto[];
}
