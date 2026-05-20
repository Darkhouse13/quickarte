import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BranchResponseDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String, format: "uuid" })
  businessId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: Boolean })
  isDefault!: boolean;

  @ApiProperty({ type: String })
  status!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  addressLine1!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  addressLine2!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  postcode!: string | null;

  @ApiProperty({ type: String })
  countryCode!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  googlePlaceId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  formattedAddress!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lat!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lng!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  website!: string | null;

  @ApiPropertyOptional({ nullable: true, type: "object", additionalProperties: true })
  socialLinks!: unknown;

  @ApiPropertyOptional({ type: String, nullable: true })
  logo!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cuisineType!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  seatingCapacity!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  currency!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  timezone!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  locale!: string | null;

  @ApiProperty({ type: String, format: "date-time" })
  createdAt!: string;

  @ApiProperty({ type: String, format: "date-time" })
  updatedAt!: string;
}

export class BranchListResponseDto {
  @ApiProperty({ type: () => [BranchResponseDto] })
  branches!: BranchResponseDto[];
}

export class DefaultBranchSummaryDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: Boolean })
  isDefault!: boolean;
}
