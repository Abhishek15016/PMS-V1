import { PolicyRuleType } from "@pms/db";
import { IsEnum, IsObject, IsString, MinLength } from "class-validator";

export class CreatePolicyRuleDto {
  @IsEnum(PolicyRuleType)
  type!: PolicyRuleType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsObject()
  definition!: Record<string, unknown>;
}
