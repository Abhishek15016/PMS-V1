-- RowLevelSecurity (missed in the previous migration — added here instead
-- of editing an already-applied migration file)
ALTER TABLE "magic_link_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "magic_link_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "magic_link_tokens"
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Pre-auth flows (resolve institution by slug, resolve a magic-link token by
-- its hash) are inherently cross-tenant lookups: the whole point is that we
-- don't know the tenant yet, so the normal tenant-scoped RLS path can never
-- serve them (current_setting('app.tenant_id') is unset, so every RLS
-- policy above excludes every row).
--
-- This role exists ONLY for that narrow bootstrap need. It is deliberately
-- SELECT-only (no INSERT/UPDATE/DELETE) and BYPASSRLS is scoped down by
-- granting SELECT on exactly the three tables pre-auth code needs, not
-- "ALL TABLES" and not via ALTER DEFAULT PRIVILEGES — new tables added by
-- future migrations are NOT automatically readable by this role. Once a
-- bootstrap lookup resolves a tenantId, all subsequent reads/writes
-- (creating the session, marking a token consumed, etc.) must go through
-- the normal TenantPrismaService path, not this role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pms_authbootstrap') THEN
    CREATE ROLE pms_authbootstrap NOSUPERUSER BYPASSRLS LOGIN PASSWORD 'pms_authbootstrap_dev_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE pms TO pms_authbootstrap;
GRANT USAGE ON SCHEMA public TO pms_authbootstrap;
GRANT SELECT ON "institutions" TO pms_authbootstrap;
GRANT SELECT ON "users" TO pms_authbootstrap;
GRANT SELECT ON "magic_link_tokens" TO pms_authbootstrap;
