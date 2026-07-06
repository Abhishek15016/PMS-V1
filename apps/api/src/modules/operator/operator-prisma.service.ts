import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@pms/db";

/**
 * Cross-tenant Prisma client for the vendor's operator console ONLY.
 * Connects with the BYPASSRLS owner role (PLATFORM_DATABASE_URL, falling
 * back to MIGRATION_DATABASE_URL, which deployments already define for
 * `prisma migrate deploy`). Never inject this into tenant request paths —
 * the whole RLS model assumes those go through TenantPrismaService.
 */
@Injectable()
export class OperatorPrismaService implements OnModuleDestroy {
  private client: PrismaClient | null = null;

  constructor(private readonly config: ConfigService) {}

  get prisma(): PrismaClient {
    if (this.client) return this.client;
    const url =
      this.config.get<string>("PLATFORM_DATABASE_URL") ??
      this.config.get<string>("MIGRATION_DATABASE_URL");
    if (!url) {
      throw new ServiceUnavailableException(
        "Operator console is not configured on this deployment (no PLATFORM_DATABASE_URL)",
      );
    }
    this.client = new PrismaClient({ datasources: { db: { url } } });
    return this.client;
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }
}
