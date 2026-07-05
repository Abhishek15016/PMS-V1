import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Institution, MagicLinkToken, PrismaClient } from "@pms/db";
import { ConfigService } from "@nestjs/config";

/**
 * Connects as the narrowly-scoped, SELECT-only, BYPASSRLS `pms_authbootstrap`
 * role (migration 20260702173133_auth_bootstrap_role). Used ONLY to resolve
 * which tenant a pre-auth request belongs to — institution by slug,
 * magic-link token by hash — queries that are inherently cross-tenant
 * because the tenant isn't known yet. The moment a tenantId is resolved,
 * all further reads/writes must go through TenantPrismaService, never this
 * service; it has no write access at all, by design.
 */
@Injectable()
export class AuthBootstrapPrismaService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly prisma: PrismaClient;

  constructor(config: ConfigService) {
    this.prisma = new PrismaClient({
      datasources: {
        db: { url: config.getOrThrow<string>("AUTH_BOOTSTRAP_DATABASE_URL") },
      },
    });
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  findInstitutionBySlug(slug: string): Promise<Institution | null> {
    return this.prisma.institution.findUnique({ where: { slug } });
  }

  findMagicLinkTokenByHash(tokenHash: string): Promise<MagicLinkToken | null> {
    return this.prisma.magicLinkToken.findFirst({ where: { tokenHash } });
  }
}
