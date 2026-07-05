import { IsOptional, IsString } from "class-validator";

export class ListDrivesQueryDto {
  @IsOptional()
  @IsString()
  jdId?: string;
}
