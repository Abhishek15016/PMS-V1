# Skills & Tech Stack — Placement Management System (PMS)

A reference of the technologies, frameworks, and domain concepts this codebase relies on. Useful for onboarding, hiring context, or refreshing your own memory before diving back in.

## Product positioning

PMS is pitched as **"The Placement OS for Indian institutions"** — not a generic tracker. The India-specific differentiators (all shipped, not vaporware, except where noted):

- **Report Studio** (`/reports`) — one click turns live analytics data into an accreditation-ready placement report (executive summary, funnel & conversion, branch-wise tables, YoY comparison, signature blocks) formatted the way NIRF/NAAC disclosures expect. Print/save-as-PDF via print CSS: the entire dashboard chrome carries `print:hidden` Tailwind variants so the report prints as a clean document. Institution name is click-to-edit, persisted in localStorage (the API has no institution-display-name field yet).
- **₹-native CTC intelligence** — Dream/Super Dream/Non-Dream slabs, CTC breakups (`ctcBreakup` Json on JD: fixed/variable/ESOPs/joining bonus), bond months, PPOs as first-class offers.
- **WhatsApp-first comms** — `WHATSAPP` exists in `NotificationChannel` and demo `NotificationLog` rows exist, but **no real send pipeline is wired yet** — don't oversell this in a live demo beyond what the landing page claims.
- **Placement intelligence** — derived signals computed client-side from data the API already returns (eligible-but-not-applied count, biggest funnel-stage leak, YoY trend, empty-pipeline alert); no ML, every number traceable to the summary.

Route map: `/` is a public dark-theme marketing landing page; the app lives under `/dashboard` (auth-gated route group). `/reports` is Report Studio (staff only).

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
- **Custom design system** (`@pms/ui`) — Button, Input, Label, Card, Skeleton, Badge, Table, Select, Dialog, EmptyState, Avatar, Tabs, DropdownMenu, Toast, PageHeader, StatCard, Logo — all built from scratch (no shadcn/Radix dependency), consistent variant/tone conventions across the board.
- **App-level components** (`apps/web/components/`):
  - `command-palette.tsx` — Ctrl/Cmd+K palette; role-filtered page jump + sign out, keyword search (e.g. "nirf" finds Report Studio). The sidebar search button triggers it by dispatching a synthetic Ctrl+K `KeyboardEvent`.
  - `company-logo.tsx` — resolves a real logo from the company's `website` domain via Google's favicon service (`google.com/s2/favicons?domain=…&sz=128`), falling back to a deterministic colored monogram on missing domain or load error. Plain `<img>`, not `next/image` (arbitrary remote host would need whitelisting).
  - `student-home.tsx` — the personalized student dashboard (see role UX below).
- **Shared navigation module** (`apps/web/lib/navigation.ts`) — single `NAV_ITEMS` source (label/href/icon/roles/palette keywords) consumed by both the sidebar and the command palette; add a page once, it appears in both.
- **Role-differentiated UX** — staff get the analytics snapshot + placement-intelligence signals + Top Recruiters (ranked live from accepted offers); students get `StudentHome`: placement-status hero, profile-strength meter (0–100 heuristic in `lib/students/profile-strength.ts`, shared with the Students page), and an "Open drives for you" feed that previews each JD's `minCriteria` against the student's own record ("Needs CGPA ≥ 8.5 — you: 7.85") with one-click apply. The client-side check is a *preview only* — the server-side eligibility engine remains the authority on submit.
- **Module-page conventions** — every list page (students/companies/offers/applications) follows the same pattern: a toolbar Card with search + dropdown filters whose options are **derived from the fetched data** (never hardcoded lists), live insight chips (counts/rates computed from the filtered rows), and logo/avatar-rich rows. Filtering/sorting is client-side over the fetched list (fine at demo scale).
- **Vitest** + **React Testing Library** — component-level web tests.
- **Playwright** — end-to-end browser verification across role fixtures (login flows, dashboard interactions, console-error checks) — not part of the automated CI pipeline yet, run manually per feature. **Local verification recipe**: the prod API only allows CORS from the Vercel origin, so localhost can't hit it — build (`NEXT_PUBLIC_API_URL=<render-url> pnpm --filter @pms/web build`), `next start`, then in Playwright seed localStorage key `pms-auth` (zustand persist shape `{state: {accessToken, refreshToken, user}, version: 0}`) and `page.route()` the API host with type-shaped fixture JSON (answer OPTIONS preflights with allow-* headers). This exercises the real production bundle against controlled data.

