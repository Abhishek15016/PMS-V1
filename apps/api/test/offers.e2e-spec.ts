import "dotenv/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Exercises SP-18's offer state machine: propose->approve->extend,
 * row-locked transactional accept/reject/revoke, the SP-17 cap/re-eligibility
 * gate actually blocking illegal transitions end-to-end through the API, and
 * DEBAR_RULE auto-debar on rejection. Applications aren't a module yet
 * (SP-20), so this test creates Application fixture rows directly via the
 * superuser connection — the same pattern tenant-prisma.service.spec.ts uses
 * for RLS-blocked fixture setup — while everything under test (offers
 * themselves) goes through the real HTTP API.
 *
 * Each scenario that leaves an offer EXTENDED/ACCEPTED uses its own
 * freshly-created student (createTestStudent) rather than the two shared
 * seed students, so cap/re-eligibility state from one test can never leak
 * into another.
 */
describe("Offers state machine (e2e)", () => {
  let app: INestApplication;
  const TENANT_SLUG = "demo-college";
  const SUPERUSER_URL = process.env.MIGRATION_DATABASE_URL!;

  let tenantId: string;
  let cseStudentId: string;
  let cseDeptId: string;
  let batchId: string;
  let testStudentCounter = 0;

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

      const cse = await client.query(
        `SELECT id FROM students WHERE tenant_id = $1 AND roll_number = 'CSE2022001'`,
        [tenantId],
      );
      cseStudentId = cse.rows[0].id;

      const dept = await client.query(
        `SELECT id FROM departments WHERE tenant_id = $1 AND code = 'CSE'`,
        [tenantId],
      );
      cseDeptId = dept.rows[0].id;

      const batch = await client.query(
        `SELECT id FROM academic_batches WHERE tenant_id = $1 LIMIT 1`,
        [tenantId],
      );
      batchId = batch.rows[0].id;
    });

    const tpoToken = await loginAs("tpo@demo-college.edu");
    // superDreamMinCtc=10, dreamMinCtc=20 for every offer created below.
    await activatePolicy(
      tpoToken,
      "SLAB_DEFINITION",
      "institution-default-slab-definition",
      {
        superDreamMinCtc: 10,
        dreamMinCtc: 20,
      },
    );
  });

  afterAll(async () => {
    await withSuperuser(async (client) => {
      // Keyed off users.email throughout (not students.roll_number) so this
      // also sweeps up any stray fixture rows left behind by an earlier
      // interrupted run that used a different roll-number scheme.
      const testStudentIds = `(SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.tenant_id = $1 AND u.email LIKE 'offers-test-%')`;
      await client.query(
        `DELETE FROM offers WHERE student_id IN ${testStudentIds}`,
        [tenantId],
      );
      await client.query(
        `DELETE FROM applications WHERE student_id IN ${testStudentIds}`,
        [tenantId],
      );
      await client.query(
        `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1 AND email LIKE 'offers-test-%')`,
        [tenantId],
      );
      await client.query(`DELETE FROM students WHERE id IN ${testStudentIds}`, [
        tenantId,
      ]);
      await client.query(
        `DELETE FROM users WHERE tenant_id = $1 AND email LIKE 'offers-test-%'`,
        [tenantId],
      );
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

  async function activatePolicy(
    tpoToken: string,
    type: string,
    name: string,
    definition: Record<string, unknown>,
  ): Promise<void> {
    const rule = await request(app.getHttpServer())
      .post("/policy-rules")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ type, name, definition })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/policy-rules/${rule.body.id}/activate`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);
  }

  async function createJdAndDrive(
    tpoToken: string,
    companyId: string,
    title: string,
    ctcLpa: number,
  ): Promise<{ jdId: string; driveId: string }> {
    const jd = await request(app.getHttpServer())
      .post("/job-descriptions")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        companyId,
        title,
        ctcLpa,
        eligiblePrograms: ["CSE", "ECE"],
        minCriteria: {},
      })
      .expect(201);
    const drive = await request(app.getHttpServer())
      .post("/drives")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ jdId: jd.body.id, status: "SCHEDULED" })
      .expect(201);
    return { jdId: jd.body.id, driveId: drive.body.id };
  }

  async function insertApplication(
    studentId: string,
    driveId: string,
  ): Promise<string> {
    return withSuperuser(async (client) => {
      const res = await client.query(
        `INSERT INTO applications (id, tenant_id, student_id, drive_id, status, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'APPLIED', now())
         RETURNING id`,
        [tenantId, studentId, driveId],
      );
      return res.rows[0].id as string;
    });
  }

  async function ownCompanyId(recruiterToken: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get("/companies")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .expect(200);
    return res.body[0].id;
  }

  /** A dedicated CSE student per scenario that leaves an offer EXTENDED/ACCEPTED, so cap state never leaks across tests. */
  async function createTestStudent(): Promise<{ id: string; email: string }> {
    testStudentCounter += 1;
    const rollNumber = `TESTSTU${testStudentCounter.toString().padStart(4, "0")}`;
    const email = `offers-test-${rollNumber.toLowerCase()}@demo-college.local`;
    const id = await withSuperuser(async (client) => {
      const user = await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, status, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'STUDENT', 'stub', 'ACTIVE', now())
         RETURNING id`,
        [tenantId, email, `Test Student ${testStudentCounter}`],
      );
      const student = await client.query(
        `INSERT INTO students (id, tenant_id, user_id, department_id, batch_id, roll_number, cgpa, active_backlogs, backlog_history, gap_years, diploma_flag, placement_status, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 9.0, 0, 0, 0, false, 'UNPLACED', now())
         RETURNING id`,
        [tenantId, user.rows[0].id, cseDeptId, batchId, rollNumber],
      );
      return student.rows[0].id as string;
    });
    return { id, email };
  }

  it("Recruiter (PROPOSE) creating an offer lands it as PENDING; TPO approval extends it, running the cap gate", async () => {
    const { id: studentId } = await createTestStudent();
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);
    const { driveId } = await createJdAndDrive(
      tpoToken,
      companyId,
      "Pending Flow Role",
      12,
    );
    const applicationId = await insertApplication(studentId, driveId);

    const created = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ applicationId, ctcLpa: 12 })
      .expect(201);
    expect(created.body.status).toBe("PENDING");
    expect(created.body.slab).toBe("SUPER_DREAM");

    const approved = await request(app.getHttpServer())
      .post(`/offers/${created.body.id}/approve`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);
    expect(approved.body.status).toBe("EXTENDED");
  });

  it("TPO (FULL) creates an offer directly as EXTENDED, no approval step needed", async () => {
    const { id: studentId } = await createTestStudent();
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);
    const { driveId } = await createJdAndDrive(
      tpoToken,
      companyId,
      "Direct Extend Role",
      6,
    );
    const applicationId = await insertApplication(studentId, driveId);

    const created = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ applicationId, ctcLpa: 6 })
      .expect(201);
    expect(created.body.status).toBe("EXTENDED");
    expect(created.body.slab).toBe("NON_DREAM");
  });

  it("Recruiter cannot create an offer for another company's application", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const otherCompany = await request(app.getHttpServer())
      .post("/companies")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ name: "Other Offer Co" })
      .expect(201);
    const { driveId } = await createJdAndDrive(
      tpoToken,
      otherCompany.body.id,
      "Other Co Role",
      8,
    );
    const applicationId = await insertApplication(cseStudentId, driveId);

    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ applicationId, ctcLpa: 8 })
      .expect(403);
  });

  it("accepting an EXTENDED offer sets ACCEPTED and marks the student PLACED; a same-tier offer is then blocked by the cap; an upward transition is allowed", async () => {
    const { id: studentId, email } = await createTestStudent();
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);

    const first = await createJdAndDrive(
      tpoToken,
      companyId,
      "Accept Flow Role A",
      12,
    );
    const app1 = await insertApplication(studentId, first.driveId);
    const offer1 = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ applicationId: app1, ctcLpa: 12 })
      .expect(201);
    expect(offer1.body.slab).toBe("SUPER_DREAM");

    const studentToken = await loginAs(email);
    const accepted = await request(app.getHttpServer())
      .post(`/offers/${offer1.body.id}/accept`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(201);
    expect(accepted.body.status).toBe("ACCEPTED");

    const studentRow = await request(app.getHttpServer())
      .get(`/students/${studentId}`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(studentRow.body.placementStatus).toBe("PLACED");

    // Same tier (SUPER_DREAM) offer to the same student must be blocked by the cap.
    const second = await createJdAndDrive(
      tpoToken,
      companyId,
      "Accept Flow Role B",
      15,
    );
    const app2 = await insertApplication(studentId, second.driveId);
    await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ applicationId: app2, ctcLpa: 15 })
      .expect(409);

    // Upward transition (DREAM) is allowed by the default re-eligibility policy.
    const third = await createJdAndDrive(
      tpoToken,
      companyId,
      "Accept Flow Role C",
      25,
    );
    const app3 = await insertApplication(studentId, third.driveId);
    const offer3 = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ applicationId: app3, ctcLpa: 25 })
      .expect(201);
    expect(offer3.body.slab).toBe("DREAM");
    await request(app.getHttpServer())
      .post(`/offers/${offer3.body.id}/accept`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(201);
  });

  it("a student cannot accept another student's offer", async () => {
    const { id: studentId } = await createTestStudent();
    const { email: wrongEmail } = await createTestStudent();
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);
    const { driveId } = await createJdAndDrive(
      tpoToken,
      companyId,
      "Cross Student Role",
      6,
    );
    const applicationId = await insertApplication(studentId, driveId);
    const offer = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ applicationId, ctcLpa: 6 })
      .expect(201);

    const wrongStudentToken = await loginAs(wrongEmail);
    await request(app.getHttpServer())
      .post(`/offers/${offer.body.id}/accept`)
      .set("Authorization", `Bearer ${wrongStudentToken}`)
      .expect(403);
  });

  it("revoking an ACCEPTED offer reverts the student to UNPLACED when no other accepted offer remains", async () => {
    const { id: studentId, email } = await createTestStudent();
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);
    const { driveId } = await createJdAndDrive(
      tpoToken,
      companyId,
      "Revoke Flow Role",
      6,
    );
    const applicationId = await insertApplication(studentId, driveId);
    const offer = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ applicationId, ctcLpa: 6 })
      .expect(201);

    const studentToken = await loginAs(email);
    await request(app.getHttpServer())
      .post(`/offers/${offer.body.id}/accept`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(201);

    let studentRow = await request(app.getHttpServer())
      .get(`/students/${studentId}`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(studentRow.body.placementStatus).toBe("PLACED");

    await request(app.getHttpServer())
      .post(`/offers/${offer.body.id}/revoke`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);

    studentRow = await request(app.getHttpServer())
      .get(`/students/${studentId}`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(studentRow.body.placementStatus).toBe("UNPLACED");
  });

  it("rejecting an offer under an active DEBAR_RULE policy auto-debars the student and logs an audit event", async () => {
    const { id: studentId, email } = await createTestStudent();
    const tpoToken = await loginAs("tpo@demo-college.edu");
    await activatePolicy(
      tpoToken,
      "DEBAR_RULE",
      "institution-default-debar-rule",
      {
        debarOnOfferRejection: true,
        maxRejectionsBeforeDebar: 1,
      },
    );

    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);
    const { driveId } = await createJdAndDrive(
      tpoToken,
      companyId,
      "Debar Flow Role",
      5,
    );
    const applicationId = await insertApplication(studentId, driveId);
    const offer = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ applicationId, ctcLpa: 5 })
      .expect(201);

    const studentToken = await loginAs(email);
    const rejected = await request(app.getHttpServer())
      .post(`/offers/${offer.body.id}/reject`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(201);
    expect(rejected.body.status).toBe("REJECTED");

    const studentRow = await request(app.getHttpServer())
      .get(`/students/${studentId}`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(studentRow.body.placementStatus).toBe("DEBARRED");

    await withSuperuser(async (client) => {
      const events = await client.query(
        `SELECT action FROM audit_events WHERE tenant_id = $1 AND resource_id = $2 AND action = 'student.debarred'`,
        [tenantId, studentId],
      );
      expect(events.rows.length).toBeGreaterThan(0);
    });
  });

  it("concurrent approvals of two same-tier PENDING offers: exactly one wins, the other is blocked by the cap", async () => {
    // Two recruiter-proposed PENDING offers in the same tier legitimately
    // coexist (PENDING doesn't count against the cap). Approving both at
    // once is the real concurrency hazard the row lock guards: the second
    // approve() must see the first's now-EXTENDED state and fail closed.
    const { id: studentId } = await createTestStudent();
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);

    const roleA = await createJdAndDrive(
      tpoToken,
      companyId,
      "Race Role A",
      12,
    );
    const roleB = await createJdAndDrive(
      tpoToken,
      companyId,
      "Race Role B",
      13,
    );
    const appA = await insertApplication(studentId, roleA.driveId);
    const appB = await insertApplication(studentId, roleB.driveId);

    const offerA = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ applicationId: appA, ctcLpa: 12 })
      .expect(201);
    expect(offerA.body.status).toBe("PENDING");
    expect(offerA.body.slab).toBe("SUPER_DREAM");

    const offerB = await request(app.getHttpServer())
      .post("/offers")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({ applicationId: appB, ctcLpa: 13 })
      .expect(201);
    expect(offerB.body.status).toBe("PENDING");
    expect(offerB.body.slab).toBe("SUPER_DREAM");

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post(`/offers/${offerA.body.id}/approve`)
        .set("Authorization", `Bearer ${tpoToken}`),
      request(app.getHttpServer())
        .post(`/offers/${offerB.body.id}/approve`)
        .set("Authorization", `Bearer ${tpoToken}`),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  describe("PPOs (SP-19)", () => {
    it("TPO converts an internship into a PPO offer directly as EXTENDED, with no Application", async () => {
      const { id: studentId } = await createTestStudent();
      const tpoToken = await loginAs("tpo@demo-college.edu");

      const created = await request(app.getHttpServer())
        .post("/offers/ppo")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({
          studentId,
          sourceInternshipId: "intern-2026-summer-001",
          ctcLpa: 12,
        })
        .expect(201);

      expect(created.body.status).toBe("EXTENDED");
      expect(created.body.slab).toBe("SUPER_DREAM");
      expect(created.body.isPpo).toBe(true);
      expect(created.body.applicationId).toBeNull();
      expect(created.body.sourceInternshipId).toBe("intern-2026-summer-001");
    });

    it("Recruiter cannot create a PPO offer — there's no ownership chain to verify a self-reported internship claim against", async () => {
      const { id: studentId } = await createTestStudent();
      const recruiterToken = await loginAs("recruiter@demo-college.edu");

      await request(app.getHttpServer())
        .post("/offers/ppo")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({ studentId, sourceInternshipId: "intern-claim", ctcLpa: 12 })
        .expect(403);
    });

    it("a PPO offer counts against the slab cap exactly like a regular offer", async () => {
      const { id: studentId } = await createTestStudent();
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);

      await request(app.getHttpServer())
        .post("/offers/ppo")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ studentId, sourceInternshipId: "intern-cap-test", ctcLpa: 12 })
        .expect(201);

      const { driveId } = await createJdAndDrive(
        tpoToken,
        companyId,
        "PPO Cap Collision Role",
        14,
      );
      const applicationId = await insertApplication(studentId, driveId);
      await request(app.getHttpServer())
        .post("/offers")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ applicationId, ctcLpa: 14 })
        .expect(409);
    });

    it("a PPO offer flows through accept/reject/revoke exactly like a regular offer", async () => {
      const { id: studentId, email } = await createTestStudent();
      const tpoToken = await loginAs("tpo@demo-college.edu");

      const ppo = await request(app.getHttpServer())
        .post("/offers/ppo")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({
          studentId,
          sourceInternshipId: "intern-lifecycle-test",
          ctcLpa: 6,
        })
        .expect(201);

      const studentToken = await loginAs(email);
      const accepted = await request(app.getHttpServer())
        .post(`/offers/${ppo.body.id}/accept`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(201);
      expect(accepted.body.status).toBe("ACCEPTED");

      const studentRow = await request(app.getHttpServer())
        .get(`/students/${studentId}`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(200);
      expect(studentRow.body.placementStatus).toBe("PLACED");

      await request(app.getHttpServer())
        .post(`/offers/${ppo.body.id}/revoke`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(201);
    });
  });
});
