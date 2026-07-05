import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { RoundResultStatus } from "@pms/db";

export class RecordRoundResultDto {
  @IsString()
  @MinLength(1)
  roundId!: string;

  @IsEnum(RoundResultStatus)
  status!: RoundResultStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  score?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
