import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@pms/db";
import { createHmac, randomBytes } from "node:crypto";
import { parseDurationMs } from "./duration.util";

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: Role;
  departmentId?: string | null;
  companyId?: string | null;
}

/**
 * Access tokens are signed JWTs (short-lived, verified stateless via
 * JwtService). Refresh/magic-link tokens are opaque high-entropy random
 * strings — hashed with HMAC-SHA256 (not bcrypt: these are already
 * maximally random, so bcrypt's deliberate slowness buys nothing and only
 * costs a DB-lookup-by-hash, which these tokens need to support).
 *
 * Refresh tokens are prefixed with their tenantId (`${tenantId}.${random}`)
 * so /auth/refresh can resolve which tenant to scope the lookup to without
 * needing a cross-tenant bootstrap query — the token itself carries routing
 * information, the hash-lookup inside that tenant proves possession.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token);
  }

  generateRefreshToken(tenantId: string): string {
    return `${tenantId}.${randomBytes(48).toString("hex")}`;
  }

  parseTenantFromRefreshToken(token: string): string | undefined {
    const idx = token.indexOf(".");
    return idx > 0 ? token.slice(0, idx) : undefined;
  }

  generateOpaqueToken(): string {
    return randomBytes(32).toString("hex");
  }

  hashOpaqueToken(token: string): string {
    return createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update(token)
      .digest("hex");
  }

  getRefreshTtlMs(): number {
    return parseDurationMs(this.config.get<string>("JWT_REFRESH_TTL", "7d"));
  }
}
