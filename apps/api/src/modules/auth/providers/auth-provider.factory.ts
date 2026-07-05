import { Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MagicLinkProvider, SsoProvider } from "./auth-provider.interface";
import { MAGIC_LINK_PROVIDER, SSO_PROVIDER } from "./auth-provider.tokens";
import { MagicLinkStubProvider } from "./magic-link-stub.provider";
import { SsoStubProvider } from "./sso-stub.provider";

/**
 * Selects the SSO/magic-link provider implementation from
 * AUTH_SSO_PROVIDER / AUTH_MAGIC_LINK_PROVIDER. Only "stub" is implemented
 * in this build; requesting a real provider fails loudly at boot rather
 * than silently falling back, so a misconfigured .env can't accidentally
 * ship with no auth.
 */
export const authProviderFactories: Provider[] = [
  SsoStubProvider,
  MagicLinkStubProvider,
  {
    provide: SSO_PROVIDER,
    useFactory: (config: ConfigService, stub: SsoStubProvider): SsoProvider => {
      const provider = config.get<string>("AUTH_SSO_PROVIDER", "stub");
      if (provider === "stub") return stub;
      throw new Error(
        `AUTH_SSO_PROVIDER="${provider}" is not implemented in this build; only "stub" is available`,
      );
    },
    inject: [ConfigService, SsoStubProvider],
  },
  {
    provide: MAGIC_LINK_PROVIDER,
    useFactory: (
      config: ConfigService,
      stub: MagicLinkStubProvider,
    ): MagicLinkProvider => {
      const provider = config.get<string>("AUTH_MAGIC_LINK_PROVIDER", "stub");
      if (provider === "stub") return stub;
      throw new Error(
        `AUTH_MAGIC_LINK_PROVIDER="${provider}" is not implemented in this build; only "stub" is available`,
      );
    },
    inject: [ConfigService, MagicLinkStubProvider],
  },
];
