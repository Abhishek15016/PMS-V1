import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { SsoCallbackDto } from "./dto/sso-callback.dto";
import { MagicLinkRequestDto } from "./dto/magic-link-request.dto";
import { MagicLinkVerifyDto } from "./dto/magic-link-verify.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("sso/callback")
  ssoCallback(@Body() dto: SsoCallbackDto) {
    return this.authService.ssoCallback(dto.tenantSlug, dto.email, dto.code);
  }

  @Post("magic-link/request")
  @HttpCode(202)
  async magicLinkRequest(@Body() dto: MagicLinkRequestDto): Promise<void> {
    await this.authService.requestMagicLink(dto.tenantSlug, dto.email);
  }

  @Post("magic-link/verify")
  magicLinkVerify(@Body() dto: MagicLinkVerifyDto) {
    return this.authService.verifyMagicLink(dto.token);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }
}
