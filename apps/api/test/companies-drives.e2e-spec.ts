import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Exercises slice 8's thin CRUD (Companies, JobDescriptions, Drives+Rounds)
 * against the seeded demo-college fixtures (Acme Corp, its recruiter, its
 * "Software Engineer" JD and drive with a 3-round pipeline), proving the
 * companies.records / jd.shortlist / drives.manage scopes actually gate
 * access and ownership the way the permission matrix says they should.
 */
describe("Companies / JobDescriptions / Drives (e2e)", () => {
  let app: INestApplication;
  const TENANT_SLUG = "demo-college";

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
  });

  afterAll(async () => {
    await app.close();
  });

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/sso/callback")
      .send({ tenantSlug: TENANT_SLUG, email })
      .expect(201);
    return res.body.accessToken as string;
  }

  describe("Companies", () => {
    it("TPO can create a company; Recruiter (SELF scope) cannot", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const created = await request(app.getHttpServer())
        .post("/companies")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ name: "New Co", sector: "Finance" })
        .expect(201);
      expect(created.body.name).toBe("New Co");

      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      await request(app.getHttpServer())
        .post("/companies")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({ name: "Should Fail Co" })
        .expect(403);
    });

    it("Recruiter (SELF scope) only ever sees their own company in the list", async () => {
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get("/companies")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .expect(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe("Acme Corp");
    });

    it("Faculty Coordinator (VIEW scope) can list companies but cannot edit them", async () => {
      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      const list = await request(app.getHttpServer())
        .get("/companies")
        .set("Authorization", `Bearer ${facultyToken}`)
        .expect(200);
      expect(list.body.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .patch(`/companies/${list.body[0].id}`)
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ sector: "Hacked" })
        .expect(403);
    });
  });

  describe("Job Descriptions", () => {
    it("Recruiter can post a JD for their own company but not for another", async () => {
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const companiesRes = await request(app.getHttpServer())
        .get("/companies")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .expect(200);
      const ownCompanyId = companiesRes.body[0].id;

      const created = await request(app.getHttpServer())
        .post("/job-descriptions")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({
          companyId: ownCompanyId,
          title: "Backend Engineer",
          ctcLpa: 15,
          eligiblePrograms: ["CSE"],
          minCriteria: { cgpa: 7.5 },
        })
        .expect(201);
      expect(created.body.title).toBe("Backend Engineer");

      const tpoToken = await loginAs("tpo@demo-college.edu");
      const otherCompany = await request(app.getHttpServer())
        .post("/companies")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ name: "Other Co" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/job-descriptions")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({
          companyId: otherCompany.body.id,
          title: "Should Fail",
          ctcLpa: 10,
          eligiblePrograms: ["CSE"],
          minCriteria: {},
        })
        .expect(403);
    });

    it("Recruiter's JD list is scoped to their own company", async () => {
      const recruiterToken = await loginAs("recruiter@demo-college.edu");
      const res = await request(app.getHttpServer())
        .get("/job-descriptions")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      // "Should Fail" from the previous test must not appear, since it was
      // never created (403'd before reaching the DB) and belongs to another company anyway.
      expect(
        res.body.every((jd: { title: string }) => jd.title !== "Should Fail"),
      ).toBe(true);
    });

    it("Faculty Coordinator and Student have no access to job-descriptions (jd.shortlist = NONE)", async () => {
      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      await request(app.getHttpServer())
        .get("/job-descriptions")
        .set("Authorization", `Bearer ${facultyToken}`)
        .expect(403);

      const studentToken = await loginAs("student@demo-college.edu");
      await request(app.getHttpServer())
        .get("/job-descriptions")
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe("Drives + Rounds", () => {
    it("Faculty Coordinator (PROPOSE) creating a drive always lands in DRAFT, ignoring a requested status", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const jds = await request(app.getHttpServer())
        .get("/job-descriptions")
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(200);
      const jdId = jds.body[0].id;

      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      const created = await request(app.getHttpServer())
        .post("/drives")
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ jdId, status: "SCHEDULED" })
        .expect(201);
      expect(created.body.status).toBe("DRAFT");
    });

    it("only FULL scope (TPO) can transition a drive's status", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const jds = await request(app.getHttpServer())
        .get("/job-descriptions")
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(200);
      const jdId = jds.body[0].id;

      const drive = await request(app.getHttpServer())
        .post("/drives")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ jdId, status: "DRAFT" })
        .expect(201);

      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      await request(app.getHttpServer())
        .patch(`/drives/${drive.body.id}/status`)
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ status: "SCHEDULED" })
        .expect(403);

      const updated = await request(app.getHttpServer())
        .patch(`/drives/${drive.body.id}/status`)
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ status: "SCHEDULED" })
        .expect(200);
      expect(updated.body.status).toBe("SCHEDULED");
    });

    it("Faculty Coordinator can edit the round pipeline only while the drive is DRAFT", async () => {
      const tpoToken = await loginAs("tpo@demo-college.edu");
      const jds = await request(app.getHttpServer())
        .get("/job-descriptions")
        .set("Authorization", `Bearer ${tpoToken}`)
        .expect(200);
      const jdId = jds.body[0].id;

      const facultyToken = await loginAs("faculty.cse@demo-college.edu");
      const draftDrive = await request(app.getHttpServer())
        .post("/drives")
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ jdId })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/drives/${draftDrive.body.id}/rounds`)
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ type: "APTITUDE", position: 1 })
        .expect(201);

      const scheduledDrive = await request(app.getHttpServer())
        .post("/drives")
        .set("Authorization", `Bearer ${tpoToken}`)
        .send({ jdId, status: "SCHEDULED" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/drives/${scheduledDrive.body.id}/rounds`)
        .set("Authorization", `Bearer ${facultyToken}`)
        .send({ type: "APTITUDE", position: 1 })
        .expect(403);
    });

    it("Student has no access to drives.manage", async () => {
      const studentToken = await loginAs("student@demo-college.edu");
      await request(app.getHttpServer())
        .get("/drives")
        .set("Authorization", `Bearer ${studentToken}`)
        .expect(403);
    });
  });
});
