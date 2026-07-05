import { Injectable, Logger } from "@nestjs/common";
import { MagicLinkProvider } from "./auth-provider.interface";

interface DevInboxEntry {
  token: string;
  expiresAt: Date;
}

/**
 * Dev-mode stand-in for a real email/SMS magic-link send (SES/MSG91). Logs
 * the link and keeps an in-memory "dev inbox" (last token per email) so
 * tests — and eventually a dev-only UI affordance — can retrieve it without
 * a real inbox. A real provider (SesMagicLinkProvider) implements the same
 * MagicLinkProvider interface and is swapped in via AUTH_MAGIC_LINK_PROVIDER;
 * callers never reference this class directly, so nothing depends on the
 * dev inbox existing.
 */
@Injectable()
export class MagicLinkStubProvider implements MagicLinkProvider {
  readonly name = "stub";
  private readonly logger = new Logger(MagicLinkStubProvider.name);
  private readonly devInbox = new Map<string, DevInboxEntry>();

  async sendMagicLink(params: {
    email: string;
    tenantId: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    this.devInbox.set(params.email, {
      token: params.token,
      expiresAt: params.expiresAt,
    });
    this.logger.log(
      `[DEV MAGIC LINK] to=${params.email} tenant=${params.tenantId} token=${params.token} expires=${params.expiresAt.toISOString()}`,
    );
  }

  getLastTokenFor(email: string): string | undefined {
    return this.devInbox.get(email)?.token;
  }
}
