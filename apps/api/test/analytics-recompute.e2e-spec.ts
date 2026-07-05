import "dotenv/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Proves the domain-event -> debounced-BullMQ-job -> PlacementSummary wiring
 * end-to-end, with a real Nest app (so the BullMQ worker is actually
 * running), real Redis, and real Postgres. The SQL math itself is proven
 * separately in summary-recompute.service.spec.ts; this test only cares
 * whether accepting an offer through the real HTTP API eventually produces
 * an up-to-date PlacementSummary row, with no manual recompute call.
 */
describe("Analytics: event -> debounced recompute (e2e)", () => {
  let app: INestApplication;
  const TENANT_SLUG = "demo-college";
  const SUPERUSER_URL = process.env.MIGRATION_DATABASE_URL!;

  let tenantId: string;
  let batchId: string;
  let studentId: string;
  let studentEmail: string;

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

    await withSuperuser(async (client) => {
      const inst = await client.query(
        `SELECT id FROM institutions WHERE slug = $1`,
        [TENANT_SLUG],
      );
      tenantId = inst.rows[0].id;

      const dept = await client.query(
        `SELECT id FROM departments WHERE tenant_id = $1 AND code = 'CSE'`,
        [tenantId],
      );
      const departmentId = dept.rows[0].id;

      const batch = await client.query(
        `INSERT INTO academic_batches (id, tenant_id, label, start_year, end_year, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, 2021, 2025, now())
         RETURNING id`,
        [tenantId, `recompute-e2e-${Date.now()}`],
      );
      batchId = batch.rows[0].id;

      studentEmail = `recompute-e2e-${batchId}@demo-college.local`;
      const user = await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, status, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, 'Recompute E2E Student', 'STUDENT', 'stub', 'ACTIVE', now())
         RETURNING id`,
        [tenantId, studentEmail],
      );
      const student = await client.query(
        `INSERT INTO students (id, tenant_id, user_id, department_id, batch_id, roll_number, active_backlogs, backlog_history, gap_years, diploma_flag, placement_status, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'RCPTE2E1', 0, 0, 0, false, 'UNPLACED', now())
         RETURNING id`,
        [tenantId, user.rows[0].id, departmentId, batchId],
      );
      studentId = student.rows[0].id;
    });
  });

  afterAll(async () => {
    await withSuperuser(async (client) => {
      await client.query(
        `DELETE FROM placement_summaries WHERE batch_id = $1`,
        [batchId],
      );
      await client.query(`DELETE FROM offers WHERE student_id = $1`, [
        studentId,
      ]);
      await client.query(
        `DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM students WHERE id = $1)`,
        [studentId],
      );
      await client.query(`DELETE FROM students WHERE id = $1`, [studentId]);
      await client.query(
        `DELETE FROM users WHERE tenant_id = $1 AND email = $2`,
        [tenantId, studentEmail],
      );
      await client.query(`DELETE FROM academic_batches WHERE id = $1`, [
        batchId,
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

  async function waitForSummary(
    predicate: (
      row: { placed_count: number; highest_ctc: string | null } | undefined,
    ) => boolean,
    timeoutMs = 8000,
  ): Promise<{ placed_count: number; highest_ctc: string | null } | undefined> {
    const deadline = Date.now() + timeoutMs;
    let row: { placed_count: number; highest_ctc: string | null } | undefined;
    while (Date.now() < deadline) {
      row = await withSuperuser(async (client) => {
        const res = await client.query(
          `SELECT placed_count, highest_ctc FROM placement_summaries WHERE tenant_id = $1 AND batch_id = $2 AND department_id IS NULL`,
          [tenantId, batchId],
        );
        return res.rows[0];
      });
      if (predicate(row)) return row;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return row;
  }

  it("accepting an offer via the real API eventually produces a PlacementSummary row with no manual recompute call", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");

    const created = await request(app.getHttpServer())
      .post("/offers/ppo")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        studentId,
        sourceInternshipId: "recompute-e2e-intern",
        ctcLpa: 9,
      })
      .expect(201);

    const studentToken = await loginAs(studentEmail);
    await request(app.getHttpServer())
      .post(`/offers/${created.body.id}/accept`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(201);

    const row = await waitForSummary((r) => r?.placed_count === 1);
    expect(row).toBeDefined();
    expect(row!.placed_count).toBe(1);
    expect(Number(row!.highest_ctc)).toBe(9);
  });
});
