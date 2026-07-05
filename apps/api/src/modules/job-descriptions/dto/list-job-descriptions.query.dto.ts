import { IsOptional, IsString } from "class-validator";

export class ListJobDescriptionsQueryDto {
  @IsOptional()
  @IsString()
  companyId?: string;
}
