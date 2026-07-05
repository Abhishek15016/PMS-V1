import "dotenv/config";
import { Client } from "pg";
import { TenantPrismaService } from "../../database/tenant-prisma.service";
import { SummaryRecomputeService } from "./summary-recompute.service";

/**
 * Proves the raw-SQL aggregation math against a real Postgres instance —
 * complementing bullmq-dedup.spike.spec.ts, which proves the debounce
 * mechanism, and the e2e event->recompute test, which proves the wiring.
 * This one only cares whether percentile_cont/AVG/MAX come out right for a
 * known fixture: [4, 6, 6, 8, 20] LPA -> median 6 / average 8.8 / highest 20.
 *
 * Uses a dedicated, freshly-created AcademicBatch (not the shared demo-college
 * seed batch) so the aggregate is computed over exactly these five offers —
 * the seed batch has accumulated offers from every other e2e test run and
 * would silently pollute the numbers.
 */
describe("SummaryRecomputeService (integration)", () => {
  const SUPERUSER_URL = process.env.MIGRATION_DATABASE_URL!;
  let tenantPrisma: TenantPrismaService;
  let service: SummaryRecomputeService;

  let tenantId: string;
  let batchId: string;
  let departmentId: string;
  const studentIds: string[] = [];

  async function withSuperuser<T>(
    fn: (client: Client) => Promise<T>,
  ): Promise<T> {
    const client = new Client({ connectionString: SUPERUSER_URL });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  }

  beforeAll(async () => {
    tenantPrisma = new TenantPrismaService();
    await tenantPrisma.onModuleInit();
    service = new SummaryRecomputeService(tenantPrisma);

    await withSuperuser(async (client) => {
      const inst = await client.query(
        `SELECT id FROM institutions WHERE slug = 'demo-college'`,
      );
      tenantId = inst.rows[0].id;

      const dept = await client.query(
        `SELECT id FROM departments WHERE tenant_id = $1 AND code = 'CSE'`,
        [tenantId],
      );
      departmentId = dept.rows[0].id;

      const batch = await client.query(
        `INSERT INTO academic_batches (id, tenant_id, label, start_year, end_year, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, 2020, 2024, now())
         RETURNING id`,
        [tenantId, `ctc-fixture-${Date.now()}`],
      );
      batchId = batch.rows[0].id;

      const ctcValues = [4, 6, 6, 8, 20];
      for (let i = 0; i < ctcValues.length; i += 1) {
        const email = `ctc-fixture-${batchId}-${i}@demo-college.local`;
        const user = await client.query(
          `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, status, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'STUDENT', 'stub', 'ACTIVE', now())
           RETURNING id`,
          [tenantId, email, `CTC Fixture Student ${i}`],
        );
        const student = await client.query(
          `INSERT INTO students (id, tenant_id, user_id, department_id, batch_id, roll_number, active_backlogs, backlog_history, gap_years, diploma_flag, placement_status, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 0, 0, 0, false, 'PLACED', now())
           RETURNING id`,
          [tenantId, user.rows[0].id, departmentId, batchId, `CTCFX${i}`],
        );
        const studentId = student.rows[0].id as string;
        studentIds.push(studentId);

        await client.query(
          `INSERT INTO offers (id, tenant_id, student_id, ctc_lpa, status, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'ACCEPTED', now())`,
          [tenantId, studentId, ctcValues[i]],
        );
      }
    });
  });

  afterAll(async () => {
    await withSuperuser(async (client) => {
      await client.query(
        `DELETE FROM placement_summaries WHERE batch_id = $1`,
        [batchId],
      );
      await client.query(`DELETE FROM offers WHERE student_id = ANY($1)`, [
        studentIds,
      ]);
      await client.query(`DELETE FROM students WHERE id = ANY($1)`, [
        studentIds,
      ]);
      await client
        .query(
          `DELETE FROM users WHERE id IN (SELECT user_id FROM students WHERE id = ANY($1))`,
          [studentIds],
        )
        .catch(() => undefined);
      await client.query(
        `DELETE FROM users WHERE tenant_id = $1 AND email LIKE $2`,
        [tenantId, `ctc-fixture-${batchId}-%`],
      );
      await client.query(`DELETE FROM academic_batches WHERE id = $1`, [
        batchId,
      ]);
    });
    await tenantPrisma.onModuleDestroy();
  });

  it("computes median/average/highest CTC correctly for [4, 6, 6, 8, 20] LPA", async () => {
    await service.recomputeForBatch(tenantId, batchId);

    const summary = await tenantPrisma.run(tenantId, (tx) =>
      tx.placementSummary.findFirst({
        where: { tenantId, batchId, departmentId: null },
      }),
    );

    expect(summary).not.toBeNull();
    expect(summary!.totalStudents).toBe(5);
    expect(summary!.placedCount).toBe(5);
    expect(Number(summary!.highestCtc)).toBe(20);
    expect(Number(summary!.medianCtc)).toBe(6);
    expect(Number(summary!.averageCtc)).toBeCloseTo(8.8, 5);
  });

  it("computes the same numbers for the department-scoped row when all students share one department", async () => {
    const summary = await tenantPrisma.run(tenantId, (tx) =>
      tx.placementSummary.findFirst({
        where: { tenantId, batchId, departmentId },
      }),
    );

    expect(summary).not.toBeNull();
    expect(Number(summary!.highestCtc)).toBe(20);
    expect(Number(summary!.medianCtc)).toBe(6);
    expect(Number(summary!.averageCtc)).toBeCloseTo(8.8, 5);
  });
});
