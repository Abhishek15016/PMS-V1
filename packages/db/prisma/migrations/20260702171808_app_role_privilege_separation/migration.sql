-- The POSTGRES_USER created by the official postgres Docker image (and any
-- typical managed-Postgres admin user) is a superuser, and superusers
-- BYPASS ROW LEVEL SECURITY unconditionally regardless of FORCE ROW LEVEL
-- SECURITY. If the running application connects as that user, every RLS
-- policy in this schema is silently inert. The app must connect as a
-- normal, non-superuser role instead. Migrations continue to run as the
-- superuser (schema DDL requires elevated privileges anyway).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pms_app') THEN
    CREATE ROLE pms_app NOSUPERUSER NOBYPASSRLS LOGIN PASSWORD 'pms_app_dev_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE pms TO pms_app;
GRANT USAGE ON SCHEMA public TO pms_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO pms_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO pms_app;
