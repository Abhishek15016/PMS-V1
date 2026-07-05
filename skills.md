# Skills & Tech Stack — Placement Management System (PMS)

A reference of the technologies, frameworks, and domain concepts this codebase relies on. Useful for onboarding, hiring context, or refreshing your own memory before diving back in.

## Languages & Tooling

- **TypeScript** (strict mode, `noUncheckedIndexedAccess`) across the entire monorepo — zero `any` in RBAC/eligibility/analytics code.
- **pnpm workspaces** + **Turborepo** — monorepo task orchestration (`lint`, `typecheck`, `test`, `build` pipelines, cached and parallelized).
- **ESLint** + **Prettier** — enforced via `--max-warnings=0` in CI.
- **Docker Compose** — local Postgres 16 + Redis 7, no native install required.
- **GitHub Actions** — CI gating (service containers for Postgres/Redis, three-role env setup, lint/typecheck/test/build on every PR).

## Backend — `apps/api`

- **NestJS** (modular monolith) — one module per domain (`auth`, `rbac`, `students`, `companies`, `job-descriptions`, `drives`, `policy` (policy-rules), `eligibility`, `offers`, `applications`, `analytics`).
- **Prisma ORM** against **PostgreSQL** — schema-first modeling, hand-appended raw SQL migrations for Row-Level Security (RLS) policies Prisma doesn't manage natively.
- **Multi-tenant RLS architecture**:
  - Every tenant table: `tenant_id` column + `FORCE ROW LEVEL SECURITY` + a `tenant_isolation` policy (`tenant_id = current_setting('app.tenant_id', true)::text`).
  - Three-tier Postgres roles: `pms` (superuser, migrations/seed), `pms_app` (NOBYPASSRLS, app runtime), `pms_authbootstrap` (SELECT-only BYPASSRLS, narrow pre-auth lookups).
  - `TenantPrismaService.run(tenantId, work)` wraps request work in `$transaction` + `set_config('app.tenant_id', ...)` — connection-pooling-safe tenant scoping.
- **RBAC** — code-defined permission registry (`PermissionResource` × `Role` → `PermissionScope`), a `@RequirePermission` decorator + guard, and scope resolution (`FULL`, `OWN_DEPARTMENT`, `SELF`, `PROPOSE`, `ON_BEHALF`, `VIEW`, `NONE`) enforced per-route, not just per-module.
- **Auth** — JWT access/refresh tokens, session table, a provider-interface pattern (`SsoProvider` / `MagicLinkProvider`) so dev-mode stubs can be swapped for real Google/Microsoft SSO and SES/MSG91 magic-link providers later via config flag, no rewrite.
- **BullMQ** (Redis-backed job queues) — debounced/deduplicated async recompute jobs (`@nestjs/bullmq`, `@Processor`/`WorkerHost`), domain events via `@nestjs/event-emitter` bridging into queue jobs.
- **Zod** (via `@pms/types`) — shared runtime validation schemas for every DTO/entity, used identically on both API and web.
- **Jest** — unit tests (pure evaluators, state machines, permission guard matrix) + Supertest e2e tests against a real Dockerized Postgres/Redis (RLS isolation suite, concurrency/race-condition tests, perf assertions).

## Frontend — `apps/web`

- **Next.js 14 (App Router)** — route groups (`(auth)`, `(dashboard)`), client components with `"use client"`, dynamic routes (`companies/[id]`).
- **Tailwind CSS v4** (`@theme` token system) — custom design tokens (brand/neutral/semantic color ramps, radii, a dark-slate sidebar palette layered over a light content canvas).
- **TanStack React Query v5** — server-state caching, `useQueries` for dynamic-length parallel queries, role/token-partitioned query keys, mutation-triggered cache invalidation.
- **Zustand** (`persist` middleware) — client auth-token store (localStorage-backed, dev-stage tradeoff pending a BFF/cookie-based approach).
- **Recharts v3** — funnel/branch visualizations on the analytics dashboard.
- **lucide-react** — icon set for the whole app.
- **Custom design system** (`@pms/ui`) — Button, Input, Label, Card, Skeleton, Badge, Table, Select, Dialog, EmptyState, Avatar, Tabs, DropdownMenu, Toast, PageHeader, StatCard — all built from scratch (no shadcn/Radix dependency), consistent variant/tone conventions across the board.
- **Vitest** + **React Testing Library** — component-level web tests.
- **Playwright** — end-to-end browser verification across role fixtures (login flows, dashboard interactions, console-error checks) — not part of the automated CI pipeline yet, run manually per feature.

## Shared — `packages/`

- **`packages/db`** — Prisma schema, migrations (including hand-written RLS SQL), seed script with realistic multi-role fixtures.
- **`packages/types`** — zod schemas + inferred TS types, one file per domain, shared verbatim between API and web (single source of truth for entity shapes and input DTOs).
- **`packages/ui`** — the design-system component library described above.
- **`packages/config`** — shared ESLint/TS/Tailwind presets (where applicable).

## Domain concepts worth understanding

- **Multi-tenancy**: every institution is a tenant; `institutions` is the tenant root (scoped by its own `id`, not a `tenant_id` column).
- **RBAC scopes** are more granular than allow/deny — `OWN_DEPARTMENT`, `SELF`, `PROPOSE`, and `ON_BEHALF` each imply different query-filtering logic inside the resource's own service layer, not just the guard.
- **Eligibility engine** — per-criterion evaluators (CGPA, backlog count/history, gap years, category, debar status) composed against versioned `PolicyRule` definitions; a dry-run simulator reuses the same evaluators (never a parallel engine) to guarantee simulated and live results can't drift.
- **Policy rule versioning** — rules are never edited in place: a new version is a new row (`status: DRAFT`), and `activate()` atomically archives whatever was previously `ACTIVE` in the same `(tenant, type, name)` family.
- **Offer state machine** — row-locked transactional accept/reject/revoke, slab classification (Dream/Super Dream/Non-Dream), one-offer-per-slab-cap enforcement, PPOs treated as first-class offers.
- **Event-driven analytics** — `applications`/`offers`/`eligibility` modules emit domain events; a debounced BullMQ job recomputes `PlacementSummary` rows via raw SQL (`percentile_cont` for median CTC, never computed in JS). A single shared SQL predicate (`ACCEPTED_OFFER_PREDICATE`) guarantees KPI aggregates and drilldown lists can never disagree.

## Local development

```bash
docker compose up -d          # Postgres 16 + Redis 7
pnpm install
pnpm --filter @pms/db exec prisma migrate deploy
pnpm --filter @pms/db exec tsx prisma/seed.ts
pnpm --filter @pms/api dev     # NestJS on :4000
pnpm --filter @pms/web dev     # Next.js on :3000
```

Full pipeline: `pnpm exec turbo run lint typecheck test build`.
