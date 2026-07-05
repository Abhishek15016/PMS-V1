import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@pms/db";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { PermissionScope } from "../rbac/permission.types";
import { ACCEPTED_OFFER_PREDICATE } from "./accepted-offers.sql";
import { DrilldownMetric } from "./dto/analytics-drilldown.query.dto";

export interface ResolvedScope {
  batchId: string;
  departmentId: string | null;
}

export interface SummaryResponse {
  scope: "FULL" | "DEPARTMENT" | "STUDENT";
  batchId: string;
  departmentId: string | null;
  totalStudents: number;
  eligibleCount: number;
  appliedCount: number;
  shortlistedCount: number;
  selectedCount: number;
  placedCount: number;
  unplacedCount: number;
  /** null when totalStudents is 0 — never a divide-by-zero NaN/Infinity. */
  placementPercent: number | null;
  highestCtc: number | null;
  medianCtc: number | null;
  averageCtc: number | null;
  activeDriveCount: number;
  recruiterCount: number;
  computedAt: string;
}

export interface YoyResponse {
  current: SummaryResponse | null;
  previous: SummaryResponse | null;
  /** null when either side is missing, or previous.totalStudents/placementPercent is null. */
  placementPercentDelta: number | null;
  medianCtcDelta: number | null;
}

export interface FilterOptionsResponse {
  batches: Array<{
    id: string;
    label: string;
    startYear: number;
    endYear: number;
  }>;
  departments: Array<{ id: string; code: string; name: string }>;
}

export interface UpcomingDriveRow {
  id: string;
  jdTitle: string;
  companyName: string;
  scheduledAt: string | null;
}

export interface DrilldownStudentRow {
  id: string;
  rollNumber: string | null;
  departmentId: string;
  placementStatus: string;
}

export interface DrilldownOfferRow {
  id: string;
  studentId: string;
  ctcLpa: number;
  slab: string | null;
  isPpo: boolean;
}

