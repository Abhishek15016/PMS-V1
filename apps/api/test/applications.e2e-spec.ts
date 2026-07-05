import "dotenv/config";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Client } from "pg";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Exercises SP-20: applying (SELF/ON_BEHALF, debar block, eligibility block,
 * drive-status block, duplicate block), withdraw, shortlist, and the
 * round-result-driven Application status machine. Reuses the two seeded
 * students (CSE/ECE) freely across tests since Application uniqueness is
 * per (student, drive) and each test creates its own fresh drive — the only
 * exception is the debar test, which needs a dedicated student whose
 * placementStatus is DEBARRED (set via the superuser connection, since no
 * API surface sets that directly in this slice).
 */
describe("Applications & round-progression (e2e)", () => {
  let app: INestApplication;
  const TENANT_SLUG = "demo-college";
  const SUPERUSER_URL = process.env.MIGRATION_DATABASE_URL!;

  let tenantId: string;
  let cseStudentId: string;
  let eceStudentId: string;
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

      const ece = await client.query(
        `SELECT id FROM students WHERE tenant_id = $1 AND roll_number = 'ECE2022001'`,
        [tenantId],
      );
      eceStudentId = ece.rows[0].id;

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
  });

  afterAll(async () => {
    await withSuperuser(async (client) => {
      const testStudentIds = `(SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE u.tenant_id = $1 AND u.email LIKE 'apps-test-%')`;
      await client.query(
        `DELETE FROM round_results WHERE application_id IN (SELECT id FROM applications WHERE student_id IN ${testStudentIds})`,
        [tenantId],
      );
      await client.query(
        `DELETE FROM applications WHERE student_id IN ${testStudentIds}`,
        [tenantId],
      );
      await client.query(
        `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1 AND email LIKE 'apps-test-%')`,
        [tenantId],
      );
      await client.query(`DELETE FROM students WHERE id IN ${testStudentIds}`, [
        tenantId,
      ]);
      await client.query(
        `DELETE FROM users WHERE tenant_id = $1 AND email LIKE 'apps-test-%'`,
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

  async function ownCompanyId(recruiterToken: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get("/companies")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .expect(200);
    return res.body[0].id;
  }

  async function createOpenDrive(
    tpoToken: string,
    companyId: string,
    title: string,
    minCriteria: Record<string, unknown> = {},
    status: "SCHEDULED" | "DRAFT" = "SCHEDULED",
  ): Promise<{ jdId: string; driveId: string }> {
    const jd = await request(app.getHttpServer())
      .post("/job-descriptions")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        companyId,
        title,
        ctcLpa: 8,
        eligiblePrograms: ["CSE", "ECE"],
        minCriteria,
      })
      .expect(201);
    const drive = await request(app.getHttpServer())
      .post("/drives")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ jdId: jd.body.id, status })
      .expect(201);
    return { jdId: jd.body.id, driveId: drive.body.id };
  }

  async function addRound(
    tpoToken: string,
    driveId: string,
    position: number,
  ): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/drives/${driveId}/rounds`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ type: "TECHNICAL", position })
      .expect(201);
    return res.body.id;
  }

  /** A dedicated student per scenario that needs isolated placement/debar state. */
  async function createTestStudent(
    overrides: { placementStatus?: string; activeBacklogs?: number } = {},
  ): Promise<{ id: string; email: string }> {
    testStudentCounter += 1;
    const rollNumber = `APPTEST${testStudentCounter.toString().padStart(4, "0")}`;
    const email = `apps-test-${rollNumber.toLowerCase()}@demo-college.local`;
    const id = await withSuperuser(async (client) => {
      const user = await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, status, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'STUDENT', 'stub', 'ACTIVE', now())
         RETURNING id`,
        [tenantId, email, `App Test Student ${testStudentCounter}`],
      );
      const student = await client.query(
        `INSERT INTO students (id, tenant_id, user_id, department_id, batch_id, roll_number, cgpa, active_backlogs, backlog_history, gap_years, diploma_flag, placement_status, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 9.0, $6, 0, 0, false, $7, now())
         RETURNING id`,
        [
          tenantId,
          user.rows[0].id,
          cseDeptId,
          batchId,
          rollNumber,
          overrides.activeBacklogs ?? 0,
          overrides.placementStatus ?? "UNPLACED",
        ],
      );
      return student.rows[0].id as string;
    });
    return { id, email };
  }

  describe("apply", () => {
    it("an eligible student (SELF) can apply to an open drive", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Apply Basic Role",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      const created = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);
      expect(created.body.status).toBe("APPLIED");
    });

    it("an ineligible student is blocked from applying", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Strict Criteria Role",
        { maxActiveBacklogs: 0 },
      );

      // ECE seed student has 1 active backlog.
      const studentToken = await loginAs("student2.ece@demo-college.edu");
      await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(403);
    });

    it("cannot apply twice to the same drive", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Duplicate Apply Role",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);
      await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(409);
    });

    it("cannot apply to a drive that isn't SCHEDULED/ONGOING", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Draft Drive Role",
        {},
        "DRAFT",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(409);
    });

    it("TPO (ON_BEHALF) can apply for any student", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "TPO On Behalf Role",
      );

      const created = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ driveId, studentId: cseStudentId })
        .expect(201);
      expect(created.body.status).toBe("APPLIED");
    });

    it("Faculty Coordinator (ON_BEHALF) can only apply for students in their own department", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Faculty On Behalf Role",
      );

      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      // ECE student is outside the CSE Faculty Coordinator's department.
      await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ driveId, studentId: eceStudentId })
        .expect(403);

      const created = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ driveId, studentId: cseStudentId })
        .expect(201);
      expect(created.body.status).toBe("APPLIED");
    });

    it("a DEBARRED student is blocked from applying and the attempt is audit-logged", async () => {
      const { id: studentId, email } = await createTestStudent({
        placementStatus: "DEBARRED",
      });
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Debarred Apply Role",
      );

      const studentToken = await loginAs(email);
      await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(403);

      await withSuperuser(async (client) => {
        const events = await client.query(
          `SELECT action FROM audit_events WHERE tenant_id = $1 AND resource_id = $2 AND action = 'application.blocked.debarred'`,
          [tenantId, studentId],
        );
        expect(events.rows.length).toBeGreaterThan(0);
      });
    });
  });

  describe("withdraw", () => {
    it("a student can withdraw their own APPLIED application", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Withdraw Own Role",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      const withdrawn = await request(app.getHttpServer())
        .patch(`/applications/${application.body.id}/withdraw`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);
      expect(withdrawn.body.status).toBe("WITHDRAWN");
    });

    it("a student cannot withdraw another student's application", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Withdraw Cross Role",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      const otherStudentToken = await loginAs("student2.ece@demo-college.edu");
      await request(app.getHttpServer())
        .patch(`/applications/${application.body.id}/withdraw`)
        .set("Authorization", `Bearer ${otherStudentToken}`)
        .expect(403);
    });
  });

  describe("shortlist", () => {
    it("Recruiter can shortlist an APPLIED application for their own company's drive", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Shortlist Role",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      const shortlisted = await request(app.getHttpServer())
        .patch(`/applications/${application.body.id}/shortlist`)
        .set("Authorization", `Bearer ${recruiterToken}`)
        .expect(200);
      expect(shortlisted.body.status).toBe("SHORTLISTED");
    });

    it("Recruiter cannot shortlist an application for another company's drive", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const otherCompany = await request(app.getHttpServer())
        .post("/companies")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ name: "Other Shortlist Co" })
        .expect(201);
      const { driveId } = await createOpenDrive(
        tpoToken,
        otherCompany.body.id,
        "Other Co Shortlist Role",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      await request(app.getHttpServer())
        .patch(`/applications/${application.body.id}/shortlist`)
        .set("Authorization", `Bearer ${recruiterToken}`)
        .expect(403);
    });
  });

  describe("round-result-driven status progression", () => {
    it("PASS on a non-final round -> IN_ROUND; PASS on the final round -> SELECTED", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Two Round Pipeline Role",
      );
      const round1 = await addRound(tpoToken, driveId, 1);
      const round2 = await addRound(tpoToken, driveId, 2);

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      const afterRound1 = await request(app.getHttpServer())
        .post(`/applications/${application.body.id}/round-results`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ roundId: round1, status: "PASS", score: 80 })
        .expect(201);
      expect(afterRound1.body.status).toBe("PASS");

      let applicationRow = await request(app.getHttpServer())
        .get(`/applications/${application.body.id}`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(200);
      expect(applicationRow.body.status).toBe("IN_ROUND");

      await request(app.getHttpServer())
        .post(`/applications/${application.body.id}/round-results`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ roundId: round2, status: "PASS", score: 90 })
        .expect(201);

      applicationRow = await request(app.getHttpServer())
        .get(`/applications/${application.body.id}`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(200);
      expect(applicationRow.body.status).toBe("SELECTED");
    });

    it("FAIL on any round -> REJECTED", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Fail Round Role",
      );
      const round1 = await addRound(tpoToken, driveId, 1);

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/applications/${application.body.id}/round-results`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ roundId: round1, status: "FAIL" })
        .expect(201);

      const applicationRow = await request(app.getHttpServer())
        .get(`/applications/${application.body.id}`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(200);
      expect(applicationRow.body.status).toBe("REJECTED");
    });

    it("cannot record a round result for a withdrawn application", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Withdrawn Round Role",
      );
      const round1 = await addRound(tpoToken, driveId, 1);

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/applications/${application.body.id}/withdraw`)
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/applications/${application.body.id}/round-results`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ roundId: round1, status: "PASS" })
        .expect(409);
    });

    it("Faculty Coordinator (PROPOSE scope on drives.manage) cannot record round results", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "Faculty Round Role",
      );
      const round1 = await addRound(tpoToken, driveId, 1);

      const studentToken = await loginAs("student@demo-college.edu");
      const application = await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      await request(app.getHttpServer())
        .post(`/applications/${application.body.id}/round-results`)
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ roundId: round1, status: "PASS" })
        .expect(403);
    });
  });

  describe("list scoping", () => {
    it("a student's application list is scoped to their own applications", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companyId = await ownCompanyId(recruiterToken);
      const { driveId } = await createOpenDrive(
        tpoToken,
        companyId,
        "List Scope Student Role",
      );

      const studentToken = await loginAs("student@demo-college.edu");
      await request(app.getHttpServer())
        .post("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .send({ driveId })
        .expect(201);

      const list = await request(app.getHttpServer())
        .get("/applications")
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(200);
      expect(list.body.length).toBeGreaterThan(0);
      expect(
        list.body.every(
          (a: { student: { id: string } }) => a.student.id === cseStudentId,
        ),
      ).toBe(true);
    });

    it("Faculty Coordinator's application list is scoped to their own department", async () => {
      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      const list = await request(app.getHttpServer())
        .get("/applications")
        .set("Authorization", `Bearer ${facultyToken}`)
        .expect(200);
      expect(
        list.body.every(
          (a: { student: { departmentId: string } }) =>
            a.student.departmentId === cseDeptId,
        ),
      ).toBe(true);
    });
  });
});
