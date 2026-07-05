import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  UseGuards,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { CommonModule } from "../src/common/common.module";
import { CurrentUser } from "../src/common/decorators/current-user.decorator";
import { RequirePermission } from "../src/common/decorators/require-permission.decorator";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { PermissionGuard } from "../src/common/guards/permission.guard";
import { TenantContextMiddleware } from "../src/common/middleware/tenant-context.middleware";
import {
  AccessTokenPayload,
  TokenService,
} from "../src/common/token/token.service";
import { TokenModule } from "../src/common/token/token.module";

/**
 * A throwaway route protected by the real JwtAuthGuard + PermissionGuard
 * pipeline, to prove they compose correctly over real HTTP with a real
 * signed access token — not wired into AppModule/production routes.
 */
@Controller("__test__")
class RbacTestController {
  @Get("students-records")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission("students.records")
  studentsRecords(@CurrentUser() user: AccessTokenPayload) {
    return { role: user.role };
  }

  @Get("policy-rules")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission("policy.rules")
  policyRules() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TokenModule,
    CommonModule,
  ],
  controllers: [RbacTestController],
})
class RbacTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes("*");
  }
}

describe("RBAC guard pipeline (e2e)", () => {
  let app: INestApplication;
  let tokenService: TokenService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [RbacTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    tokenService = moduleRef.get(TokenService);
  });

  afterAll(async () => {
    await app.close();
  });

  function tokenFor(
    role: AccessTokenPayload["role"],
    departmentId: string | null = null,
  ): string {
    return tokenService.signAccessToken({
      sub: "user-1",
      tenantId: "tenant-1",
      role,
      departmentId,
    });
  }

  it("rejects unauthenticated requests with 401", async () => {
    await request(app.getHttpServer())
      .get("/__test__/students-records")
      .expect(401);
  });

  it("allows a role with scoped access (FACULTY_COORD → own_department) and returns 200", async () => {
    const res = await request(app.getHttpServer())
      .get("/__test__/students-records")
      .set("Authorization", `Bearer ${tokenFor("FACULTY_COORD")}`)
      .expect(200);
    expect(res.body.role).toBe("FACULTY_COORD");
  });

  it("allows full-scope roles through", async () => {
    await request(app.getHttpServer())
      .get("/__test__/students-records")
      .set("Authorization", `Bearer ${tokenFor("TPO")}`)
      .expect(200);
  });

  it("rejects a role with NONE scope for the resource with 403", async () => {
    // RECRUITER has no access to students.records per the permission matrix.
    await request(app.getHttpServer())
      .get("/__test__/students-records")
      .set("Authorization", `Bearer ${tokenFor("RECRUITER")}`)
      .expect(403);
  });

  it("enforces per-resource scope independently (STUDENT has none on policy.rules)", async () => {
    await request(app.getHttpServer())
      .get("/__test__/policy-rules")
      .set("Authorization", `Bearer ${tokenFor("STUDENT")}`)
      .expect(403);

    await request(app.getHttpServer())
      .get("/__test__/policy-rules")
      .set("Authorization", `Bearer ${tokenFor("SUPER_ADMIN")}`)
      .expect(200);
  });
});
