import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AccessTokenPayload } from "../../common/token/token.service";

@Controller("me")
@UseGuards(JwtAuthGuard)
export class MeController {
  @Get()
  me(@CurrentUser() user: AccessTokenPayload) {
    return {
      id: user.sub,
      tenantId: user.tenantId,
      role: user.role,
      departmentId: user.departmentId ?? null,
      companyId: user.companyId ?? null,
      // Populated once the RBAC permission registry lands (slice 4).
      permissions: [],
    };
  }
}
