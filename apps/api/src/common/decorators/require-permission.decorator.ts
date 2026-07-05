import { SetMetadata } from "@nestjs/common";
import { PermissionResource } from "../../modules/rbac/permission.types";

export const PERMISSION_RESOURCE_KEY = "permissionResource";

/**
 * Marks a route as requiring at least some access to `resource` (i.e. the
 * caller's role must not resolve to PermissionScope.NONE for it).
 * PermissionGuard reads this metadata; row-level filtering for
 * SELF/OWN_DEPARTMENT/ON_BEHALF scopes is the handler/service's job, using
 * `req.permissionScope` that the guard attaches.
 */
export const RequirePermission = (resource: PermissionResource) =>
  SetMetadata(PERMISSION_RESOURCE_KEY, resource);
