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
import { Offer } from "@pms/db";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { PermissionScope } from "../rbac/permission.types";
import { CreateOfferDto } from "./dto/create-offer.dto";
import { CreatePpoOfferDto } from "./dto/create-ppo-offer.dto";
import { ListOffersQueryDto } from "./dto/list-offers.query.dto";
import { OffersService, OfferWithRelations } from "./offers.service";

@Controller("offers")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @RequirePermission("offers.manage")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
    @Query() query: ListOffersQueryDto,
  ): Promise<OfferWithRelations[]> {
    const scope = req.permissionScope!;
    if (scope === PermissionScope.SELF) {
      return this.offersService.findMany(user.tenantId, {
        studentUserId: user.sub,
      });
    }
    if (scope === PermissionScope.PROPOSE) {
      return this.offersService.findMany(user.tenantId, {
        companyId: user.companyId ?? "__none__",
      });
    }
    return this.offersService.findMany(user.tenantId, {
      studentId: query.studentId,
      companyId: query.companyId,
    });
  }

  @Get(":id")
  @RequirePermission("offers.manage")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<OfferWithRelations> {
    const offer = await this.offersService.findOne(user.tenantId, id);
    if (!offer) throw new NotFoundException();

    const scope = req.permissionScope!;
    if (scope === PermissionScope.SELF) {
      const student = await this.offersService.findMany(user.tenantId, {
        studentUserId: user.sub,
      });
      if (!student.some((o) => o.id === offer.id)) {
        throw new ForbiddenException("Not authorized for this offer");
      }
    } else if (scope === PermissionScope.PROPOSE) {
      if (
        offer.application?.drive.jobDescription.companyId !== user.companyId
      ) {
        throw new ForbiddenException("Not authorized for this offer");
      }
    }
    return offer;
  }

  @Post()
  @RequirePermission("offers.manage")
  create(
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Offer> {
    const scope = req.permissionScope!;
    if (scope !== PermissionScope.FULL && scope !== PermissionScope.PROPOSE) {
      throw new ForbiddenException("Not authorized to extend offers");
    }
    return this.offersService.create(
      user.tenantId,
      scope,
      user.companyId ?? undefined,
      dto,
    );
  }

  @Post("ppo")
  @RequirePermission("offers.manage")
  createPpo(
    @Body() dto: CreatePpoOfferDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Offer> {
    if (req.permissionScope !== PermissionScope.FULL) {
      throw new ForbiddenException(
        "Only TPO/Super Admin can convert an internship into a PPO",
      );
    }
    return this.offersService.createPpo(user.tenantId, dto);
  }

  @Post(":id/approve")
  @RequirePermission("offers.manage")
  approve(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Offer> {
    if (req.permissionScope !== PermissionScope.FULL) {
      throw new ForbiddenException("Only TPO/Super Admin can approve offers");
    }
    return this.offersService.approve(user.tenantId, id);
  }

  @Post(":id/accept")
  @RequirePermission("offers.manage")
  accept(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Offer> {
    if (req.permissionScope !== PermissionScope.SELF) {
      throw new ForbiddenException("Only the offered student can accept");
    }
    return this.offersService.accept(user.tenantId, id, user.sub);
  }

  @Post(":id/reject")
  @RequirePermission("offers.manage")
  reject(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Offer> {
    if (req.permissionScope !== PermissionScope.SELF) {
      throw new ForbiddenException("Only the offered student can reject");
    }
    return this.offersService.reject(user.tenantId, id, user.sub);
  }

  @Post(":id/revoke")
  @RequirePermission("offers.manage")
  revoke(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Offer> {
    if (req.permissionScope !== PermissionScope.FULL) {
      throw new ForbiddenException("Only TPO/Super Admin can revoke offers");
    }
    return this.offersService.revoke(user.tenantId, id, user.sub);
  }
}
