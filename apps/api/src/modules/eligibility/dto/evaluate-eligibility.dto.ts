import { IsString, MinLength } from "class-validator";

export class EvaluateEligibilityDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsString()
  @MinLength(1)
  jdId!: string;
}