## Shared — `packages/`

- **`packages/db`** — Prisma schema, migrations (including hand-written RLS SQL), seed script with realistic multi-role fixtures.
- **`packages/types`** — zod schemas + inferred TS types, one file per domain, shared verbatim between API and web (single source of truth for entity shapes and input DTOs).
- **`packages/ui`** — the design-system component library described above.
- **`packages/config`** — shared ESLint/TS/Tailwind presets (where applicable).

## Domain concepts worth understanding

- **Multi-tenancy**: every institution is a tenant; `institutions` is the tenant root (scoped by its own `id`, not a `tenant_id` column).
- **RBAC scopes** are more granular than allow/deny — `OWN_DEPARTMENT`, `SELF`, `PROPOSE`, and `ON_BEHALF` each imply different query-filtering logic inside the resource's own service layer, not just the guard. Notable: `STUDENT` holds `VIEW` on `drives.manage` (so students can browse open drives to apply); the drives controller restricts `VIEW` to read-only — DRAFT/CANCELLED drives are excluded from list and 404 on detail (never confirm a draft exists), the per-drive eligibility roster endpoint is forbidden (peer data), and all write endpoints explicitly reject `VIEW`. The registry spec (`permissions.registry.spec.ts`) asserts the whole matrix verbatim — change both files together.
- **Eligibility engine** — per-criterion evaluators (CGPA, backlog count/history, gap years, category, debar status) composed against versioned `PolicyRule` definitions; a dry-run simulator reuses the same evaluators (never a parallel engine) to guarantee simulated and live results can't drift.
- **Policy rule versioning** — rules are never edited in place: a new version is a new row (`status: DRAFT`), and `activate()` atomically archives whatever was previously `ACTIVE` in the same `(tenant, type, name)` family.
- **Offer state machine** — row-locked transactional accept/reject/revoke, slab classification (Dream/Super Dream/Non-Dream), one-offer-per-slab-cap enforcement, PPOs treated as first-class offers.
- **Event-driven analytics** — `applications`/`offers`/`eligibility` modules emit domain events; a debounced BullMQ job recomputes `PlacementSummary` rows via raw SQL (`percentile_cont` for median CTC, never computed in JS). A single shared SQL predicate (`ACCEPTED_OFFER_PREDICATE`) guarantees KPI aggregates and drilldown lists can never disagree.
- **Placed ≠ Selected** — `placedCount` comes from `Student.placementStatus`, not `Application.status = SELECTED`, because PPOs have no Application at all. Consequence: Placed can legitimately exceed Selected in the funnel, so a Selected→Placed "conversion %" is meaningless and the dashboard deliberately hides it when > 100%.
- **Seeding a demo instance means hand-feeding the runtime machinery too** — a raw-row seed bypasses domain events, so nothing recomputes `PlacementSummary` and nothing writes `EligibilityEvaluation` rows (the summary SQL counts eligible students *from that table*). Both hand-run seeds account for this; if you add a third, do the same or the dashboards stay empty no matter how many students you insert.

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

## Production deployment (free tier)

Live at (repo: `Abhishek15016/PMS-V1`, this repo was recreated from scratch — history was squashed to a single commit to scrub a contributor's dev-machine identity that had leaked into every prior commit's author field):

