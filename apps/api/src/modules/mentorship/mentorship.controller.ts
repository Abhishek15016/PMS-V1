import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { Student } from "@pms/db";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { PermissionScope } from "../rbac/permission.types";
import {
  CreateReplyDto,
  CreateThreadDto,
  UpdateMentorProfileDto,
} from "./dto/mentorship.dtos";
import { MentorshipService } from "./mentorship.service";

/**
 * Mentor Connect: a tenant-wide, attributable Q&A board between placed and
 * unplaced students. Reads are open to every scope the registry admits
 * (students, staff); writes are SELF (own posts) — VIEW (Faculty Coord)
 * is read-only.
 */
@Controller("mentorship")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MentorshipController {
  constructor(private readonly mentorshipService: MentorshipService) {}

  @Get("mentors")
  @RequirePermission("mentorship.community")
  listMentors(@CurrentUser() user: AccessTokenPayload) {
    return this.mentorshipService.listMentors(user.tenantId);
  }

  @Patch("mentor-profile")
  @RequirePermission("mentorship.community")
  updateMentorProfile(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Body() dto: UpdateMentorProfileDto,
  ): Promise<Student> {
    if (req.permissionScope !== PermissionScope.SELF) {
      throw new ForbiddenException("Only students hold a mentor profile");
    }
    return this.mentorshipService.updateMentorProfile(
      user.tenantId,
      user.sub,
      dto,
    );
  }

  @Get("threads")
  @RequirePermission("mentorship.community")
  listThreads(@CurrentUser() user: AccessTokenPayload) {
    return this.mentorshipService.listThreads(user.tenantId);
  }

  @Get("threads/:id")
  @RequirePermission("mentorship.community")
  getThread(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return this.mentorshipService.getThread(user.tenantId, id);
  }

  @Post("threads")
  @RequirePermission("mentorship.community")
  createThread(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Body() dto: CreateThreadDto,
  ) {
    if (req.permissionScope === PermissionScope.VIEW) {
      throw new ForbiddenException("This role can only read the board");
    }
    return this.mentorshipService.createThread(user.tenantId, user.sub, dto);
  }

  @Post("threads/:id/replies")
  @RequirePermission("mentorship.community")
  addReply(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Body() dto: CreateReplyDto,
  ) {
    if (req.permissionScope === PermissionScope.VIEW) {
      throw new ForbiddenException("This role can only read the board");
    }
    return this.mentorshipService.addReply(user.tenantId, user.sub, id, dto);
  }
}
