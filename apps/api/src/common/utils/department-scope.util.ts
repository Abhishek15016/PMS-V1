import { ForbiddenException } from "@nestjs/common";
import { AccessTokenPayload } from "../token/token.service";
import { PermissionScope } from "../../modules/rbac/permission.types";

/**
 * Enforces the OWN_DEPARTMENT scope: a caller resolved to that scope
 * (typically FACULTY_COORD) may only touch rows in their own department.
 * FULL scope callers (SUPER_ADMIN/TPO) bypass this check entirely — they
 * aren't department-restricted. Any other scope reaching this call is a
 * caller-side bug (the route required a resource whose scope isn't
 * department-shaped), so it fails closed rather than silently allowing.
 */
export function assertOwnDepartment(
  user: AccessTokenPayload,
  scope: PermissionScope,
  targetDepartmentId: string,
): void {
  if (scope === PermissionScope.FULL) return;
  if (scope !== PermissionScope.OWN_DEPARTMENT) {
    throw new ForbiddenException(`Scope "${scope}" is not department-scoped`);
  }
  if (!user.departmentId || user.departmentId !== targetDepartmentId) {
    throw new ForbiddenException("Not authorized for this department");
  }
}

/** Enforces the SELF scope: the target record must belong to the caller. */
export function assertSelf(
  user: AccessTokenPayload,
  scope: PermissionScope,
  targetUserId: string,
): void {
  if (scope === PermissionScope.FULL) return;
  if (scope !== PermissionScope.SELF) {
    throw new ForbiddenException(`Scope "${scope}" is not self-scoped`);
  }
  if (user.sub !== targetUserId) {
    throw new ForbiddenException("Not authorized for this record");
  }
}
