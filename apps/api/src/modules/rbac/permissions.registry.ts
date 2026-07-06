import { Role } from "@pms/db";
import { PermissionResource, PermissionScope } from "./permission.types";

const {
  NONE,
  VIEW,
  SELF,
  OWN_DEPARTMENT,
  ON_BEHALF,
  PROPOSE,
  NON_ADMIN,
  FULL,
} = PermissionScope;

/**
 * Code-defined RBAC registry — the master plan's §2 matrix, verbatim, as
 * data. Not a DB table (master plan §5C: "Permission registry (code-defined)").
 * Guards/services look up `PERMISSIONS[resource][role]` to get a scope;
 * PermissionGuard only checks "is this scope !== NONE" (can the role touch
 * this resource at all) — actually filtering which rows a caller sees for
 * SELF/OWN_DEPARTMENT/ON_BEHALF scopes is done by the resource's own
 * service layer, which reads the resolved scope off the request.
 */
export const PERMISSIONS: Record<
  PermissionResource,
  Record<Role, PermissionScope>
> = {
  "tenant.config": {
    SUPER_ADMIN: FULL,
    TPO: VIEW,
    FACULTY_COORD: NONE,
    STUDENT: NONE,
    RECRUITER: NONE,
  },
  "policy.rules": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: NONE,
    STUDENT: NONE,
    RECRUITER: NONE,
  },
  "students.records": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: OWN_DEPARTMENT,
    STUDENT: SELF,
    RECRUITER: NONE,
  },
  "import.bulk": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: OWN_DEPARTMENT,
    STUDENT: NONE,
    RECRUITER: NONE,
  },
  "companies.records": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: VIEW,
    STUDENT: VIEW,
    RECRUITER: SELF,
  },
  "drives.manage": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: PROPOSE,
    // VIEW, not NONE: students browse open drives to apply to them (the
    // controller restricts VIEW to read-only, non-internal statuses).
    STUDENT: VIEW,
    RECRUITER: NONE,
  },
  "jd.shortlist": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: NONE,
    STUDENT: NONE,
    RECRUITER: SELF,
  },
  "applications.apply": {
    SUPER_ADMIN: NONE,
    TPO: ON_BEHALF,
    FACULTY_COORD: ON_BEHALF,
    STUDENT: SELF,
    RECRUITER: NONE,
  },
  "offers.manage": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: VIEW,
    STUDENT: SELF,
    RECRUITER: PROPOSE,
  },
  "policy.debar": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: NONE,
    STUDENT: NONE,
    RECRUITER: NONE,
  },
  "analytics.view": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: OWN_DEPARTMENT,
    STUDENT: SELF,
    RECRUITER: SELF,
  },
  "reports.accreditation": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: OWN_DEPARTMENT,
    STUDENT: NONE,
    RECRUITER: NONE,
  },
  "users.manage": {
    SUPER_ADMIN: FULL,
    TPO: NON_ADMIN,
    FACULTY_COORD: NONE,
    STUDENT: NONE,
    RECRUITER: NONE,
  },
  "audit.log": {
    SUPER_ADMIN: FULL,
    TPO: VIEW,
    FACULTY_COORD: NONE,
    STUDENT: NONE,
    RECRUITER: NONE,
  },
  // Students own their resume (SELF); staff may read them when screening.
  "resume.manage": {
    SUPER_ADMIN: VIEW,
    TPO: VIEW,
    FACULTY_COORD: VIEW,
    STUDENT: SELF,
    RECRUITER: NONE,
  },
  // Mentor Connect Q&A board: students read the tenant board and write
  // their own posts (SELF, enforced in the service); staff hold FULL for
  // moderation (close/answer any thread).
  "mentorship.community": {
    SUPER_ADMIN: FULL,
    TPO: FULL,
    FACULTY_COORD: VIEW,
    STUDENT: SELF,
    RECRUITER: NONE,
  },
};

export function resolvePermissionScope(
  resource: PermissionResource,
  role: Role,
): PermissionScope {
  return PERMISSIONS[resource][role];
}
