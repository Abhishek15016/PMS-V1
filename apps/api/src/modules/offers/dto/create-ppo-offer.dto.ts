import { Type } from "class-transformer";
import { IsNumber, IsPositive, IsString, MinLength } from "class-validator";

export class CreatePpoOfferDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsString()
  @MinLength(1)
  sourceInternshipId!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  ctcLpa!: number;
}
