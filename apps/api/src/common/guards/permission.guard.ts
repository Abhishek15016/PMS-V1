import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { PERMISSION_RESOURCE_KEY } from "../decorators/require-permission.decorator";
import {
  PermissionResource,
  PermissionScope,
} from "../../modules/rbac/permission.types";
import { resolvePermissionScope } from "../../modules/rbac/permissions.registry";

/**
 * Requires JwtAuthGuard to have already run (req.authUser set). Resolves
 * the caller's PermissionScope for the route's @RequirePermission resource
 * and rejects with 403 if that scope is NONE. On success, attaches the
 * resolved scope to the request so the handler/service can apply row-level
 * filtering (e.g. OWN_DEPARTMENT → filter by req.authUser.departmentId).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const resource = this.reflector.getAllAndOverride<
      PermissionResource | undefined
    >(PERMISSION_RESOURCE_KEY, [context.getHandler(), context.getClass()]);
    if (!resource) {
      // No @RequirePermission on this route: nothing for this guard to enforce.
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.authUser) {
      throw new UnauthorizedException("Missing or invalid access token");
    }

    const scope = resolvePermissionScope(resource, req.authUser.role);
    if (scope === PermissionScope.NONE) {
      throw new ForbiddenException(
        `Role "${req.authUser.role}" does not have access to "${resource}"`,
      );
    }

    req.permissionScope = scope;
    return true;
  }
}
