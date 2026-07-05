import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { DryRunEligibilityDto } from "./dto/dry-run-eligibility.dto";
import { EvaluateEligibilityDto } from "./dto/evaluate-eligibility.dto";
import { DryRunResult, EligibilityService } from "./eligibility.service";
import { EligibilityResult } from "./eligibility.types";

@Controller("eligibility")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EligibilityController {
  constructor(private readonly eligibilityService: EligibilityService) {}

  @Post("evaluate")
  @RequirePermission("drives.manage")
  evaluate(
    @Body() dto: EvaluateEligibilityDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<EligibilityResult> {
    return this.eligibilityService.evaluate(
      user.tenantId,
      dto.studentId,
      dto.jdId,
    );
  }

  @Post("dry-run")
  @RequirePermission("drives.manage")
  dryRun(
    @Body() dto: DryRunEligibilityDto,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<DryRunResult> {
    return this.eligibilityService.dryRun(
      user.tenantId,
      dto.jdId,
      dto.proposedCriteria,
    );
  }
}
