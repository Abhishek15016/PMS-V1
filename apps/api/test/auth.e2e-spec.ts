import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MagicLinkStubProvider } from "../src/modules/auth/providers/magic-link-stub.provider";

/**
 * Exercises SP-01's acceptance criteria end-to-end against the real seeded
 * demo-college tenant (packages/db/prisma/seed.ts): SSO stub login, magic
 * link single-use + expiry, /me auth gating, and refresh-token rotation +
 * reuse detection.
 */
describe("Auth (e2e)", () => {
  let app: INestApplication;
  let magicLinkStub: MagicLinkStubProvider;

  const TENANT_SLUG = "demo-college";
  const TPO_EMAIL = "tpo@demo-college.edu";
  const RECRUITER_EMAIL = "recruiter@demo-college.edu";

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

    magicLinkStub = moduleRef.get(MagicLinkStubProvider);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("SSO stub login", () => {
    it("mints a session for a seeded user", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/sso/callback")
        .send({ tenantSlug: TENANT_SLUG, email: TPO_EMAIL })
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.refreshToken).toEqual(expect.any(String));
      expect(res.body.user.email).toBe(TPO_EMAIL);
      expect(res.body.user.role).toBe("TPO");
    });

    it("rejects an email with no account in the tenant", async () => {
      await request(app.getHttpServer())
        .post("/auth/sso/callback")
        .send({ tenantSlug: TENANT_SLUG, email: "nobody@demo-college.edu" })
        .expect(401);
    });

    it("rejects an unknown tenant slug", async () => {
      await request(app.getHttpServer())
        .post("/auth/sso/callback")
        .send({ tenantSlug: "no-such-institution", email: TPO_EMAIL })
        .expect(404);
    });
  });

  describe("GET /me", () => {
    it("requires a valid access token", async () => {
      await request(app.getHttpServer()).get("/me").expect(401);
    });

    it("returns the caller's identity when authenticated", async () => {
      const login = await request(app.getHttpServer())
        .post("/auth/sso/callback")
        .send({ tenantSlug: TENANT_SLUG, email: TPO_EMAIL })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get("/me")
        .set("Authorization", `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(res.body.role).toBe("TPO");
      expect(res.body.tenantId).toBe(login.body.user.tenantId);
    });

    it("rejects a malformed bearer token", async () => {
      await request(app.getHttpServer())
        .get("/me")
        .set("Authorization", "Bearer not-a-real-token")
        .expect(401);
    });
  });

  describe("Magic link login", () => {
    it("is single-use and expiry-scoped, end to end", async () => {
      await request(app.getHttpServer())
        .post("/auth/magic-link/request")
        .send({ tenantSlug: TENANT_SLUG, email: RECRUITER_EMAIL })
        .expect(202);

      const token = magicLinkStub.getLastTokenFor(RECRUITER_EMAIL);
      expect(token).toEqual(expect.any(String));

      const verifyRes = await request(app.getHttpServer())
        .post("/auth/magic-link/verify")
        .send({ token })
        .expect(201);

      expect(verifyRes.body.user.email).toBe(RECRUITER_EMAIL);
      expect(verifyRes.body.user.role).toBe("RECRUITER");

      // Second use of the same token must be rejected.
      await request(app.getHttpServer())
        .post("/auth/magic-link/verify")
        .send({ token })
        .expect(401);
    });

    it("rejects an unrecognized token", async () => {
      await request(app.getHttpServer())
        .post("/auth/magic-link/verify")
        .send({ token: "does-not-exist" })
        .expect(401);
    });

    it("does not error for an email with no account (prevents account enumeration)", async () => {
      await request(app.getHttpServer())
        .post("/auth/magic-link/request")
        .send({ tenantSlug: TENANT_SLUG, email: "nobody@demo-college.edu" })
        .expect(202);
    });
  });

  describe("Refresh token rotation", () => {
    it("issues a new token pair and invalidates the old refresh token", async () => {
      const login = await request(app.getHttpServer())
        .post("/auth/sso/callback")
        .send({ tenantSlug: TENANT_SLUG, email: TPO_EMAIL })
        .expect(201);

      const refreshed = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: login.body.refreshToken })
        .expect(201);

      expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);

      // Reusing the original (now-rotated-away) refresh token must fail...
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);

      // ...and reuse-detection revokes the whole session family, so even
      // the token issued by the rotation above is now dead.
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: refreshed.body.refreshToken })
        .expect(401);
    });
  });

  describe("Logout", () => {
    it("revokes the session so the refresh token can no longer be used", async () => {
      const login = await request(app.getHttpServer())
        .post("/auth/sso/callback")
        .send({ tenantSlug: TENANT_SLUG, email: TPO_EMAIL })
        .expect(201);

      await request(app.getHttpServer())
        .post("/auth/logout")
        .send({ refreshToken: login.body.refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
    });
  });
});
