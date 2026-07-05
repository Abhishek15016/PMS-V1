import { IsOptional, IsString } from "class-validator";

export class ListApplicationsQueryDto {
  @IsOptional()
  @IsString()
  driveId?: string;
}
