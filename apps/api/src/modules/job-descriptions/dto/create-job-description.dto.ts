import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class CreateJobDescriptionDto {
  @IsString()
  @MinLength(1)
  companyId!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsNumber()
  @Type(() => Number)
  ctcLpa!: number;

  @IsArray()
  @IsString({ each: true })
  eligiblePrograms!: string[];

  @IsObject()
  minCriteria!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  bondMonths?: number;
}
