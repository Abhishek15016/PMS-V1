import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Proves the batch drive-eligibility endpoint (GET /drives/:id/eligibility)
 * and its cache: a first call evaluates and persists every student fresh;
 * a second call (same rule version) must return byte-identical results
 * while touching zero fresh evaluations, purely serving cached rows.
 * Also proves activating an institution-wide policy changes the effective
 * ruleVersion and therefore invalidates the cache by key, not by deletion.
 */
describe("Drive eligibility batch (e2e)", () => {
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

  async function seededDriveId(tpoToken: string): Promise<string> {
    const jds = await request(app.getHttpServer())
      .get("/job-descriptions")
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    const jd = jds.body.find(
      (j: { title: string }) => j.title === "Software Engineer",
    );
    const drives = await request(app.getHttpServer())
      .get("/drives")
      .query({ jdId: jd.id })
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    return drives.body[0].id;
  }

  it("evaluates the whole cohort, splitting eligible/ineligible correctly", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const driveId = await seededDriveId(tpoToken);

    const res = await request(app.getHttpServer())
      .get(`/drives/${driveId}/eligibility`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);

    expect(res.body.summary.totalEvaluated).toBeGreaterThanOrEqual(2);
    const eligibleEmails = res.body.eligible.map(
      (s: { email: string }) => s.email,
    );
    const ineligibleEmails = res.body.ineligible.map(
      (i: { student: { email: string } }) => i.student.email,
    );
    expect(eligibleEmails).toContain("student@demo-college.edu");
    expect(ineligibleEmails).toContain("student2.ece@demo-college.edu");
  });

  it("serves the second call from cache, with identical results and freshlyEvaluated=0", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const driveId = await seededDriveId(tpoToken);

    const first = await request(app.getHttpServer())
      .get(`/drives/${driveId}/eligibility`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(first.body.summary.freshlyEvaluated).toBe(0); // already cached by the previous test
    expect(first.body.summary.fromCache).toBe(
      first.body.summary.totalEvaluated,
    );

    const second = await request(app.getHttpServer())
      .get(`/drives/${driveId}/eligibility`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);

    expect(second.body).toEqual(first.body);
    expect(second.body.summary.freshlyEvaluated).toBe(0);
  });

  it("activating an institution-wide policy changes ruleVersion and invalidates the cache by key", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const driveId = await seededDriveId(tpoToken);

    // Baseline: CSE student (gapYears: 0) is eligible under JD-only criteria.
    const before = await request(app.getHttpServer())
      .get(`/drives/${driveId}/eligibility`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(
      before.body.eligible.map((s: { email: string }) => s.email),
    ).toContain("student@demo-college.edu");

    // Institution-wide policy: no gap years allowed at all. Still shouldn't
    // affect this student (gapYears: 0), but proves the merge + new
    // ruleVersion forces a fresh evaluation instead of a stale cache hit.
    const rule = await request(app.getHttpServer())
      .post("/policy-rules")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        type: "ELIGIBILITY_CRITERIA",
        name: "institution-default-eligibility-criteria",
        definition: { maxGapYears: 0 },
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/policy-rules/${rule.body.id}/activate`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/drives/${driveId}/eligibility`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);

    // New ruleVersion => nothing was cached under it yet => fully fresh.
    expect(after.body.summary.freshlyEvaluated).toBe(
      after.body.summary.totalEvaluated,
    );
    expect(
      after.body.eligible.map((s: { email: string }) => s.email),
    ).toContain("student@demo-college.edu");
  });

  it("rejects roles with no drives.manage access", async () => {
    const studentToken = await loginAs("student@demo-college.edu");
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const driveId = await seededDriveId(tpoToken);

    await request(app.getHttpServer())
      .get(`/drives/${driveId}/eligibility`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);
  });
});
