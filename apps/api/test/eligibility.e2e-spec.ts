import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Proves the single-student eligibility evaluate endpoint against the
 * seeded "Software Engineer" JD (minCgpa: 7, maxActiveBacklogs: 0,
 * eligiblePrograms: [CSE, ECE]) and the two seeded students: the CSE
 * student (cgpa 8.2, 0 backlogs) qualifies; the ECE student (cgpa 7.4, 1
 * active backlog) fails on backlogs alone.
 */
describe("Eligibility (e2e)", () => {
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

  async function fetchByEmail(token: string, path: string, email: string) {
    const res = await request(app.getHttpServer())
      .get(path)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    return res.body.find(
      (item: { user?: { email: string } }) => item.user?.email === email,
    );
  }

  it("requires authentication", async () => {
    await request(app.getHttpServer())
      .post("/eligibility/evaluate")
      .send({ studentId: "x", jdId: "y" })
      .expect(401);
  });

  it("rejects roles with no drives.manage access (e.g. Student)", async () => {
    const studentToken = await loginAs("student@demo-college.edu");
    await request(app.getHttpServer())
      .post("/eligibility/evaluate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ studentId: "x", jdId: "y" })
      .expect(403);
  });

  it("qualifies the CSE student against the seeded Software Engineer JD", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const cseStudent = await fetchByEmail(
      tpoToken,
      "/students",
      "student@demo-college.edu",
    );
    const jds = await request(app.getHttpServer())
      .get("/job-descriptions")
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    const jd = jds.body.find(
      (j: { title: string }) => j.title === "Software Engineer",
    );

    const res = await request(app.getHttpServer())
      .post("/eligibility/evaluate")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ studentId: cseStudent.id, jdId: jd.id })
      .expect(201);

    expect(res.body.eligible).toBe(true);
    expect(res.body.reasons.every((r: { passed: boolean }) => r.passed)).toBe(
      true,
    );
  });

  it("fails the ECE student on active backlogs (and reports only that failure)", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const eceStudent = await fetchByEmail(
      tpoToken,
      "/students",
      "student2.ece@demo-college.edu",
    );
    const jds = await request(app.getHttpServer())
      .get("/job-descriptions")
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    const jd = jds.body.find(
      (j: { title: string }) => j.title === "Software Engineer",
    );

    const res = await request(app.getHttpServer())
      .post("/eligibility/evaluate")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ studentId: eceStudent.id, jdId: jd.id })
      .expect(201);

    expect(res.body.eligible).toBe(false);
    const failed = res.body.reasons.filter(
      (r: { passed: boolean }) => !r.passed,
    );
    expect(failed.map((r: { ruleCode: string }) => r.ruleCode)).toEqual([
      "ACTIVE_BACKLOGS",
    ]);
  });

  it("returns 404 for a non-existent student or JD", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const jds = await request(app.getHttpServer())
      .get("/job-descriptions")
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    const jd = jds.body[0];

    await request(app.getHttpServer())
      .post("/eligibility/evaluate")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ studentId: "does-not-exist", jdId: jd.id })
      .expect(404);
  });
});
