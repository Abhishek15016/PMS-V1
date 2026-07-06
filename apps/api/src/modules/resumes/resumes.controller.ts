import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { Resume } from "@pms/db";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { PermissionScope } from "../rbac/permission.types";
import { ResumesService } from "./resumes.service";

@Controller("resumes")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ResumesController {
  constructor(private readonly resumesService: ResumesService) {}

  @Get("me")
  @RequirePermission("resume.manage")
  getMine(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Resume> {
    if (req.permissionScope !== PermissionScope.SELF) {
      throw new ForbiddenException("Only students have a resume of their own");
    }
    return this.resumesService.getOrCreateForUser(user.tenantId, user.sub);
  }

  @Put("me")
  @RequirePermission("resume.manage")
  updateMine(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Body() body: { content: unknown },
  ): Promise<Resume> {
    if (req.permissionScope !== PermissionScope.SELF) {
      throw new ForbiddenException("Only students have a resume of their own");
    }
    return this.resumesService.updateForUser(
      user.tenantId,
      user.sub,
      body.content,
    );
  }

  @Get("student/:studentId")
  @RequirePermission("resume.manage")
  async getForStudent(
    @Param("studentId") studentId: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Resume> {
    // Staff (VIEW) screening path — SELF-scoped callers use /resumes/me.
    if (req.permissionScope !== PermissionScope.VIEW) {
      throw new ForbiddenException("Use /resumes/me for your own resume");
    }
    const resume = await this.resumesService.findByStudentId(
      user.tenantId,
      studentId,
    );
    if (!resume) throw new NotFoundException("This student has no resume yet");
    return resume;
  }
}
