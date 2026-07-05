import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { TenantContextStore } from "../context/tenant-context.store";
import { TokenService } from "../token/token.service";

/**
 * Populates TenantContextStore for the duration of the request, and
 * verifies the access token (if present) attaching it as req.authUser.
 *
 * This runs as middleware — before guards — because tenant context must be
 * set before any RLS-scoped query in the request pipeline, including ones
 * inside guards. JwtAuthGuard (see common/guards) then simply checks
 * req.authUser was set here; it does not re-verify the token.
 *
 * Pre-auth routes (SSO callback, magic-link request/verify, refresh) never
 * carry a bearer token and correctly fall through with no tenant context —
 * they resolve their own tenant scoping explicitly via
 * AuthBootstrapPrismaService or the refresh token's tenant prefix.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    private readonly store: TenantContextStore,
    private readonly tokenService: TokenService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      next();
      return;
    }

    const token = authHeader.slice("Bearer ".length);
    try {
      const payload = this.tokenService.verifyAccessToken(token);
      req.authUser = payload;
      this.store.run({ tenantId: payload.tenantId }, () => next());
    } catch {
      // Invalid/expired token: leave req.authUser unset and tenant context
      // unpopulated. JwtAuthGuard rejects the request with 401 downstream;
      // this middleware doesn't decide that itself so public routes that
      // happen to receive a stale Authorization header still work.
      next();
    }
  }
}
