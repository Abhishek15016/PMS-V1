import "dotenv/config";
import { Client } from "pg";

/**
 * Proves the RLS policies applied in migration 20260702171635_init_tenant_user
 * (and the privilege-separation migration 20260702171808) actually isolate
 * tenants at the Postgres layer — before any Nest/Prisma application code
 * exists to get this wrong. Uses `pg` directly, not Prisma, to test the SQL
 * primitive itself.
 *
 * Two roles are involved:
 *  - superuser (`pms`, from packages/db/.env): seeds fixtures across both
 *    tenants, since RLS would otherwise block cross-tenant writes.
 *  - restricted app role (`pms_app`): runs the actual isolation-scoped
 *    queries, matching how the running application connects.
 */

const SUPERUSER_URL = process.env.DATABASE_URL!;
const APP_ROLE_URL = SUPERUSER_URL.replace(
  /^postgresql:\/\/[^:]+:[^@]+@/,
  "postgresql://pms_app:pms_app_dev_password@",
);

async function withClient<T>(
  url: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function asTenant<T>(
  client: Client,
  tenantId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    if (tenantId !== null) {
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [
        tenantId,
      ]);
    }
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

describe("RLS tenant isolation (raw SQL)", () => {
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    await withClient(SUPERUSER_URL, async (client) => {
      await client.query(
        `DELETE FROM users WHERE tenant_id IN (SELECT id FROM institutions WHERE slug LIKE 'rls-test-%')`,
      );
      await client.query(`DELETE FROM institutions WHERE slug LIKE 'rls-test-%'`);

      const tenantA = await client.query(
        `INSERT INTO institutions (id, name, slug, status, updated_at) VALUES (gen_random_uuid()::text, 'RLS Test Tenant A', 'rls-test-a', 'ACTIVE', now()) RETURNING id`,
      );
      const tenantB = await client.query(
        `INSERT INTO institutions (id, name, slug, status, updated_at) VALUES (gen_random_uuid()::text, 'RLS Test Tenant B', 'rls-test-b', 'ACTIVE', now()) RETURNING id`,
      );
      tenantAId = tenantA.rows[0].id;
      tenantBId = tenantB.rows[0].id;

      await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, updated_at)
         VALUES (gen_random_uuid()::text, $1, 'a-user@rls-test.local', 'Tenant A User', 'TPO', 'stub', now())`,
        [tenantAId],
      );
      await client.query(
        `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, updated_at)
         VALUES (gen_random_uuid()::text, $1, 'b-user@rls-test.local', 'Tenant B User', 'TPO', 'stub', now())`,
        [tenantBId],
      );
    });
  });

  afterAll(async () => {
    await withClient(SUPERUSER_URL, async (client) => {
      await client.query(
        `DELETE FROM users WHERE tenant_id IN (SELECT id FROM institutions WHERE slug LIKE 'rls-test-%')`,
      );
      await client.query(`DELETE FROM institutions WHERE slug LIKE 'rls-test-%'`);
    });
  });

  it("scoped to tenant A, only tenant A's user is visible", async () => {
    const rows = await withClient(APP_ROLE_URL, (client) =>
      asTenant(client, tenantAId, async () => {
        const res = await client.query(
          `SELECT email FROM users WHERE email LIKE '%@rls-test.local'`,
        );
        return res.rows;
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("a-user@rls-test.local");
  });

  it("scoped to tenant B, only tenant B's user is visible", async () => {
    const rows = await withClient(APP_ROLE_URL, (client) =>
      asTenant(client, tenantBId, async () => {
        const res = await client.query(
          `SELECT email FROM users WHERE email LIKE '%@rls-test.local'`,
        );
        return res.rows;
      }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("b-user@rls-test.local");
  });

  it("fails closed with zero rows when no tenant context is set", async () => {
    const rows = await withClient(APP_ROLE_URL, (client) =>
      asTenant(client, null, async () => {
        const res = await client.query(
          `SELECT email FROM users WHERE email LIKE '%@rls-test.local'`,
        );
        return res.rows;
      }),
    );
    expect(rows).toHaveLength(0);
  });

  it("blocks inserting a row for another tenant while scoped (WITH CHECK)", async () => {
    await expect(
      withClient(APP_ROLE_URL, (client) =>
        asTenant(client, tenantAId, () =>
          client.query(
            `INSERT INTO users (id, tenant_id, email, display_name, role, auth_provider, updated_at)
             VALUES (gen_random_uuid()::text, $1, 'cross-tenant@rls-test.local', 'Should Fail', 'TPO', 'stub', now())`,
            [tenantBId],
          ),
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("a connection as the superuser role bypasses RLS (documents the risk, doesn't rely on it)", async () => {
    const rows = await withClient(SUPERUSER_URL, async (client) => {
      const res = await client.query(
        `SELECT email FROM users WHERE email LIKE '%@rls-test.local' ORDER BY email`,
      );
      return res.rows;
    });
    expect(rows).toHaveLength(2);
  });
});
