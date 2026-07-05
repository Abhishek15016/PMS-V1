import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { PermissionGuard } from "./permission.guard";
import { AccessTokenPayload } from "../token/token.service";

function makeContext(req: Partial<Request>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeUser(
  overrides: Partial<AccessTokenPayload> = {},
): AccessTokenPayload {
  return {
    sub: "user-1",
    tenantId: "tenant-1",
    role: "STUDENT",
    departmentId: null,
    ...overrides,
  };
}

describe("PermissionGuard", () => {
  it("passes through routes with no @RequirePermission metadata", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    const req: Partial<Request> = {};
    expect(guard.canActivate(makeContext(req))).toBe(true);
  });

  it("throws 401 if no authUser is present (JwtAuthGuard should have run first)", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue("students.records"),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    expect(() => guard.canActivate(makeContext({}))).toThrow(
      UnauthorizedException,
    );
  });

  it("throws 403 when the role's scope for the resource is NONE", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue("policy.rules"),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    const req: Partial<Request> = { authUser: makeUser({ role: "STUDENT" }) };
    expect(() => guard.canActivate(makeContext(req))).toThrow(
      ForbiddenException,
    );
  });

  it("allows access and attaches the resolved scope when the role has any access", () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue("students.records"),
    } as unknown as Reflector;
    const guard = new PermissionGuard(reflector);
    const req: Partial<Request> = {
      authUser: makeUser({ role: "FACULTY_COORD" }),
    };
    expect(guard.canActivate(makeContext(req))).toBe(true);
    expect(req.permissionScope).toBe("own_department");
  });
});
