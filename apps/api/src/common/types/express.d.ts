import { AccessTokenPayload } from "../token/token.service";
import { PermissionScope } from "../../modules/rbac/permission.types";

declare global {
  namespace Express {
    interface Request {
      authUser?: AccessTokenPayload;
      /** Set by PermissionGuard once a @RequirePermission route resolves the caller's scope for that resource. */
      permissionScope?: PermissionScope;
    }
  }
}

export {};
