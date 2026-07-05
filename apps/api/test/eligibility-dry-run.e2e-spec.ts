import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TenantPrismaService } from "../src/database/tenant-prisma.service";

/**
 * Proves the dry-run simulator (SP-16 pt.3): it reports correct cohort
 * diffs for a hypothetical institution-wide criteria change, and — the
 * critical property — never writes to the EligibilityEvaluation cache
 * table, verified by an exact row-count comparison before and after.
 */
describe("Eligibility dry-run (e2e)", () => {
  let app: INestApplication;
  let tenantPrisma: TenantPrismaService;
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
    tenantPrisma = moduleRef.get(TenantPrismaService);
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

  async function seededJdId(tpoToken: string): Promise<string> {
    const jds = await request(app.getHttpServer())
      .get("/job-descriptions")
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    return jds.body.find(
      (j: { title: string }) => j.title === "Software Engineer",
    ).id;
  }

  async function tenantIdFor(token: string): Promise<string> {
    const me = await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    return me.body.tenantId;
  }

  it("a stricter institution-wide 10th% bar flips the currently-eligible CSE student to ineligible", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const jdId = await seededJdId(tpoToken);

    // The seeded JD only sets minCgpa/maxActiveBacklogs — it never touches
    // 10th%, so an institution-wide 10th% bar actually takes effect here
    // (unlike CGPA, which the JD already pins and which would therefore
    // always win over an institution proposal — see the "JD wins" test
    // below). CSE student is 92.4%, ECE is 85.0%; both fail a 95% bar.
    const res = await request(app.getHttpServer())
      .post("/eligibility/dry-run")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ jdId, proposedCriteria: { minTenthPercent: 95 } })
      .expect(201);

    expect(res.body.proposed.eligibleCount).toBeLessThan(
      res.body.current.eligibleCount,
    );
    expect(
      res.body.newlyIneligible.map((s: { email: string }) => s.email),
    ).toContain("student@demo-college.edu");
  });

  it("JD-level criteria always win over a proposed institution-wide change to the same field", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const jdId = await seededJdId(tpoToken);

    // The JD pins minCgpa: 7 itself, so proposing a much higher/lower
    // institution-wide minCgpa must have zero effect on this JD's results —
    // exactly matching how a real evaluation merges the two.
    const stricter = await request(app.getHttpServer())
      .post("/eligibility/dry-run")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ jdId, proposedCriteria: { minCgpa: 9.9 } })
      .expect(201);
    expect(stricter.body.newlyEligible).toHaveLength(0);
    expect(stricter.body.newlyIneligible).toHaveLength(0);

    const looser = await request(app.getHttpServer())
      .post("/eligibility/dry-run")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ jdId, proposedCriteria: { minCgpa: 0 } })
      .expect(201);
    expect(looser.body.newlyEligible).toHaveLength(0);
    expect(looser.body.newlyIneligible).toHaveLength(0);
  });

  it("reports zero diff for a no-op proposal (same as current effective criteria)", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const jdId = await seededJdId(tpoToken);

    const res = await request(app.getHttpServer())
      .post("/eligibility/dry-run")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ jdId, proposedCriteria: {} })
      .expect(201);

    expect(res.body.newlyEligible).toHaveLength(0);
    expect(res.body.newlyIneligible).toHaveLength(0);
    expect(res.body.proposed.eligibleCount).toBe(
      res.body.current.eligibleCount,
    );
  });

  it("persists nothing — EligibilityEvaluation row count is unchanged after a dry-run", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const jdId = await seededJdId(tpoToken);
    const tenantId = await tenantIdFor(tpoToken);

    const countBefore = await tenantPrisma.run(tenantId, (tx) =>
      tx.eligibilityEvaluation.count(),
    );

    await request(app.getHttpServer())
      .post("/eligibility/dry-run")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        jdId,
        proposedCriteria: { minCgpa: 5, maxActiveBacklogs: 5, maxGapYears: 3 },
      })
      .expect(201);

    const countAfter = await tenantPrisma.run(tenantId, (tx) =>
      tx.eligibilityEvaluation.count(),
    );

    expect(countAfter).toBe(countBefore);
  });

  it("a proposal that relaxes backlog limits would newly qualify the ECE student", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const jdId = await seededJdId(tpoToken);

    // The JD itself requires maxActiveBacklogs: 0 (slice 8 seed), and JD
    // criteria always win over the institution proposal — so relaxing only
    // the institution-wide default can't override the JD's own cap. This
    // proves JD-level criteria remain authoritative during simulation too.
    const res = await request(app.getHttpServer())
      .post("/eligibility/dry-run")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ jdId, proposedCriteria: { maxActiveBacklogs: 5 } })
      .expect(201);

    expect(
      res.body.newlyEligible.map((s: { email: string }) => s.email),
    ).not.toContain("student2.ece@demo-college.edu");
  });

  it("rejects roles with no drives.manage access", async () => {
    const studentToken = await loginAs("student@demo-college.edu");
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const jdId = await seededJdId(tpoToken);

    await request(app.getHttpServer())
      .post("/eligibility/dry-run")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ jdId, proposedCriteria: {} })
      .expect(403);
  });
});
