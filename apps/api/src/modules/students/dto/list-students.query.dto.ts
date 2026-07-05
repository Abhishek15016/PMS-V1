import { IsOptional, IsString } from "class-validator";

export class ListStudentsQueryDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}
