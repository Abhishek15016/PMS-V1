import { RoundType } from "@pms/db";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateRoundDto {
  @IsEnum(RoundType)
  type!: RoundType;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  position!: number;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  cutoff?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
