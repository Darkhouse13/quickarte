import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DefaultBranchSummaryDto } from "../branches/branch.dto";

export class BusinessSetupBusinessDto {
  @ApiProperty({ type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  slug!: string;

  @ApiProperty({ type: String, enum: ["restaurant", "cafe", "autre"] })
  type!: "restaurant" | "cafe" | "autre";

  @ApiPropertyOptional({ type: String, nullable: true })
  city!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  address!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  logo!: string | null;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  secondaryCurrency!: string | null;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: String })
  locale!: string;
}

export class BusinessLegalProfileDto {
  @ApiProperty({ type: String })
  legalName!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  iceNumber!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  rcNumber!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  ifNumber!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  patenteNumber!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  cnssNumber!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  legalAddress!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  legalCity!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  legalPostcode!: string | null;
}

export class BusinessSetupResponseDto {
  @ApiProperty({ type: () => BusinessSetupBusinessDto })
  business!: BusinessSetupBusinessDto;

  @ApiPropertyOptional({ type: () => BusinessLegalProfileDto, nullable: true })
  legalProfile!: BusinessLegalProfileDto | null;

  @ApiPropertyOptional({ type: () => DefaultBranchSummaryDto, nullable: true })
  defaultBranch!: DefaultBranchSummaryDto | null;
}
