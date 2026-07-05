import { DriveStatus } from "@pms/db";
import { IsEnum } from "class-validator";

export class UpdateDriveStatusDto {
  @IsEnum(DriveStatus)
  status!: DriveStatus;
}
