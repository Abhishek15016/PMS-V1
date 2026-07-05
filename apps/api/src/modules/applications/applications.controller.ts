import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Application, RoundResult } from "@pms/db";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { PermissionScope } from "../rbac/permission.types";
import {
  ApplicationsService,
  ApplicationWithRelations,
} from "./applications.service";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { ListApplicationsQueryDto } from "./dto/list-applications.query.dto";
import { RecordRoundResultDto } from "./dto/record-round-result.dto";

@Controller("applications")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Get()
  @RequirePermission("applications.apply")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Query() query: ListApplicationsQueryDto,
  ): Promise<ApplicationWithRelations[]> {
    const scope = req.permissionScope!;
    if (scope === PermissionScope.SELF) {
      return this.applicationsService.findMany(user.tenantId, {
        studentUserId: user.sub,
        driveId: query.driveId,
      });
    }
    // ON_BEHALF: TPO sees every application (they may apply on behalf of
    // any student); Faculty Coordinator is restricted to their own
    // department, mirroring the restriction on their write path.
    if (user.role === "FACULTY_COORD") {
      return this.applicationsService.findMany(user.tenantId, {
        departmentId: user.departmentId ?? "__none__",
        driveId: query.driveId,
      });
    }
    return this.applicationsService.findMany(user.tenantId, {
      driveId: query.driveId,
    });
  }

  @Get(":id")
  @RequirePermission("applications.apply")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<ApplicationWithRelations> {
    const application = await this.applicationsService.findOne(
      user.tenantId,
      id,
    );
    if (!application) throw new NotFoundException();

    const scope = req.permissionScope!;
    if (
      scope === PermissionScope.SELF &&
      application.student.userId !== user.sub
    ) {
      throw new ForbiddenException("Not authorized for this application");
    }
    if (
      user.role === "FACULTY_COORD" &&
      application.student.departmentId !== user.departmentId
    ) {
      throw new ForbiddenException("Not authorized for this application");
    }
    return application;
  }

  @Post()
  @RequirePermission("applications.apply")
  apply(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Application> {
    return this.applicationsService.apply(
      user.tenantId,
      user.role,
      req.permissionScope!,
      user.sub,
      user.departmentId ?? undefined,
      dto,
    );
  }

  @Patch(":id/withdraw")
  @RequirePermission("applications.apply")
  withdraw(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Application> {
    return this.applicationsService.withdraw(
      user.tenantId,
      id,
      user.role,
      req.permissionScope!,
      user.sub,
      user.departmentId ?? undefined,
    );
  }

  @Patch(":id/shortlist")
  @RequirePermission("jd.shortlist")
  shortlist(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Application> {
    return this.applicationsService.shortlist(
      user.tenantId,
      id,
      req.permissionScope!,
      user.companyId ?? undefined,
    );
  }

  @Post(":id/round-results")
  @RequirePermission("drives.manage")
  recordRoundResult(
    @Param("id") id: string,
    @Body() dto: RecordRoundResultDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<RoundResult> {
    // Recording a live result is an operational action, distinct from the
    // "propose a round pipeline while still DRAFT" allowance Faculty
    // Coordinators get elsewhere for this same resource.
    if (req.permissionScope !== PermissionScope.FULL) {
      throw new ForbiddenException(
        "Only TPO/Super Admin can record round results",
      );
    }
    return this.applicationsService.recordRoundResult(user.tenantId, id, dto);
  }
}
