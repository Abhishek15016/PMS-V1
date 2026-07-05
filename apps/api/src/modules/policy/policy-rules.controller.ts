import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { PolicyRule } from "@pms/db";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { CreatePolicyRuleVersionDto } from "./dto/create-policy-rule-version.dto";
import { CreatePolicyRuleDto } from "./dto/create-policy-rule.dto";
import { ListPolicyRulesQueryDto } from "./dto/list-policy-rules.query.dto";
import { PolicyRulesService } from "./policy-rules.service";

@Controller("policy-rules")
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission("policy.rules")
export class PolicyRulesController {
  constructor(private readonly policyRulesService: PolicyRulesService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListPolicyRulesQueryDto,
  ): Promise<PolicyRule[]> {
    return this.policyRulesService.findMany(user.tenantId, query);
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PolicyRule> {
    const rule = await this.policyRulesService.findOne(user.tenantId, id);
    if (!rule) throw new NotFoundException();
    return rule;
  }

  @Post()
  create(
    @Body() dto: CreatePolicyRuleDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PolicyRule> {
    return this.policyRulesService.create(user.tenantId, dto);
  }

  @Post(":id/versions")
  createVersion(
    @Param("id") id: string,
    @Body() dto: CreatePolicyRuleVersionDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PolicyRule> {
    return this.policyRulesService.createVersion(
      user.tenantId,
      id,
      dto.definition,
    );
  }

  @Post(":id/activate")
  activate(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<PolicyRule> {
    return this.policyRulesService.activate(user.tenantId, id);
  }
}
