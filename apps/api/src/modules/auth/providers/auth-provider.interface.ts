export interface SsoCallbackResult {
  externalId: string;
  email: string;
  displayName: string;
  raw: unknown;
}

export interface SsoProvider {
  readonly name: string;
  handleCallback(params: {
    tenantId: string;
    email?: string;
    code?: string;
  }): Promise<SsoCallbackResult>;
}

export interface MagicLinkProvider {
  readonly name: string;
  sendMagicLink(params: {
    email: string;
    tenantId: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}
