import { Controller, Get, NotFoundException, Query } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MagicLinkStubProvider } from "./providers/magic-link-stub.provider";

/**
 * Dev-only "inbox" for the magic-link stub, so a browser can complete the
 * login flow without a real email provider. Gated on
 * AUTH_MAGIC_LINK_PROVIDER=stub at request time — with a real provider
 * (ses, etc) configured, this always 404s, regardless of whether the stub
 * class happens to still be instantiated in the DI container.
 */
@Controller("auth/dev")
export class AuthDevController {
  constructor(
    private readonly config: ConfigService,
    private readonly magicLinkStub: MagicLinkStubProvider,
  ) {}

  @Get("magic-link")
  getMagicLink(@Query("email") email: string) {
    if (
      this.config.get<string>("AUTH_MAGIC_LINK_PROVIDER", "stub") !== "stub"
    ) {
      throw new NotFoundException();
    }
    const token = this.magicLinkStub.getLastTokenFor(email);
    if (!token) {
      throw new NotFoundException("No pending magic link for this email");
    }
    return { token };
  }
}
