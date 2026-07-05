import "dotenv/config";
import { Client } from "pg";
import { TenantPrismaService } from "./tenant-prisma.service";

/**
 * Proves tenant isolation through the actual Nest/Prisma path the running
 * application uses (TenantPrismaService.run), complementing
 * packages/db/test/rls-isolation.spec.ts which proves the same thing at the
 * raw-SQL layer. Both must pass: the raw-SQL test proves the Postgres
 * policies are correct; this test proves the app code actually invokes them
 * correctly (right role, right transaction, right set_config call).
 */

const SUPERUSER_URL = process.env.MIGRATION_DATABASE_URL!;

async function withSuperuser<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: SUPERUSER_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

describe("TenantPrismaService (integration)", () => {
  let service: TenantPrismaService;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    service = new TenantPrismaService();
    await service.onModuleInit();

    await withSuperuser(async (client) => {
      await client.query(
        `DELETE FROM users WHERE tenant_id IN (SELECT id FROM institutions WHERE slug LIKE 'nest-rls-test-%')`,
      );
      await client.query(
        `DELETE FROM institutions WHERE slug LIKE 'nest-rls-test-%'`,
      );

      const tenantA = await client.query(
        `INSERT INTO institutions (id, name, slug, status, updated_at) VALUES (gen_random_uuid()::text, 'Nest RLS Test A', 'nest-rls-test-a', 'ACTIVE', now()) RETURNING id`,
      );
      const tenantB = await client.query(
        `INSERT INTO institutions (id, name, slug, status, updated_at) VALUES (gen_random_uuid()::text, 'Nest RLS Test B', 'nest-rls-test-b', 'ACTIVE', now()) RETURNING id`,
      );
      tenantAId = tenantA.rows[0].id;
      tenantBId = tenantB.rows[0].id;

      await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, updated_at)
         VALUES (gen_random_uuid()::text, $1, 'a-user@nest-rls-test.local', 'Tenant A User', 'TPO', 'stub', now())`,
        [tenantAId],
      );
      await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, updated_at)
         VALUES (gen_random_uuid()::text, $1, 'b-user@nest-rls-test.local', 'Tenant B User', 'TPO', 'stub', now())`,
        [tenantBId],
      );
    });
  });

  afterAll(async () => {
    await withSuperuser(async (client) => {
      await client.query(
        `DELETE FROM users WHERE tenant_id IN (SELECT id FROM institutions WHERE slug LIKE 'nest-rls-test-%')`,
      );
      await client.query(
        `DELETE FROM institutions WHERE slug LIKE 'nest-rls-test-%'`,
      );
    });
    await service.onModuleDestroy();
  });

  it("scopes queries to the given tenant via set_config, through Prisma", async () => {
    const usersA = await service.run(tenantAId, (tx) =>
      tx.user.findMany({
        where: { email: { endsWith: "@nest-rls-test.local" } },
      }),
    );
    expect(usersA).toHaveLength(1);
    expect(usersA.at(0)?.email).toBe("a-user@nest-rls-test.local");

    const usersB = await service.run(tenantBId, (tx) =>
      tx.user.findMany({
        where: { email: { endsWith: "@nest-rls-test.local" } },
      }),
    );
    expect(usersB).toHaveLength(1);
    expect(usersB.at(0)?.email).toBe("b-user@nest-rls-test.local");
  });

  it("does not leak the set_config scope between successive run() calls", async () => {
    await service.run(tenantAId, (tx) => tx.user.findMany());
    const usersB = await service.run(tenantBId, (tx) =>
      tx.user.findMany({
        where: { email: { endsWith: "@nest-rls-test.local" } },
      }),
    );
    expect(usersB.every((u) => u.tenantId === tenantBId)).toBe(true);
  });

  it("app-role connection cannot see any tenant's rows without set_config (fail closed)", async () => {
    const rows = await service.unscoped.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM users WHERE email LIKE '%@nest-rls-test.local'
    `;
    expect(rows).toHaveLength(0);
  });
});
