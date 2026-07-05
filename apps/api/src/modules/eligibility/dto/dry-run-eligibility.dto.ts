import { IsObject, IsString, MinLength } from "class-validator";

export class DryRunEligibilityDto {
  @IsString()
  @MinLength(1)
  jdId!: string;

  @IsObject()
  proposedCriteria!: Record<string, unknown>;
}
