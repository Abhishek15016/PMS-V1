import { IsObject } from "class-validator";

export class CreatePolicyRuleVersionDto {
  @IsObject()
  definition!: Record<string, unknown>;
}
