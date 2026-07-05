import { PolicyRuleStatus, PolicyRuleType } from "@pms/db";
import { IsEnum, IsOptional } from "class-validator";

export class ListPolicyRulesQueryDto {
  @IsOptional()
  @IsEnum(PolicyRuleType)
  type?: PolicyRuleType;

  @IsOptional()
  @IsEnum(PolicyRuleStatus)
  status?: PolicyRuleStatus;
}
