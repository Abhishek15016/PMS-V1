import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import {
  assertOwnDepartment,
  assertSelf,
} from "../../common/utils/department-scope.util";
import { PermissionScope } from "../../modules/rbac/permission.types";
import { ListStudentsQueryDto } from "./dto/list-students.query.dto";
import { UpdateStudentLinksDto } from "./dto/update-student-links.dto";
import { StudentsService, StudentWithRelations } from "./students.service";

@Controller("students")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @RequirePermission("students.records")
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Query() query: ListStudentsQueryDto,
  ): Promise<StudentWithRelations[]> {
    const scope = req.permissionScope!;

    if (scope === PermissionScope.SELF) {
      const own = await this.studentsService.findByUserIdWithRelations(
        user.tenantId,
        user.sub,
      );
      return own ? [own] : [];
    }

    let departmentId = query.departmentId;
    if (scope === PermissionScope.OWN_DEPARTMENT) {
      if (!user.departmentId) {
        throw new ForbiddenException("No department assigned");
      }
      departmentId = user.departmentId;
    }

    return this.studentsService.findMany(user.tenantId, {
      departmentId,
      batchId: query.batchId,
    });
  }

  /** Student self-service for public profile links only; the SELF scope
   * check plus updating strictly by the caller's own userId means no other
   * record is reachable, and the DTO whitelists exactly four fields. */
  @Patch("me/links")
  @RequirePermission("students.records")
  updateMyLinks(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Body() dto: UpdateStudentLinksDto,
  ): Promise<StudentWithRelations> {
    if (req.permissionScope !== PermissionScope.SELF) {
      throw new ForbiddenException(
        "Profile links are edited by the student who owns them",
      );
    }
    return this.studentsService.updateLinksByUserId(
      user.tenantId,
      user.sub,
      dto,
    );
  }

  @Get(":id")
  @RequirePermission("students.records")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<StudentWithRelations> {
    const student = await this.studentsService.findOne(user.tenantId, id);
    if (!student) {
      throw new NotFoundException();
    }

    const scope = req.permissionScope!;
    if (scope === PermissionScope.OWN_DEPARTMENT) {
      assertOwnDepartment(user, scope, student.departmentId);
    } else if (scope === PermissionScope.SELF) {
      assertSelf(user, scope, student.userId);
    }

    return student;
  }
}