| Layer | Host | Notes |
|---|---|---|
| Frontend | **Vercel** — `https://pms-v1-web.vercel.app` | Root directory `apps/web`. Auto-redeploys on every push to `main`. `NEXT_PUBLIC_*` vars are baked in at **build** time — changing one requires a manual redeploy, not just a save. |
| Backend | **Render** (free web service) — `https://pms-api-b9cg.onrender.com` | Defined by `render.yaml` (Blueprint) at repo root. Free tier spins down after ~15 min idle; first request after that takes ~50s. `/health` and `/health/db` are the health-check endpoints. |
| Postgres | **Neon** (free tier) | Database is named `pms` (not the default `neondb` — had to be created explicitly, since migrations hardcode `GRANT ... ON DATABASE pms`). Neon's "owner" role (`neondb_owner`) is used only for migrations (mapped to `MIGRATION_DATABASE_URL`); the app itself connects as `pms_app`/`pms_authbootstrap` per the existing three-role RLS model. Neon gives both a **pooled** connection string (`-pooler` in the hostname — used for `DATABASE_URL`) and a **direct** one (used for `DIRECT_URL`/migrations). |
| Redis | **Upstash** (free tier) | TLS-only endpoint (`rediss://`). `apps/api/src/app.module.ts`'s BullMQ connection factory explicitly passes `tls: {}` when the URL scheme is `rediss:` — ioredis doesn't infer this from the URL when given a parsed options object instead of the raw string. |

**Real connection strings/secrets are not committed anywhere in this repo** — they live only in the Render/Vercel dashboards' environment variable settings (`render.yaml` deliberately marks them `sync: false` placeholders). If you need to rotate or inspect them, go to the respective dashboard, not the git history.

### Demo login (SSO stub, no real passwords)

Tenant slug: `demo-college`. Pick a role and use its email on the login page's "Staff & Students" tab (Recruiter uses the separate "Recruiter" tab + its dev-mode magic-link button):

| Role | Email |
|---|---|
| Super Admin | `super.admin@demo-college.edu` |
| TPO | `tpo@demo-college.edu` |
| Faculty Coord (CSE) | `faculty.cse@demo-college.edu` |
| Student (CSE) | `student@demo-college.edu` |
| Student (ECE) | `student2.ece@demo-college.edu` |
| Recruiter | `recruiter@demo-college.edu` |

### Demo dataset (two hand-run seeds, both already applied to the deployed instance)

Neither is run in CI or part of `seed.ts` — both are run by hand with a superuser `DATABASE_URL` and are guarded against double-running:

- **`packages/db/prisma/seed-extra.ts`** (guard: company "Zoho Corporation" exists) — the base Indian-college dataset: 6 departments, 2 batches (2021-2025 senior ~70% placed, 2022-2026 current ~30%), ~96 students with Indian names/rolls/categories, 12 recruiting companies (TCS through Google, spanning all three CTC slabs), drives/rounds/applications/round-results/offers, 3 active policy rules.
- **`packages/db/prisma/seed-extra2.ts`** (guard: company "Zomato" exists) — the layer that makes dashboards light up: 10 more marquee recruiters (Zomato, Swiggy, Razorpay, CRED, PhonePe, Freshworks, Deloitte, Bosch, Qualcomm, Goldman Sachs) with CTC breakups/bonds/locations + their applications/rounds/offers; CTC breakups backfilled onto the original JDs; a coherence pass so every PLACED student holds an ACCEPTED offer (creating PPOs for some) and vice versa; ~1,100 `EligibilityEvaluation` rows with per-rule reasons; WhatsApp/email `NotificationLog` rows; `AuditEvent` rows; and a full `PlacementSummary` recompute for every batch × (tenant-wide + department) that mirrors `summary-recompute.service.ts`'s SQL exactly (the BullMQ worker never fires for hand-inserted rows — see domain concepts).

Post-seed state (deployed): 23 companies, ~100 students, ~680 applications, ~80 offers (10 PPOs), 14 summary rows.

### Deployment gotchas actually hit (in case they recur)

These were each discovered the hard way going from a green CI to a working production deploy — CI passing does **not** guarantee `apps/api`'s `start` script or a fresh cloud Postgres/Redis actually work:

