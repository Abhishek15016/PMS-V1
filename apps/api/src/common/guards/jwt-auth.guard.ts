import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

/**
 * Verification already happened in TenantContextMiddleware (which must run
 * before tenant-scoped queries, i.e. before guards). This guard only checks
 * that it succeeded — it never re-verifies the token itself.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.authUser) {
      throw new UnauthorizedException("Missing or invalid access token");
    }
    return true;
  }
}
