import { DriveStatus } from "@pms/db";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateDriveDto {
  @IsString()
  @MinLength(1)
  jdId!: string;

  @IsOptional()
  @IsEnum(DriveStatus)
  status?: DriveStatus;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
