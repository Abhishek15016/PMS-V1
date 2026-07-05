import { IsOptional, IsString } from "class-validator";

export class AnalyticsYoyQueryDto {
  @IsString()
  batchId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;
}
