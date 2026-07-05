import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * Proves RBAC + department/self scoping (slice 4) actually apply to a real
 * resource module, against the seeded demo-college fixtures: a CSE student
 * (student@demo-college.edu) and an ECE student (student2.ece@demo-college.edu).
 */
describe("Students (e2e)", () => {
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

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/students").expect(401);
  });

  it("TPO (FULL scope) sees students across every department", async () => {
    const token = await loginAs("tpo@demo-college.edu");
    const res = await request(app.getHttpServer())
      .get("/students")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const departmentCodes = new Set(
      res.body.map((s: { department: { code: string } }) => s.department.code),
    );
    expect(departmentCodes.has("CSE")).toBe(true);
    expect(departmentCodes.has("ECE")).toBe(true);
  });

  it("Faculty Coordinator (OWN_DEPARTMENT scope) sees only their department's students", async () => {
    const token = await loginAs("faculty.cse@demo-college.edu");
    const res = await request(app.getHttpServer())
      .get("/students")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.length).toBeGreaterThan(0);
    for (const student of res.body) {
      expect(student.department.code).toBe("CSE");
    }
  });

  it("Faculty Coordinator cannot fetch a student outside their department by id", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const all = await request(app.getHttpServer())
      .get("/students")
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    const eceStudent = all.body.find(
      (s: { department: { code: string } }) => s.department.code === "ECE",
    );
    expect(eceStudent).toBeDefined();

    const facultyToken = await loginAs("faculty.cse@demo-college.edu");
    await request(app.getHttpServer())
      .get(`/students/${eceStudent.id}`)
      .set("Authorization", `Bearer ${facultyToken}`)
      .expect(403);
  });

  it("Student (SELF scope) sees only their own record, never the full list", async () => {
    const token = await loginAs("student@demo-college.edu");
    const res = await request(app.getHttpServer())
      .get("/students")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].user.email).toBe("student@demo-college.edu");
  });

  it("Student cannot fetch another student's record by id", async () => {
    const tpoToken = await loginAs("tpo@demo-college.edu");
    const all = await request(app.getHttpServer())
      .get("/students")
      .set("Authorization", `Bearer ${tpoToken}`)
      .expect(200);
    const otherStudent = all.body.find(
      (s: { user: { email: string } }) =>
        s.user.email !== "student@demo-college.edu",
    );
    expect(otherStudent).toBeDefined();

    const studentToken = await loginAs("student@demo-college.edu");
    await request(app.getHttpServer())
      .get(`/students/${otherStudent.id}`)
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);
  });

  it("Recruiter (NONE scope) is rejected with 403", async () => {
    const token = await loginAs("recruiter@demo-college.edu");
    await request(app.getHttpServer())
      .get("/students")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("returns 404 for a non-existent student id", async () => {
    const token = await loginAs("tpo@demo-college.edu");
    await request(app.getHttpServer())
      .get("/students/does-not-exist")
      .set("Authorization", `Bearer ${token}`)
      .expect(404);
  });
});
