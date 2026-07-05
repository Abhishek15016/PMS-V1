import { BadRequestException, Injectable } from "@nestjs/common";
import { SsoCallbackResult, SsoProvider } from "./auth-provider.interface";

/**
 * Dev-mode stand-in for real Google Workspace / Microsoft 365 SSO. Mints an
 * identity for a seeded user by email — no OAuth handshake. A real provider
 * (GoogleWorkspaceSsoProvider, MicrosoftSsoProvider) implements the same
 * SsoProvider interface and is swapped in via AUTH_SSO_PROVIDER; callers
 * (AuthService) never reference this class directly.
 */
@Injectable()
export class SsoStubProvider implements SsoProvider {
  readonly name = "stub";

  async handleCallback(params: {
    tenantId: string;
    email?: string;
    code?: string;
  }): Promise<SsoCallbackResult> {
    if (!params.email) {
      throw new BadRequestException(
        "SSO stub requires an email to impersonate a seeded user (a real OAuth provider would supply this from the token exchange instead)",
      );
    }
    return {
      externalId: `stub:${params.email}`,
      email: params.email,
      displayName: params.email,
      raw: { stub: true, tenantId: params.tenantId },
    };
  }
}
