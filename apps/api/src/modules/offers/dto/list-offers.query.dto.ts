import { IsOptional, IsString } from "class-validator";

export class ListOffersQueryDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
