import { Role } from "@pms/db";
import { PermissionResource, PermissionScope } from "./permission.types";
import { PERMISSIONS, resolvePermissionScope } from "./permissions.registry";

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
 * Table-driven transcription of the master plan §2 matrix. Every cell is
 * asserted individually so a future edit to permissions.registry.ts that
 * silently drifts from the documented policy (e.g. loosening a Student
 * scope) fails a specific, named test rather than a vague "row differs"
 * diff.
 */
const EXPECTED: Record<PermissionResource, Record<Role, PermissionScope>> = {
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
};

describe("permissions registry (§2 RBAC matrix)", () => {
  const resources = Object.keys(EXPECTED) as PermissionResource[];
  const roles: Role[] = [
    "SUPER_ADMIN",
    "TPO",
    "FACULTY_COORD",
    "STUDENT",
    "RECRUITER",
  ];

  it("covers every documented resource", () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(resources.sort());
  });

  describe.each(resources)("%s", (resource) => {
    it.each(roles)("role %s resolves to the documented scope", (role) => {
      expect(resolvePermissionScope(resource, role)).toBe(
        EXPECTED[resource][role],
      );
    });
  });

  it("Super Admin never has NONE except the one explicit exception (cannot personally apply to a drive)", () => {
    for (const resource of resources) {
      if (resource === "applications.apply") {
        expect(PERMISSIONS[resource].SUPER_ADMIN).toBe(NONE);
        continue;
      }
      expect(PERMISSIONS[resource].SUPER_ADMIN).not.toBe(NONE);
    }
  });

  it("Students never reach FULL scope on any resource (no student is an institution-wide admin)", () => {
    for (const resource of resources) {
      expect(PERMISSIONS[resource].STUDENT).not.toBe(FULL);
    }
  });

  it("Recruiters never reach FULL or OWN_DEPARTMENT scope (external party, not institution staff)", () => {
    for (const resource of resources) {
      expect(PERMISSIONS[resource].RECRUITER).not.toBe(FULL);
      expect(PERMISSIONS[resource].RECRUITER).not.toBe(OWN_DEPARTMENT);
    }
  });
});
