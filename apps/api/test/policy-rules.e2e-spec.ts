import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Proves SP-15's versioning contract: editing a rule never mutates the
 * existing row (a new version is inserted instead), and activating a new
 * version atomically archives whichever version was previously active in
 * the same family — so an EligibilityEvaluation that already recorded a
 * ruleVersion id keeps pointing at an immutable definition forever.
 */
describe("Policy Rules (e2e)", () => {
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

  it("rejects non-TPO/Super-Admin roles entirely", async () => {
    const facultyToken = await loginAs("faculty.cse@demo-college.edu");
    await request(app.getHttpServer())
      .get("/policy-rules")
      .set("Authorization", `Bearer ${facultyToken}`)
      .expect(403);
  });

  it("rejects a definition that fails validation for the rule type", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    await request(app.getHttpServer())
      .post("/policy-rules")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        type: "ELIGIBILITY_CRITERIA",
        name: "invalid-test-rule",
        definition: { minCgpa: "not-a-number" },
      })
      .expect(400);
  });

  it("creates v1 as DRAFT, and versioning never mutates the original row", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");

    const v1 = await request(app.getHttpServer())
      .post("/policy-rules")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        type: "ELIGIBILITY_CRITERIA",
        name: "cse-default-eligibility",
        definition: { minCgpa: 6.5, maxActiveBacklogs: 1 },
      })
      .expect(201);
    expect(v1.body.version).toBe(1);
    expect(v1.body.status).toBe("DRAFT");

    const v2 = await request(app.getHttpServer())
      .post(`/policy-rules/${v1.body.id}/versions`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ definition: { minCgpa: 7.0, maxActiveBacklogs: 0 } })
      .expect(201);
    expect(v2.body.version).toBe(2);
    expect(v2.body.status).toBe("DRAFT");
    expect(v2.body.supersedesId).toBe(v1.body.id);

    // The original row must be byte-identical to what was created — editing
    // never happened, a new row did.
    const v1Refetched = await request(app.getHttpServer())
      .get(`/policy-rules/${v1.body.id}`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(v1Refetched.body.definition).toEqual({
      minCgpa: 6.5,
      maxActiveBacklogs: 1,
    });
    expect(v1Refetched.body.version).toBe(1);
  });

  it("activating a new version archives the previously active version in the same family", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");

    const v1 = await request(app.getHttpServer())
      .post("/policy-rules")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        type: "ELIGIBILITY_CRITERIA",
        name: "ece-default-eligibility",
        definition: { minCgpa: 6.0 },
      })
      .expect(201);

    const v1Activated = await request(app.getHttpServer())
      .post(`/policy-rules/${v1.body.id}/activate`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);
    expect(v1Activated.body.status).toBe("ACTIVE");

    const v2 = await request(app.getHttpServer())
      .post(`/policy-rules/${v1.body.id}/versions`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({ definition: { minCgpa: 6.75 } })
      .expect(201);

    const v2Activated = await request(app.getHttpServer())
      .post(`/policy-rules/${v2.body.id}/activate`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);
    expect(v2Activated.body.status).toBe("ACTIVE");

    const v1AfterV2Active = await request(app.getHttpServer())
      .get(`/policy-rules/${v1.body.id}`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    expect(v1AfterV2Active.body.status).toBe("ARCHIVED");

    const activeList = await request(app.getHttpServer())
      .get("/policy-rules")
      .query({ type: "ELIGIBILITY_CRITERIA", status: "ACTIVE" })
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    const activeInFamily = activeList.body.filter(
      (r: { name: string }) => r.name === "ece-default-eligibility",
    );
    expect(activeInFamily).toHaveLength(1);
    expect(activeInFamily[0].id).toBe(v2.body.id);
  });

  it("cannot re-activate a non-DRAFT rule", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const rule = await request(app.getHttpServer())
      .post("/policy-rules")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        type: "SLAB_DEFINITION",
        name: "default-slabs",
        definition: { superDreamMinCtc: 10, dreamMinCtc: 20 },
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/policy-rules/${rule.body.id}/activate`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/policy-rules/${rule.body.id}/activate`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(400);
  });
});
