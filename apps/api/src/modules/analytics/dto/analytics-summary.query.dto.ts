import { IsOptional, IsString } from "class-validator";

export class AnalyticsSummaryQueryDto {
  @IsOptional()
  @IsString()
  batchId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
