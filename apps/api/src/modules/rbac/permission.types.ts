/**
 * Resource codes, one per row of the master plan's §2 RBAC matrix.
 * Deliberately coarse (per-resource, not per-CRUD-verb) to match how the
 * matrix itself is defined — fine-grained scoping (which specific rows a
 * caller may see/write) is a service-layer concern driven by
 * PermissionScope, not something the guard itself decides.
 */
export type PermissionResource =
  | "tenant.config"
  | "policy.rules"
  | "students.records"
  | "import.bulk"
  | "companies.records"
  | "drives.manage"
  | "jd.shortlist"
  | "applications.apply"
  | "offers.manage"
  | "policy.debar"
  | "analytics.view"
  | "reports.accreditation"
  | "users.manage"
  | "audit.log";

/**
 * Mirrors the matrix legend: ✅ full · 🔒 scoped (self/own-dept/own-record) ·
 * ⚙️ config-limited (propose, needs approval) · 👁️ view · ❌ none.
 * "on_behalf" captures the matrix's distinct "on-behalf" cells (TPO/Faculty
 * applying for a student) — different from FULL because it operates through
 * a specific student's record, not open write access to the resource.
 */
export enum PermissionScope {
  NONE = "none",
  VIEW = "view",
  SELF = "self",
  OWN_DEPARTMENT = "own_department",
  ON_BEHALF = "on_behalf",
  PROPOSE = "propose",
  /** TPO's "🔒 non-admin" user-management cell: full scope excluding admin-tier accounts. */
  NON_ADMIN = "non_admin",
  FULL = "full",
}
