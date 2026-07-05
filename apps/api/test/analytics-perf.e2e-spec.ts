import "dotenv/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { SummaryRecomputeService } from "../src/modules/analytics/summary-recompute.service";

/**
 * Perf target from the master plan: GET /analytics/summary p95 < 400ms at
 * 2000 students across 6 branches. Generates the fixture with bulk
 * set-based SQL (generate_series + unnest), not 2000 individual round
 * trips, since the point is to measure query performance, not spend the
 * test's own budget on slow fixture setup.
 */
describe("Analytics API perf (e2e)", () => {
  let app: INestApplication;
  let recomputeService: SummaryRecomputeService;
  const TENANT_SLUG = "demo-college";
  const SUPERUSER_URL = process.env.MIGRATION_DATABASE_URL!;

  let tenantId: string;
  let batchId: string;
  const deptIds: string[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    recomputeService = app.get(SummaryRecomputeService);

    await withSuperuser(async (client) => {
      const inst = await client.query(
        `SELECT id FROM institutions WHERE slug = $1`,
        [TENANT_SLUG],
      );
      tenantId = inst.rows[0].id;

      const batch = await client.query(
        `INSERT INTO academic_batches (id, tenant_id, label, start_year, end_year, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, 2010, 2014, now())
         RETURNING id`,
        [tenantId, `perf-${Date.now()}`],
      );
      batchId = batch.rows[0].id;

      for (let i = 0; i < 6; i += 1) {
        const dept = await client.query(
          `INSERT INTO departments (id, tenant_id, name, code, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, now())
           RETURNING id`,
          [tenantId, `Perf Branch ${i}`, `PERF${i}`],
        );
        deptIds.push(dept.rows[0].id);
      }

      // 2000 students, evenly spread across the 6 departments, via one
      // set-based INSERT ... SELECT rather than 2000 round trips.
      await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, status, updated_at)
         SELECT gen_random_uuid()::text, $1,
                'perf-student-' || gs || '@demo-college.local',
                'Perf Student ' || gs,
                'STUDENT', 'stub', 'ACTIVE', now()
         FROM generate_series(1, 2000) AS gs`,
        [tenantId],
      );

      await client.query(
        `WITH numbered AS (
           SELECT u.id AS user_id, row_number() OVER (ORDER BY u.id) AS rn
           FROM users u
           WHERE u.tenant_id = $1 AND u.email LIKE 'perf-student-%'
         )
         INSERT INTO students (id, tenant_id, user_id, department_id, batch_id, roll_number, active_backlogs, backlog_history, gap_years, diploma_flag, placement_status, updated_at)
         SELECT gen_random_uuid()::text, $1, n.user_id,
                ($2::text[])[1 + (n.rn::int % 6)],
                $3, 'PERF' || n.rn, 0, 0, 0, false,
                (CASE WHEN n.rn % 3 = 0 THEN 'PLACED' ELSE 'UNPLACED' END)::"PlacementStatus",
                now()
         FROM numbered n`,
        [tenantId, deptIds, batchId],
      );

      // Give every third (PLACED) student an ACCEPTED offer so the CTC
      // aggregates aren't computed over an empty set.
      await client.query(
        `INSERT INTO offers (id, tenant_id, student_id, ctc_lpa, status, updated_at)
         SELECT gen_random_uuid()::text, $1, s.id, 6 + (row_number() OVER (ORDER BY s.id) % 15), 'ACCEPTED', now()
         FROM students s
         WHERE s.tenant_id = $1 AND s.batch_id = $2 AND s.placement_status = 'PLACED'`,
        [tenantId, batchId],
      );
    });

    await recomputeService.recomputeForBatch(tenantId, batchId);
  });

  afterAll(async () => {
    await withSuperuser(async (client) => {
      await client.query(
        `DELETE FROM placement_summaries WHERE batch_id = $1`,
        [batchId],
      );
      await client.query(
        `DELETE FROM offers WHERE student_id IN (SELECT id FROM students WHERE batch_id = $1)`,
        [batchId],
      );
      await client.query(`DELETE FROM students WHERE batch_id = $1`, [batchId]);
      await client.query(
        `DELETE FROM users WHERE tenant_id = $1 AND email LIKE 'perf-student-%'`,
        [tenantId],
      );
      await client.query(`DELETE FROM academic_batches WHERE id = $1`, [
        batchId,
      ]);
      await client.query(`DELETE FROM departments WHERE id = ANY($1)`, [
        deptIds,
      ]);
    });
    await app.close();
  });

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

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/sso/callback")
      .send({ tenantSlug: TENANT_SLUG, email })
      .expect(201);
    return res.body.accessToken as string;
  }

  it("GET /analytics/summary p95 < 400ms across 20 requests at 2000 students / 6 branches", async () => {
    const token = await loginAs("tpo@demo-college.edu");
    const durations: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      const start = performance.now();
      const res = await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${batchId}`)
        .set("Authorization", `Bearer ${token}`);
      durations.push(performance.now() - start);
      expect(res.status).toBe(200);
      expect(res.body.totalStudents).toBe(2000);
    }

    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95) - 1]!;
    // eslint-disable-next-line no-console
    console.log(
      `analytics summary p95: ${p95.toFixed(1)}ms (n=${durations.length})`,
    );
    expect(p95).toBeLessThan(400);
  });
});
