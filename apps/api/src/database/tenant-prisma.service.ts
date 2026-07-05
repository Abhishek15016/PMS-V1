import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@pms/db";
import { TenantContextStore } from "../common/context/tenant-context.store";

export type TenantTx = Prisma.TransactionClient;

/**
 * Runs Prisma work inside a transaction that first sets
 * `app.tenant_id` via `set_config(..., true)` (transaction-local, so it's
 * safe under connection pooling — see prisma/migrations/*init_tenant_user*
 * for the RLS policies this satisfies). Every RLS-scoped query in the app
 * must go through here, never through a raw, unscoped PrismaClient call.
 */
@Injectable()
export class TenantPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  /** Escape hatch for genuinely tenant-agnostic queries (health checks, etc). Never use for business data. */
  get unscoped(): PrismaClient {
    return this.prisma;
  }

  async run<T>(
    tenantId: string,
    work: (tx: TenantTx) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return work(tx);
    });
  }
}

/** Convenience wrapper: runs `work` scoped to the tenant in TenantContextStore. */
@Injectable()
export class ScopedPrismaRunner {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly store: TenantContextStore,
  ) {}

  run<T>(work: (tx: TenantTx) => Promise<T>): Promise<T> {
    const tenantId = this.store.getTenantIdOrThrow();
    return this.tenantPrisma.run(tenantId, work);
  }
}
