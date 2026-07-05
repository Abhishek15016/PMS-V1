import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Company } from "@pms/db";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { RequirePermission } from "../../common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionGuard } from "../../common/guards/permission.guard";
import { AccessTokenPayload } from "../../common/token/token.service";
import { PermissionScope } from "../../modules/rbac/permission.types";
import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Controller("companies")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @RequirePermission("companies.records")
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Company[]> {
    const scope = req.permissionScope!;
    if (scope === PermissionScope.SELF) {
      return this.companiesService.findMany(user.tenantId, {
        companyId: user.companyId ?? "__none__",
      });
    }
    return this.companiesService.findMany(user.tenantId);
  }

  @Get(":id")
  @RequirePermission("companies.records")
  async findOne(
    @Param("id") id: string,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Company> {
    const company = await this.companiesService.findOne(user.tenantId, id);
    if (!company) throw new NotFoundException();

    const scope = req.permissionScope!;
    if (scope === PermissionScope.SELF && company.id !== user.companyId) {
      throw new ForbiddenException("Not authorized for this company");
    }
    return company;
  }

  @Post()
  @RequirePermission("companies.records")
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Company> {
    if (req.permissionScope !== PermissionScope.FULL) {
      throw new ForbiddenException(
        "Only TPO/Super Admin can add companies to the CRM",
      );
    }
    return this.companiesService.create(user.tenantId, dto);
  }

  @Patch(":id")
  @RequirePermission("companies.records")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<Company> {
    const scope = req.permissionScope!;
    if (scope === PermissionScope.VIEW) {
      throw new ForbiddenException("Read-only access to company records");
    }
    if (scope === PermissionScope.SELF) {
      const company = await this.companiesService.findOne(user.tenantId, id);
      if (!company || company.id !== user.companyId) {
        throw new ForbiddenException("Not authorized for this company");
      }
    }
    return this.companiesService.update(user.tenantId, id, dto);
  }
}
