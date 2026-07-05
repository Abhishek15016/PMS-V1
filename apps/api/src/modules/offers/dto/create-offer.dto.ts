import { Type } from "class-transformer";
import { IsNumber, IsPositive, IsString, MinLength } from "class-validator";

export class CreateOfferDto {
  @IsString()
  @MinLength(1)
  applicationId!: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  ctcLpa!: number;
}
