import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "crypto";
import { Request } from "express";

/**
 * Vendor-only gate: a static platform key in the x-platform-key header,
 * compared timing-safely. When PLATFORM_ADMIN_KEY isn't configured the
 * whole surface 404s — the console simply doesn't exist on that
 * deployment. This is deliberately NOT tenant auth: the operator is the
 * SaaS vendor, never a tenant user.
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>("PLATFORM_ADMIN_KEY");
    if (!expected) throw new NotFoundException();

    const req = context.switchToHttp().getRequest<Request>();
    const presented = req.header("x-platform-key") ?? "";
    const a = Buffer.from(presented);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Invalid platform key");
    }
    return true;
  }
}
