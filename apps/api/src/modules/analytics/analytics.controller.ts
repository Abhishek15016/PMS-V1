import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { PermissionScope } from "../rbac/permission.types";
import { AnalyticsQueryService } from "./analytics-query.service";
import { AnalyticsDrilldownQueryDto } from "./dto/analytics-drilldown.query.dto";
import { AnalyticsSummaryQueryDto } from "./dto/analytics-summary.query.dto";
import { AnalyticsYoyQueryDto } from "./dto/analytics-yoy.query.dto";
import { RecruiterAnalyticsService } from "./recruiter-analytics.service";

@Controller("analytics")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsQueryService: AnalyticsQueryService,
    private readonly recruiterAnalyticsService: RecruiterAnalyticsService,
  ) {}

  /**
   * Sets ETag from computedAt and short-circuits to 304 on a matching
   * If-None-Match. Takes full manual control of `res` (not
   * `@Res({ passthrough: true })`) deliberately: passthrough mode still
   * lets Nest auto-send the handler's return value afterward, which
   * double-sends ("Cannot set headers after they are sent") once this
   * already called `res.end()` for the 304 case. With manual `@Res()`,
   * every path — 304 or 200 — must call res.json()/res.end() itself.
   */
  private sendWithEtag(
    req: Request,
    res: Response,
    computedAt: string,
    body: unknown,
  ): void {
    const etag = `"${computedAt}"`;
    res.setHeader("ETag", etag);
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }
    res.json(body);
  }

  @Get("summary")
  @RequirePermission("analytics.view")
  async getSummary(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: AnalyticsSummaryQueryDto,
  ): Promise<void> {
    const scope = req.permissionScope!;
    if (user.role === "RECRUITER") {
      if (!user.companyId) throw new ForbiddenException("No company assigned");
      const recruiterSummary = await this.recruiterAnalyticsService.getSummary(
        user.tenantId,
        user.companyId,
      );
      res.json(recruiterSummary);
      return;
    }

    const { resolved, shape } = await this.analyticsQueryService.resolveScope(
      user.tenantId,
      scope,
      user.sub,
      user.departmentId ?? undefined,
      query,
    );
    const summary = await this.analyticsQueryService.getSummary(
      user.tenantId,
      resolved,
      shape,
    );
    this.sendWithEtag(req, res, summary.computedAt, summary);
  }

  @Get("yoy")
  @RequirePermission("analytics.view")
  async getYoy(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: AnalyticsYoyQueryDto,
  ): Promise<void> {
    if (user.role === "RECRUITER") {
      throw new ForbiddenException(
        "Year-over-year comparison is not available for recruiters",
      );
    }
    const scope = req.permissionScope!;
    const { resolved, shape } = await this.analyticsQueryService.resolveScope(
      user.tenantId,
      scope,
      user.sub,
      user.departmentId ?? undefined,
      query,
    );
    const yoy = await this.analyticsQueryService.getYoy(
      user.tenantId,
      resolved,
      shape,
    );
    if (yoy.current) {
      this.sendWithEtag(req, res, yoy.current.computedAt, yoy);
    } else {
      res.json(yoy);
    }
  }

  @Get("drilldown")
  @RequirePermission("analytics.view")
  async getDrilldown(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Query() query: AnalyticsDrilldownQueryDto,
  ) {
    const scope = req.permissionScope!;
    // Drilldown exposes peer-level rows (names, placement status of other
    // students) — SELF-scoped roles (STUDENT, RECRUITER) get the aggregate
    // summary only, never a roster of other people.
    if (scope === PermissionScope.SELF) {
      throw new ForbiddenException("Drilldown is not available for this role");
    }
    const { resolved } = await this.analyticsQueryService.resolveScope(
      user.tenantId,
      scope,
      user.sub,
      user.departmentId ?? undefined,
      query,
    );
    return this.analyticsQueryService.getDrilldown(
      user.tenantId,
      resolved,
      query.metric,
    );
  }

  @Get("filter-options")
  @RequirePermission("analytics.view")
  getFilterOptions(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ) {
    if (req.permissionScope === PermissionScope.SELF) {
      throw new ForbiddenException(
        "Filter options are not available for this role",
      );
    }
    return this.analyticsQueryService.getFilterOptions(user.tenantId);
  }

  @Get("upcoming-drives")
  @RequirePermission("analytics.view")
  getUpcomingDrives(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ) {
    if (req.permissionScope === PermissionScope.SELF) {
      throw new ForbiddenException(
        "Upcoming drives are not available for this role",
      );
    }
    return this.analyticsQueryService.getUpcomingDrives(user.tenantId);
  }
}
