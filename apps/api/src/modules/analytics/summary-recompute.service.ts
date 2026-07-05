import { Injectable } from "@nestjs/common";
import { Prisma } from "@pms/db";
import {
  TenantPrismaService,
  TenantTx,
} from "../../database/tenant-prisma.service";
import { ACCEPTED_OFFER_PREDICATE } from "./accepted-offers.sql";

interface ScopedAggregate {
  total_students: number;
  eligible_count: number;
  applied_count: number;
  shortlisted_count: number;
  selected_count: number;
  placed_count: number;
  unplaced_count: number;
  highest_ctc: string | null;
  average_ctc: string | null;
  median_ctc: string | null;
}

interface SeasonAggregate {
  active_drive_count: number;
  recruiter_count: number;
}

@Injectable()
export class SummaryRecomputeService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /**
   * Recomputes and upserts one PlacementSummary row per department in this
   * batch, plus the tenant-wide (departmentId=null) aggregate row. Each row
   * is its own short transaction, not one transaction spanning every
   * department: bundling N+1 rows into a single `$transaction` call
   * previously blew past Prisma's default 5s interactive-transaction
   * timeout under concurrent load (a real failure this surfaced, not a
   * hypothetical) once a tenant had enough departments for the combined
   * work to run long. Recompute is idempotent and re-triggered by the next
   * domain event anyway, so a row briefly lagging behind its siblings
   * (if one transaction is slow) is an acceptable tradeoff for not risking
   * the whole batch failing outright.
   */
  async recomputeForBatch(tenantId: string, batchId: string): Promise<void> {
    const departments = await this.tenantPrisma.run(tenantId, (tx) =>
      tx.department.findMany({
        where: { students: { some: { batchId } } },
        select: { id: true },
      }),
    );

    const season = await this.tenantPrisma.run(tenantId, (tx) =>
      this.computeSeasonAggregate(tx, tenantId),
    );

    await this.tenantPrisma.run(tenantId, (tx) =>
      this.upsertRow(tx, tenantId, batchId, null, season),
    );
    for (const dept of departments) {
      await this.tenantPrisma.run(tenantId, (tx) =>
        this.upsertRow(tx, tenantId, batchId, dept.id, season),
      );
    }
  }

  private async upsertRow(
    tx: TenantTx,
    tenantId: string,
    batchId: string,
    departmentId: string | null,
    season: SeasonAggregate,
  ): Promise<void> {
    const scoped = await this.computeScopedAggregate(
      tx,
      tenantId,
      batchId,
      departmentId,
    );
    const computedAt = new Date();

    const data = {
      totalStudents: scoped.total_students,
      eligibleCount: scoped.eligible_count,
      appliedCount: scoped.applied_count,
      shortlistedCount: scoped.shortlisted_count,
      selectedCount: scoped.selected_count,
      placedCount: scoped.placed_count,
      unplacedCount: scoped.unplaced_count,
      highestCtc: scoped.highest_ctc,
      averageCtc: scoped.average_ctc,
      medianCtc: scoped.median_ctc,
      activeDriveCount: season.active_drive_count,
      recruiterCount: season.recruiter_count,
      computedAt,
    };

    // Not tx.placementSummary.upsert(): Prisma's compound-unique WHERE input
    // can't match a nullable column against `null` (find-then-write instead,
    // same workaround used for JD upserts elsewhere in this codebase).
    const existing = await tx.placementSummary.findFirst({
      where: { tenantId, batchId, departmentId },
    });
    if (existing) {
      await tx.placementSummary.update({ where: { id: existing.id }, data });
    } else {
      await tx.placementSummary.create({
        data: { tenantId, batchId, departmentId, ...data },
      });
    }
  }

  /**
   * Per-scope counts. Funnel stages (applied/shortlisted/selected) reflect
   * each application's CURRENT status, not "ever reached this stage" —
   * there's no status-history table, so this is an operational snapshot
   * ("how many are sitting in each state right now"), not a cumulative
   * funnel. placedCount comes from Student.placementStatus, not
   * Application.status = SELECTED, because a PPO has no Application at all.
   */
  private async computeScopedAggregate(
    tx: TenantTx,
    tenantId: string,
    batchId: string,
    departmentId: string | null,
  ): Promise<ScopedAggregate> {
    const rows = await tx.$queryRaw<ScopedAggregate[]>(Prisma.sql`
      WITH scoped_students AS (
        SELECT s.id, s.placement_status
        FROM students s
        WHERE s.tenant_id = ${tenantId}
          AND s.batch_id = ${batchId}
          AND (${departmentId}::text IS NULL OR s.department_id = ${departmentId})
      ),
      eligible_students AS (
        SELECT DISTINCT e.student_id
        FROM eligibility_evaluations e
        WHERE e.tenant_id = ${tenantId}
          AND e.result = true
          AND e.student_id IN (SELECT id FROM scoped_students)
      ),
      scoped_applications AS (
        SELECT a.student_id, a.status
        FROM applications a
        WHERE a.tenant_id = ${tenantId}
          AND a.student_id IN (SELECT id FROM scoped_students)
      ),
      accepted_offers AS (
        SELECT o.ctc_lpa
        FROM offers o
        WHERE o.tenant_id = ${tenantId}
          AND ${ACCEPTED_OFFER_PREDICATE}
          AND o.student_id IN (SELECT id FROM scoped_students)
      )
      SELECT
        (SELECT COUNT(*) FROM scoped_students)::int AS total_students,
        (SELECT COUNT(*) FROM eligible_students)::int AS eligible_count,
        (SELECT COUNT(DISTINCT student_id) FROM scoped_applications)::int AS applied_count,
        (SELECT COUNT(DISTINCT student_id) FROM scoped_applications WHERE status = 'SHORTLISTED')::int AS shortlisted_count,
        (SELECT COUNT(DISTINCT student_id) FROM scoped_applications WHERE status = 'SELECTED')::int AS selected_count,
        (SELECT COUNT(*) FROM scoped_students WHERE placement_status = 'PLACED')::int AS placed_count,
        (SELECT COUNT(*) FROM scoped_students WHERE placement_status = 'UNPLACED')::int AS unplaced_count,
        (SELECT MAX(ctc_lpa) FROM accepted_offers) AS highest_ctc,
        (SELECT AVG(ctc_lpa) FROM accepted_offers) AS average_ctc,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ctc_lpa) FROM accepted_offers) AS median_ctc
    `);
    // An aggregate query with no GROUP BY always returns exactly one row.
    return rows[0]!;
  }

  /**
   * Tenant-wide only (not filtered per department) — Drive/JobDescription
   * has no direct department/batch linkage, only a free-text
   * `eligiblePrograms` array of department codes, so a true per-department
   * breakdown would need a code-array-overlap join. Deferred: every row for
   * a given tenant (department-scoped or not) currently gets the same
   * season-wide active-drive/recruiter counts.
   */
  private async computeSeasonAggregate(
    tx: TenantTx,
    tenantId: string,
  ): Promise<SeasonAggregate> {
    const rows = await tx.$queryRaw<SeasonAggregate[]>(Prisma.sql`
      SELECT
        (SELECT COUNT(*) FROM drives d
          WHERE d.tenant_id = ${tenantId} AND d.status IN ('SCHEDULED', 'ONGOING'))::int AS active_drive_count,
        (SELECT COUNT(DISTINCT jd.company_id) FROM drives d
          JOIN job_descriptions jd ON jd.id = d.jd_id
          WHERE d.tenant_id = ${tenantId} AND d.status IN ('SCHEDULED', 'ONGOING', 'COMPLETED'))::int AS recruiter_count
    `);
    // An aggregate query with no GROUP BY always returns exactly one row.
    return rows[0]!;
  }
}
