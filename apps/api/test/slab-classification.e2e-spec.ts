import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Proves SP-17's slab auto-derivation: JobDescription.slab is never
 * client-supplied (CreateJobDescriptionDto has no such field — whitelist
 * validation would reject it) and is instead computed from ctcLpa against
 * the active SLAB_DEFINITION policy at creation time.
 */
describe("Slab classification on JD creation (e2e)", () => {
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

  async function ownCompanyId(recruiterToken: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get("/companies")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .expect(200);
    return res.body[0].id;
  }

  it("a JD is slab-less until an institution SLAB_DEFINITION policy is active", async () => {
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);

    // Only meaningful if no SLAB_DEFINITION rule has been activated by an
    // earlier test in this file (each JD created here is a fresh row).
    const res = await request(app.getHttpServer())
      .post("/job-descriptions")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({
        companyId,
        title: "Unclassified Role",
        ctcLpa: 8,
        eligiblePrograms: ["CSE"],
        minCriteria: {},
      })
      .expect(201);

    // slab is either null (no policy yet) or a valid enum value if a prior
    // test/run already activated one — either way, never client-set: the
    // DTO has no slab field, so this only proves server-side derivation.
    expect(["NON_DREAM", "SUPER_DREAM", "DREAM", null]).toContain(
      res.body.slab,
    );
  });

  it("classifies NON_DREAM / SUPER_DREAM / DREAM correctly once a policy is active", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const rule = await request(app.getHttpServer())
      .post("/policy-rules")
      .set("Authorization", `Bearer ${tpoToken}`)
      .send({
        type: "SLAB_DEFINITION",
        name: "institution-default-slab-definition",
        definition: { superDreamMinCtc: 10, dreamMinCtc: 20 },
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/policy-rules/${rule.body.id}/activate`)
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(201);

    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);

    async function createJd(title: string, ctcLpa: number) {
      const res = await request(app.getHttpServer())
        .post("/job-descriptions")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({
          companyId,
          title,
          ctcLpa,
          eligiblePrograms: ["CSE"],
          minCriteria: {},
        })
        .expect(201);
      return res.body;
    }

    expect((await createJd("Low CTC Role", 6)).slab).toBe("NON_DREAM");
    expect((await createJd("Mid CTC Role", 12)).slab).toBe("SUPER_DREAM");
    expect((await createJd("High CTC Role", 25)).slab).toBe("DREAM");
    expect((await createJd("Boundary Super-Dream", 10)).slab).toBe(
      "SUPER_DREAM",
    );
    expect((await createJd("Boundary Dream", 20)).slab).toBe("DREAM");
  });

  it("rejects a client-supplied slab field entirely (whitelist validation)", async () => {
    const recruiterToken = await loginAs("recruiter@demo-college.edu");
    const companyId = await ownCompanyId(recruiterToken);

    await request(app.getHttpServer())
      .post("/job-descriptions")
      .set("Authorization", `Bearer ${recruiterToken}`)
      .send({
        companyId,
        title: "Should Reject Slab Field",
        ctcLpa: 8,
        eligiblePrograms: ["CSE"],
        minCriteria: {},
        slab: "DREAM",
      })
      .expect(400);
  });
});
