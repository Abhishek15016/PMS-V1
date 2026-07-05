import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JobDescription } from "@pms/db";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { PermissionScope } from "../../modules/rbac/permission.types";
import { CreateJobDescriptionDto } from "./dto/create-job-description.dto";
import { ListJobDescriptionsQueryDto } from "./dto/list-job-descriptions.query.dto";
import { JobDescriptionsService } from "./job-descriptions.service";

@Controller("job-descriptions")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class JobDescriptionsController {
  constructor(
    private readonly jobDescriptionsService: JobDescriptionsService,
  ) {}

  @Get()
  @RequirePermission("jd.shortlist")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Query() query: ListJobDescriptionsQueryDto,
  ): Promise<JobDescription[]> {
    const scope = req.permissionScope!;
    if (scope === PermissionScope.SELF) {
      return this.jobDescriptionsService.findMany(user.tenantId, {
        companyId: user.companyId ?? "__none__",
      });
    }
    return this.jobDescriptionsService.findMany(user.tenantId, {
      companyId: query.companyId,
    });
  }

  @Get(":id")
  @RequirePermission("jd.shortlist")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<JobDescription> {
    const jd = await this.jobDescriptionsService.findOne(user.tenantId, id);
    if (!jd) throw new NotFoundException();

    if (
      req.permissionScope === PermissionScope.SELF &&
      jd.companyId !== user.companyId
    ) {
      throw new ForbiddenException("Not authorized for this job description");
    }
    return jd;
  }

  @Post()
  @RequirePermission("jd.shortlist")
  create(
    @Body() dto: CreateJobDescriptionDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<JobDescription> {
    const scope = req.permissionScope!;
    if (scope === PermissionScope.SELF && dto.companyId !== user.companyId) {
      throw new ForbiddenException(
        "Recruiters can only post JDs for their own company",
      );
    }
    return this.jobDescriptionsService.create(user.tenantId, dto);
  }
}
