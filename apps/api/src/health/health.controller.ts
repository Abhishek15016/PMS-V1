import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { TenantPrismaService } from "../database/tenant-prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  @Get()
  check() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("db")
  async checkDb() {
    try {
      await this.tenantPrisma.unscoped.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        db: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: "error",
        db: "unreachable",
        message: err instanceof Error ? err.message : "unknown error",
      });
    }
  }
}