@Injectable()
export class AnalyticsQueryService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * Resolves which (batchId, departmentId) scope a caller may query, per
   * their analytics.view scope. FULL/OWN_DEPARTMENT callers must name a
   * batchId explicitly (no "current season" guess baked in here — the
   * caller, i.e. the filter bar in slice 20, decides); OWN_DEPARTMENT is
   * forced to the caller's own department regardless of what's asked for;
   * SELF (STUDENT) ignores the query entirely and resolves their own
   * batch+department.
   */
  async resolveScope(
    tenantId: string,
    scope: PermissionScope,
    userSub: string,
    userDepartmentId: string | undefined,
    requested: { batchId?: string; departmentId?: string },
  ): Promise<{
    resolved: ResolvedScope;
    shape: "FULL" | "DEPARTMENT" | "STUDENT";
  }> {
    if (scope === PermissionScope.SELF) {
      const student = await this.tenantPrisma.run(tenantId, (tx) =>
        tx.student.findUnique({ where: { userId: userSub } }),
      );
      if (!student) throw new NotFoundException("No student profile found");
      return {
        resolved: {
          batchId: student.batchId,
          departmentId: student.departmentId,
        },
        shape: "STUDENT",
      };
    }

    if (!requested.batchId) {
      throw new ForbiddenException("batchId is required");
    }

    if (scope === PermissionScope.OWN_DEPARTMENT) {
      if (!userDepartmentId) {
        throw new ForbiddenException("No department assigned");
      }
      return {
        resolved: {
          batchId: requested.batchId,
          departmentId: userDepartmentId,
        },
        shape: "DEPARTMENT",
      };
    }

    // FULL
    return {
      resolved: {
        batchId: requested.batchId,
        departmentId: requested.departmentId ?? null,
      },
      shape: "FULL",
    };
  }

  async getSummary(
    tenantId: string,
    resolved: ResolvedScope,
    shape: "FULL" | "DEPARTMENT" | "STUDENT",
  ): Promise<SummaryResponse> {
    const row = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.placementSummary.findFirst({
        where: {
          tenantId,
          batchId: resolved.batchId,
          departmentId: resolved.departmentId,
        },
      }),
    );

    if (!row) {
      throw new NotFoundException(
        "No placement summary computed yet for this batch/department — it appears after the first recompute-triggering event",
      );
    }

    return {
      scope: shape,
      batchId: row.batchId,
      departmentId: row.departmentId,
      totalStudents: row.totalStudents,
      eligibleCount: row.eligibleCount,
      appliedCount: row.appliedCount,
      shortlistedCount: row.shortlistedCount,
      selectedCount: row.selectedCount,
      placedCount: row.placedCount,
      unplacedCount: row.unplacedCount,
      placementPercent:
        row.totalStudents === 0
          ? null
          : (row.placedCount / row.totalStudents) * 100,
      highestCtc: row.highestCtc == null ? null : Number(row.highestCtc),
      medianCtc: row.medianCtc == null ? null : Number(row.medianCtc),
      averageCtc: row.averageCtc == null ? null : Number(row.averageCtc),
      activeDriveCount: row.activeDriveCount,
      recruiterCount: row.recruiterCount,
      computedAt: row.computedAt.toISOString(),
    };
  }

  /**
   * Year-over-year: "previous" is the batch in this tenant whose startYear
   * is exactly one less than the current batch's — a simple, explicit
   * adjacency rule rather than guessing from labels. Missing prior data
   * (no such batch, or no summary computed for it yet) degrades to
   * `previous: null` and null deltas, not an error — a college's first
   * season has nothing to compare against.
   */
  async getYoy(
    tenantId: string,
    resolved: ResolvedScope,
    shape: "FULL" | "DEPARTMENT" | "STUDENT",
  ): Promise<YoyResponse> {
    const current = await this.getSummary(tenantId, resolved, shape).catch(
      () => null,
    );

    const currentBatch = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.academicBatch.findUnique({ where: { id: resolved.batchId } }),
    );
    if (!currentBatch) {
      throw new NotFoundException("Batch not found");
    }

    const previousBatch = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.academicBatch.findFirst({
        where: { tenantId, startYear: currentBatch.startYear - 1 },
      }),
    );

    let previous: SummaryResponse | null = null;
    if (previousBatch) {
      previous = await this.getSummary(
        tenantId,
        { batchId: previousBatch.id, departmentId: resolved.departmentId },
        shape,
      ).catch(() => null);
    }

    const placementPercentDelta =
      current?.placementPercent != null && previous?.placementPercent != null
        ? current.placementPercent - previous.placementPercent
        : null;
    const medianCtcDelta =
      current?.medianCtc != null && previous?.medianCtc != null
        ? current.medianCtc - previous.medianCtc
        : null;

    return { current, previous, placementPercentDelta, medianCtcDelta };
  }

  /**
   * The underlying row list behind a KPI. `accepted-offers` reuses
   * ACCEPTED_OFFER_PREDICATE (the exact fragment the recompute job's CTC
   * aggregates are built on) so this list and the KPI numbers can never
   * silently disagree about what counts as an accepted offer. `placed`
   * counts distinct STUDENTS (placementStatus), which is what
   * PlacementSummary.placedCount also counts — proven equal in
   * analytics.e2e-spec.ts's parity test.
   */
  async getDrilldown(
    tenantId: string,
    resolved: ResolvedScope,
    metric: DrilldownMetric,
  ): Promise<DrilldownStudentRow[] | DrilldownOfferRow[]> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const studentFilter = {
        tenantId,
        batchId: resolved.batchId,
        ...(resolved.departmentId
          ? { departmentId: resolved.departmentId }
          : {}),
      };

      switch (metric) {
        case DrilldownMetric.PLACED:
          return tx.student.findMany({
            where: { ...studentFilter, placementStatus: "PLACED" },
            select: {
              id: true,
              rollNumber: true,
              departmentId: true,
              placementStatus: true,
            },
          });
        case DrilldownMetric.UNPLACED:
          return tx.student.findMany({
            where: { ...studentFilter, placementStatus: "UNPLACED" },
            select: {
              id: true,
              rollNumber: true,
              departmentId: true,
              placementStatus: true,
            },
          });
        case DrilldownMetric.ELIGIBLE:
          return tx.student.findMany({
            where: {
              ...studentFilter,
              eligibilityEvaluations: { some: { result: true } },
            },
            select: {
              id: true,
              rollNumber: true,
              departmentId: true,
              placementStatus: true,
            },
          });
        case DrilldownMetric.APPLIED:
          return tx.student.findMany({
            where: { ...studentFilter, applications: { some: {} } },
            select: {
              id: true,
              rollNumber: true,
              departmentId: true,
              placementStatus: true,
            },
          });
        case DrilldownMetric.SHORTLISTED:
          return tx.student.findMany({
            where: {
              ...studentFilter,
              applications: { some: { status: "SHORTLISTED" } },
            },
            select: {
              id: true,
              rollNumber: true,
              departmentId: true,
              placementStatus: true,
            },
          });
        case DrilldownMetric.SELECTED:
          return tx.student.findMany({
            where: {
              ...studentFilter,
              applications: { some: { status: "SELECTED" } },
            },
            select: {
              id: true,
              rollNumber: true,
              departmentId: true,
              placementStatus: true,
            },
          });
        case DrilldownMetric.ACCEPTED_OFFERS: {
          const rows = await tx.$queryRaw<DrilldownOfferRow[]>(Prisma.sql`
            SELECT o.id, o.student_id AS "studentId", o.ctc_lpa AS "ctcLpa", o.slab, o.is_ppo AS "isPpo"
            FROM offers o
            JOIN students s ON s.id = o.student_id
            WHERE o.tenant_id = ${tenantId}
              AND ${ACCEPTED_OFFER_PREDICATE}
              AND s.batch_id = ${resolved.batchId}
              AND (${resolved.departmentId}::text IS NULL OR s.department_id = ${resolved.departmentId})
          `);
          return rows.map((r) => ({ ...r, ctcLpa: Number(r.ctcLpa) }));
        }
        default: {
          const exhaustive: never = metric;
          throw new Error(
            `Unhandled drilldown metric: ${exhaustive as string}`,
          );
        }
      }
    });
  }

  /** Populates the filter bar's batch/department selectors — not scoped by role beyond the FULL/OWN_DEPARTMENT gate the controller already applies, since picking a batch to look at is the point of calling this. */
  async getFilterOptions(tenantId: string): Promise<FilterOptionsResponse> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const [batches, departments] = await Promise.all([
        tx.academicBatch.findMany({
          orderBy: { startYear: "desc" },
          select: { id: true, label: true, startYear: true, endYear: true },
        }),
        tx.department.findMany({
          orderBy: { code: "asc" },
          select: { id: true, code: true, name: true },
        }),
      ]);
      return { batches, departments };
    });
  }

  /** Right-rail "upcoming drives" — the next 10 SCHEDULED/ONGOING drives tenant-wide, soonest first. */
  async getUpcomingDrives(tenantId: string): Promise<UpcomingDriveRow[]> {
    return this.tenantPrisma.run(tenantId, async (tx) => {
      const drives = await tx.drive.findMany({
        where: { status: { in: ["SCHEDULED", "ONGOING"] } },
        include: { jobDescription: { include: { company: true } } },
        orderBy: { scheduledAt: "asc" },
        take: 10,
      });
      return drives.map((d) => ({
        id: d.id,
        jdTitle: d.jobDescription.title,
        companyName: d.jobDescription.company.name,
        scheduledAt: d.scheduledAt?.toISOString() ?? null,
      }));
    });
  }
}
