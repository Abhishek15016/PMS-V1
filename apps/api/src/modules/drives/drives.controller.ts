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
import { Drive, Round } from "@pms/db";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import {
  DriveEligibilityResult,
  EligibilityService,
} from "../eligibility/eligibility.service";
import { PermissionScope } from "../../modules/rbac/permission.types";
import { CreateDriveDto } from "./dto/create-drive.dto";
import { CreateRoundDto } from "./dto/create-round.dto";
import { ListDrivesQueryDto } from "./dto/list-drives.query.dto";
import { UpdateDriveStatusDto } from "./dto/update-drive-status.dto";
import { DrivesService, DriveWithRounds } from "./drives.service";

@Controller("drives")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DrivesController {
  constructor(
    private readonly drivesService: DrivesService,
    private readonly eligibilityService: EligibilityService,
  ) {}

  @Get()
  @RequirePermission("drives.manage")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: ListDrivesQueryDto,
  ): Promise<DriveWithRounds[]> {
    return this.drivesService.findMany(user.tenantId, { jdId: query.jdId });
  }

  @Get(":id")
  @RequirePermission("drives.manage")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<DriveWithRounds> {
    const drive = await this.drivesService.findOne(user.tenantId, id);
    if (!drive) throw new NotFoundException();
    return drive;
  }

  @Get(":id/eligibility")
  @RequirePermission("drives.manage")
  getEligibility(
    @Param("id") driveId: string,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<DriveEligibilityResult> {
    return this.eligibilityService.evaluateDriveBatch(user.tenantId, driveId);
  }

  @Post()
  @RequirePermission("drives.manage")
  create(
    @Body() dto: CreateDriveDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Drive> {
    const scope = req.permissionScope!;
    // PROPOSE (Faculty Coordinator): can initiate a drive, but it always
    // lands in DRAFT — only FULL scope (TPO/Super Admin) can put a drive
    // into a scheduled/live state.
    const status = scope === PermissionScope.PROPOSE ? "DRAFT" : dto.status;
    return this.drivesService.create(user.tenantId, { ...dto, status });
  }

  @Patch(":id/status")
  @RequirePermission("drives.manage")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateDriveStatusDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Drive> {
    if (req.permissionScope !== PermissionScope.FULL) {
      throw new ForbiddenException(
        "Only TPO/Super Admin can change a drive's status — Faculty Coordinators propose drives for approval",
      );
    }
    return this.drivesService.updateStatus(user.tenantId, id, dto.status);
  }

  @Post(":id/rounds")
  @RequirePermission("drives.manage")
  async addRound(
    @Param("id") driveId: string,
    @Body() dto: CreateRoundDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Round> {
    const scope = req.permissionScope!;
    if (scope === PermissionScope.PROPOSE) {
      const drive = await this.drivesService.findOne(user.tenantId, driveId);
      if (!drive) throw new NotFoundException();
      if (drive.status !== "DRAFT") {
        throw new ForbiddenException(
          "Can only edit the round pipeline of a drive that's still in DRAFT",
        );
      }
    }
    return this.drivesService.createRound(user.tenantId, driveId, dto);
  }
}