1. **`pnpm/action-setup` errors if both a workflow `version` input and `package.json`'s `packageManager` field are set** and the strings don't match exactly (e.g. one hash-pinned, one not) — `ERR_PNPM_BAD_PM_VERSION` / "Multiple versions of pnpm specified". Keep exactly one source of truth (we dropped the workflow input, kept `packageManager` unpinned).
2. **pnpm 11.9.0 requires Node.js ≥22.13.** Running it under Node 20 crashes with `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` the moment `actions/setup-node`'s `cache: pnpm` step (or Render) tries to invoke it. CI and Render are both pinned to Node 22.
3. **`apps/api`'s `start` script (`node dist/main.js`) never actually worked**, on any host — `nest build` only compiles `apps/api`'s own source; `@pms/db`/`@pms/types` are consumed as raw `.ts` via their `package.json` `"main"` pointing straight at `src/index.ts` (no build step for those packages), and plain `node` can't load `.ts` without a loader. Fixed by registering ts-node in `start` too: `node -r ts-node/register/transpile-only dist/main.js` (matches what `dev` already did). CI never caught this because it only ever ran `nest build`, never `start`.
4. **Turborepo 2.x strips undeclared env vars from spawned tasks** ("strict" env mode is the default) — `DATABASE_URL`/`REDIS_URL`/JWT secrets/etc. were invisible inside `turbo run test` even though the CI job set them, until added to `globalPassThroughEnv` in `turbo.json`.
5. **Prisma Migrate uses `directUrl`, not `url`/`DATABASE_URL`**, for `migrate deploy`. Overriding only `DATABASE_URL` to the superuser connection for the migrations step left `DIRECT_URL` pointing at the not-yet-created `pms_app` role, causing a chicken-and-egg auth failure.
6. **`@prisma/client`'s automatic postinstall generation silently no-ops** because the schema lives at `packages/db/prisma/schema.prisma`, not a default-searched location — nothing else in the pipeline called `prisma generate` explicitly, so anything importing `@prisma/client` crashed with "did not initialize yet" until an explicit generate step was added.
7. **`DropdownMenu`'s default downward placement clips when its trigger sits near the bottom of the viewport** (the sidebar's user/logout menu) — it gained a `side="top"|"bottom"` prop for this.
8. **A YAML folded scalar (`>-`) doesn't always join the way you'd expect** — an indented continuation line got treated as a separate shell statement rather than staying chained with `&&`, silently detaching an env-var override from the command it was meant for. Keep multi-command `buildCommand`/`run` strings on one literal line when in doubt.
9. **Tailwind's `bg-[var(--gradient-brand)]` arbitrary value compiles to `background-color`**, which cannot hold a `linear-gradient()` — the browser silently drops the whole declaration, leaving white-on-nothing "invisible" primary buttons. Use the dedicated `.bg-gradient-brand` utility (sets `background-image`) defined in `globals.css` instead. Same trap applies to any gradient token.
10. **The prod API's `CORS_ORIGIN` is pinned to the Vercel origin** — a localhost frontend can never call it directly. Not a bug; local verification goes through the Playwright network-mock recipe (Frontend section), or run the full local stack.
11. **A backend-touching push needs both hosts to finish deploying** — Vercel usually lands first; Render's free tier is slower and cold-starts (~50s) after idle. A frontend feature that depends on a new API capability (e.g. students listing drives) will look broken in the window between the two deploys.
12. **On Windows, a backgrounded `next start` can outlive its parent shell/task** — the port stays bound and you end up smoke-testing the *previous* build without realizing. Before starting: `netstat -ano | grep :<port>` and `taskkill //PID <pid> //F` if anything is listening.
13. **`@RequirePermission` guard passes for ANY scope ≠ NONE** — granting a role `VIEW` on a resource silently grants it access to *every* route on that controller unless each mutating/route handler checks `req.permissionScope` itself. When widening a role's scope, audit every handler under that resource (this is why the drives controller now has explicit `VIEW` rejections on create/round/status/eligibility).
