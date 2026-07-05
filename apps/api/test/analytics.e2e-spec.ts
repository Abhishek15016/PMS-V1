import "dotenv/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { SummaryRecomputeService } from "../src/modules/analytics/summary-recompute.service";

/**
 * Exercises SP-24 backend pt.2: role-scoped /analytics/summary (all 4
 * shapes: FULL, DEPARTMENT, STUDENT, RECRUITER), /analytics/drilldown
 * (KPI<->list parity, SELF-scoped roles blocked), /analytics/yoy (with and
 * without prior-year data), the divide-by-zero placementPercent guard, and
 * ETag/304 conditional-GET behavior. Uses a dedicated fresh batch (fixture
 * data inserted directly, then recomputed via SummaryRecomputeService
 * directly rather than through the debounced event pipeline — that wiring
 * is already proven in analytics-recompute.e2e-spec.ts; this suite is about
 * the read API surface).
 */
describe("Analytics API (e2e)", () => {
  let app: INestApplication;
  let recomputeService: SummaryRecomputeService;
  const TENANT_SLUG = "demo-college";
  const SUPERUSER_URL = process.env.MIGRATION_DATABASE_URL!;

  let tenantId: string;
  let cseDeptId: string;
  let eceDeptId: string;
  let batchId: string;
  let emptyBatchId: string;
  /** Set by the YoY "prior year exists" test; cleaned up unconditionally in afterAll (not inline in the test body) so a failed assertion can't skip cleanup and leak into the next run. */
  let priorBatchId: string | null = null;
  const createdStudentIds: string[] = [];
  const createdUserEmails: string[] = [];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    recomputeService = app.get(SummaryRecomputeService);

    await withSuperuser(async (client) => {
      const inst = await client.query(
        `SELECT id FROM institutions WHERE slug = $1`,
        [TENANT_SLUG],
      );
      tenantId = inst.rows[0].id;

      const cse = await client.query(
        `SELECT id FROM departments WHERE tenant_id = $1 AND code = 'CSE'`,
        [tenantId],
      );
      cseDeptId = cse.rows[0].id;
      const ece = await client.query(
        `SELECT id FROM departments WHERE tenant_id = $1 AND code = 'ECE'`,
        [tenantId],
      );
      eceDeptId = ece.rows[0].id;

      const batch = await client.query(
        `INSERT INTO academic_batches (id, tenant_id, label, start_year, end_year, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, 2019, 2023, now())
         RETURNING id`,
        [tenantId, `analytics-api-${Date.now()}`],
      );
      batchId = batch.rows[0].id;

      const emptyBatch = await client.query(
        `INSERT INTO academic_batches (id, tenant_id, label, start_year, end_year, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, 2001, 2005, now())
         RETURNING id`,
        [tenantId, `analytics-api-empty-${Date.now()}`],
      );
      emptyBatchId = emptyBatch.rows[0].id;

      // 2 CSE students (1 placed at 10 LPA), 1 ECE student (unplaced).
      const fixtures: Array<{
        dept: string;
        roll: string;
        placed: boolean;
        ctc?: number;
      }> = [
        { dept: cseDeptId, roll: "AAPI0001", placed: true, ctc: 10 },
        { dept: cseDeptId, roll: "AAPI0002", placed: false },
        { dept: eceDeptId, roll: "AAPI0003", placed: false },
      ];
      for (const fixture of fixtures) {
        const email = `analytics-api-${fixture.roll}@demo-college.local`;
        createdUserEmails.push(email);
        const user = await client.query(
          `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, status, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, 'STUDENT', 'stub', 'ACTIVE', now())
           RETURNING id`,
          [tenantId, email, `Analytics API ${fixture.roll}`],
        );
        const student = await client.query(
          `INSERT INTO students (id, tenant_id, user_id, department_id, batch_id, roll_number, active_backlogs, backlog_history, gap_years, diploma_flag, placement_status, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 0, 0, 0, false, $6, now())
           RETURNING id`,
          [
            tenantId,
            user.rows[0].id,
            fixture.dept,
            batchId,
            fixture.roll,
            fixture.placed ? "PLACED" : "UNPLACED",
          ],
        );
        const studentId = student.rows[0].id as string;
        createdStudentIds.push(studentId);
        if (fixture.placed) {
          await client.query(
            `INSERT INTO offers (id, tenant_id, student_id, ctc_lpa, status, updated_at)
             VALUES (gen_random_uuid()::text, $1, $2, $3, 'ACCEPTED', now())`,
            [tenantId, studentId, fixture.ctc],
          );
        }
      }
    });

    await recomputeService.recomputeForBatch(tenantId, batchId);
    await recomputeService.recomputeForBatch(tenantId, emptyBatchId);
  });

  afterAll(async () => {
    await withSuperuser(async (client) => {
      await client.query(
        `DELETE FROM placement_summaries WHERE batch_id IN ($1, $2)`,
        [batchId, emptyBatchId],
      );
      await client.query(`DELETE FROM offers WHERE student_id = ANY($1)`, [
        createdStudentIds,
      ]);
      await client.query(
        `DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM students WHERE id = ANY($1))`,
        [createdStudentIds],
      );
      await client.query(`DELETE FROM students WHERE id = ANY($1)`, [
        createdStudentIds,
      ]);
      await client.query(
        `DELETE FROM users WHERE tenant_id = $1 AND email = ANY($2)`,
        [tenantId, createdUserEmails],
      );
      await client.query(`DELETE FROM academic_batches WHERE id IN ($1, $2)`, [
        batchId,
        emptyBatchId,
      ]);
      if (priorBatchId) {
        await client.query(
          `DELETE FROM placement_summaries WHERE batch_id = $1`,
          [priorBatchId],
        );
        await client.query(`DELETE FROM academic_batches WHERE id = $1`, [
          priorBatchId,
        ]);
      }
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

  describe("summary — role shapes", () => {
    it("FULL (TPO): tenant-wide summary across both departments", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${batchId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.scope).toBe("FULL");
      expect(res.body.totalStudents).toBe(3);
      expect(res.body.placedCount).toBe(1);
      expect(res.body.placementPercent).toBeCloseTo((1 / 3) * 100, 5);
      expect(res.body.highestCtc).toBe(10);
    });

    it("FULL (TPO) scoped to a specific department via query param", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${batchId}&departmentId=${cseDeptId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalStudents).toBe(2);
      expect(res.body.placedCount).toBe(1);
    });

    it("DEPARTMENT (Faculty Coordinator, CSE): forced to own department regardless of query param", async () => {
      const token = await loginAs("faculty.cse@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${batchId}&departmentId=${eceDeptId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.scope).toBe("DEPARTMENT");
      expect(res.body.departmentId).toBe(cseDeptId);
      expect(res.body.totalStudents).toBe(2);
    });

    it("STUDENT: resolves own batch+department, ignoring any query param", async () => {
      const token = await loginAs("analytics-api-AAPI0001@demo-college.local");
      const res = await request(app.getHttpServer())
        .get(
          `/analytics/summary?batchId=some-other-batch&departmentId=${eceDeptId}`,
        )
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.scope).toBe("STUDENT");
      expect(res.body.departmentId).toBe(cseDeptId);
      expect(res.body.totalStudents).toBe(2);
    });

    it("RECRUITER: a distinct company-scoped shape, not the batch-based summary", async () => {
      const token = await loginAs("recruiter@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get("/analytics/summary")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.scope).toBe("RECRUITER");
      expect(res.body).toHaveProperty("companyId");
      expect(res.body).toHaveProperty("offersAccepted");
      expect(res.body.totalStudents).toBeUndefined();
    });

    it("FULL without a batchId is rejected", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      await request(app.getHttpServer())
        .get("/analytics/summary")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("divide-by-zero: an empty batch reports null placementPercent, not NaN/Infinity", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${emptyBatchId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.totalStudents).toBe(0);
      expect(res.body.placementPercent).toBeNull();
      expect(res.body.highestCtc).toBeNull();
    });
  });

  describe("ETag / conditional GET", () => {
    it("a repeat request with a matching If-None-Match returns 304", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const first = await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${batchId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      const etag = first.headers.etag;
      expect(etag).toBeDefined();

      await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${batchId}`)
        .set("Authorization", `Bearer ${token}`)
        .set("If-None-Match", etag as string)
        .expect(304);
    });
  });

  describe("drilldown — KPI<->list parity, SELF-scope blocked", () => {
    it("the 'placed' drilldown list length equals summary.placedCount", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const summary = await request(app.getHttpServer())
        .get(`/analytics/summary?batchId=${batchId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const drilldown = await request(app.getHttpServer())
        .get(`/analytics/drilldown?batchId=${batchId}&metric=placed`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(drilldown.body).toHaveLength(summary.body.placedCount);
      expect(drilldown.body[0].placementStatus).toBe("PLACED");
    });

    it("the 'accepted-offers' drilldown reuses the same ACCEPTED predicate the CTC KPIs are built on", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get(`/analytics/drilldown?batchId=${batchId}&metric=accepted-offers`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].ctcLpa).toBe(10);
    });

    it("STUDENT (SELF scope) cannot access drilldown", async () => {
      const token = await loginAs("analytics-api-AAPI0001@demo-college.local");
      await request(app.getHttpServer())
        .get(`/analytics/drilldown?batchId=${batchId}&metric=placed`)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("RECRUITER (SELF scope) cannot access drilldown", async () => {
      const token = await loginAs("recruiter@demo-college.edu");
      await request(app.getHttpServer())
        .get(`/analytics/drilldown?batchId=${batchId}&metric=placed`)
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });
  });

  describe("year-over-year", () => {
    it("degrades to previous: null and null deltas when there's no prior-year batch", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get(`/analytics/yoy?batchId=${batchId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.current.totalStudents).toBe(3);
      expect(res.body.previous).toBeNull();
      expect(res.body.placementPercentDelta).toBeNull();
    });

    it("computes deltas correctly when a prior-year (startYear - 1) batch exists", async () => {
      priorBatchId = await withSuperuser(async (client) => {
        const dept = cseDeptId;
        const batch = await client.query(
          `INSERT INTO academic_batches (id, tenant_id, label, start_year, end_year, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, 2018, 2022, now())
           RETURNING id`,
          [tenantId, `analytics-api-prior-${Date.now()}`],
        );
        const id = batch.rows[0].id as string;

        const email = `analytics-api-prior-student@demo-college.local`;
        const user = await client.query(
          `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, status, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, 'Prior Year Student', 'STUDENT', 'stub', 'ACTIVE', now())
           RETURNING id`,
          [tenantId, email],
        );
        const student = await client.query(
          `INSERT INTO students (id, tenant_id, user_id, department_id, batch_id, roll_number, active_backlogs, backlog_history, gap_years, diploma_flag, placement_status, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'AAPIPRIOR', 0, 0, 0, false, 'UNPLACED', now())
           RETURNING id`,
          [tenantId, user.rows[0].id, dept, id],
        );
        createdStudentIds.push(student.rows[0].id);
        createdUserEmails.push(email);
        return id;
      });

      // batchId has startYear=2019; this new batch has startYear=2018 -> the adjacency rule picks it up.
      await recomputeService.recomputeForBatch(tenantId, priorBatchId);

      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get(`/analytics/yoy?batchId=${batchId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.previous).not.toBeNull();
      expect(res.body.previous.totalStudents).toBe(1);
      expect(res.body.previous.placementPercent).toBe(0);
      expect(res.body.placementPercentDelta).toBeCloseTo((1 / 3) * 100 - 0, 5);
    });
  });

  describe("filter options & upcoming drives", () => {
    it("FULL (TPO) gets the batch/department lists for the filter bar", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get("/analytics/filter-options")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(
        res.body.batches.some((b: { id: string }) => b.id === batchId),
      ).toBe(true);
      expect(
        res.body.departments.some((d: { id: string }) => d.id === cseDeptId),
      ).toBe(true);
    });

    it("STUDENT (SELF scope) cannot access filter-options or upcoming-drives", async () => {
      const token = await loginAs("analytics-api-AAPI0001@demo-college.local");
      await request(app.getHttpServer())
        .get("/analytics/filter-options")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
      await request(app.getHttpServer())
        .get("/analytics/upcoming-drives")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("FULL (TPO) gets the upcoming drives list, soonest first", async () => {
      const token = await loginAs("tpo@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get("/analytics/upcoming-drives")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 1) {
        const dates = res.body
          .map((d: { scheduledAt: string | null }) => d.scheduledAt)
          .filter((d: string | null): d is string => d !== null);
        const sorted = [...dates].sort();
        expect(dates).toEqual(sorted);
      }
    });
  });
});
