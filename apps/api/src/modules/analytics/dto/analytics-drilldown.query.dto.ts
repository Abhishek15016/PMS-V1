import { IsEnum, IsOptional, IsString } from "class-validator";

export enum DrilldownMetric {
  ELIGIBLE = "eligible",
  APPLIED = "applied",
  SHORTLISTED = "shortlisted",
  SELECTED = "selected",
  PLACED = "placed",
  UNPLACED = "unplaced",
  ACCEPTED_OFFERS = "accepted-offers",
}

export class AnalyticsDrilldownQueryDto {
  @IsString()
  batchId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsEnum(DrilldownMetric)
  metric!: DrilldownMetric;
}
