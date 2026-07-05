
| Decision | My call | Why (one line) |
|---|---|---|
| **Tech stack** | Next.js 14 (App Router, TS) · NestJS (modular monolith, TS) · PostgreSQL 16 + Prisma · Redis/BullMQ · pgvector · S3 | One language end-to-end, strong RBAC/multi-tenant ergonomics in Nest, and pgvector kills the need for a separate vector DB at your scale. |
| **Scale target** | **Multi-tenant SaaS** (tenant = institution); a single college is simply tenant #1 | Same build serves one college or a university group of N departments; you never rewrite to sell more. |
| **Hosting/budget** | Managed AWS (ECS Fargate, RDS Postgres, ElastiCache, S3, CloudFront), Terraform IaC. Start ~₹40–70k/mo infra, scales horizontally | Managed services keep a 6-person team building product, not babysitting servers. |
| **Timeline / team** | ~10 months to V1+AI. Team of 6–7: 1 TL/architect, 2 BE, 2 FE, 1 AI/ML, 1 designer, fractional QA/DevOps | Senior-heavy small team ships enterprise quality faster than a large junior one. |

**Additional assumptions flagged:** compliance target is India's **DPDP Act 2023** (not GDPR); SMS goes through **DLT-registered templates** (TRAI mandate); recruiters authenticate via **magic link** (they won't manage passwords), students/staff via **institutional SSO** (Google Workspace / Microsoft 365, which most Indian colleges already run).

---

# PART A — THE MASTER PLAN

## 1. Executive Vision

**"Best in India" concretely means:** a TPO opens one screen on any morning of placement season and can answer *every* question — who's eligible for tomorrow's drive, which students are at risk of going unplaced, what our median CTC is vs last year, is our NIRF submission ready — without touching a spreadsheet. And the system enforces the college's real policy automatically, so a debarred student *cannot* apply and an ineligible one *cannot* slip through.

The product wins on three axes competitors ignore: (1) a **genuine policy/eligibility engine** modeled on real Indian rules, not a generic ATS; (2) **historical data as a first-class citizen** — messy past-year Excel becomes queryable, comparable data; (3) **premium UX** that makes a government college's placement cell look like a Series-B startup.

**Measurable success metrics:**

| Metric | Baseline (manual) | Target |
|---|---|---|
| TPO hours/week on data ops | 25–30 | < 5 |
| Time to compute eligible list for a drive | 2–6 hours | < 5 seconds |
| Eligibility errors (wrong student allowed to sit) | frequent | 0 (engine-enforced) |
| Time to generate NAAC/NIRF placement report | 3–10 days | < 2 minutes |
| Student profile completeness (post resume-parse) | ~40% | > 90% |
| Historical years searchable in one view | 0 | all imported years |
| Notification reach (student sees drive alert) | ~60% (email only) | > 95% (email+SMS+WhatsApp) |

## 2. Personas & Role-Based Access Matrix

Five roles, each with a distinct dashboard. RBAC is **resource-action** based, tenant-scoped, and (for Faculty Coordinators) **department-scoped**.

| Resource / Action | Super Admin | TPO | Dept/Faculty Coord. | Student | Recruiter HR |
|---|:--:|:--:|:--:|:--:|:--:|
| Tenant/institution config | ✅ | ⚙️ view | ❌ | ❌ | ❌ |
| Policy rules (create/edit) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Student records (all depts) | ✅ | ✅ | 🔒 own dept | 🔒 self | ❌ |
| Bulk import / historical data | ✅ | ✅ | 🔒 own dept | ❌ | ❌ |
| Company/recruiter records | ✅ | ✅ | 👁️ view | 👁️ limited | 🔒 self |
| Create drive / round pipeline | ✅ | ✅ | ⚙️ propose | ❌ | ❌ |
| Post JD / shortlist candidates | ✅ | ✅ | ❌ | ❌ | 🔒 own JDs |
| Apply to drive | ❌ | on-behalf | on-behalf | 🔒 self | ❌ |
| Offer create / accept-reject | ✅ | ✅ | 👁️ | 🔒 accept/reject own | propose |
| Debar / waive policy | ✅ | ✅ | ❌ | ❌ | ❌ |
| Analytics — institution-wide | ✅ | ✅ | 🔒 own dept | 👁️ personal | 🔒 own drives |
| Accreditation reports | ✅ | ✅ | 👁️ own dept | ❌ | ❌ |
| User & role management | ✅ | 🔒 non-admin | ❌ | ❌ | ❌ |
| Audit log | ✅ | 👁️ | ❌ | ❌ | ❌ |

Legend: ✅ full · 🔒 scoped · ⚙️ config-limited · 👁️ read-only · ❌ none.

## 3. High-Level System Architecture

```
                    ┌─────────────────────────────────────┐
   Web/Mobile ─────▶│  Next.js App Router (SSR + BFF)      │
   (5 dashboards)   │  shadcn/ui · TanStack Query          │
                    └───────────────┬─────────────────────┘
                                    │ REST/tRPC (JWT, tenant-scoped)
                    ┌───────────────▼─────────────────────┐
                    │  NestJS Modular Monolith             │
                    │  ┌────────┬────────┬──────────────┐  │
                    │  │ Auth/  │ Policy │ Drive/App    │  │
                    │  │ RBAC   │ Engine │ Pipeline     │  │
                    │  ├────────┼────────┼──────────────┤  │
                    │  │ Student│ Company│ Analytics    │  │
                    │  │ Module │ /CRM   │ Aggregator   │  │
                    │  └────────┴────────┴──────────────┘  │
                    └───┬─────────┬──────────┬─────────────┘
        ┌───────────────┘         │          └──────────────┐
   ┌────▼─────┐   ┌───────────────▼──────┐   ┌──────────────▼───┐
   │ Postgres │   │  BullMQ / Redis      │   │  AI Service Layer │
   │ +RLS     │   │  (imports, notifs,   │   │  LLM API + embed  │
   │ +pgvector│   │   AI jobs, exports)  │   │  (parse/match/    │
   └──────────┘   └──────────┬───────────┘   │   predict/chat)   │
                             │                └──────────────────┘
                  ┌──────────▼───────────┐
                  │ Notification adapters │  Email(SES) · SMS(MSG91/DLT)
                  │                       │  · WhatsApp(Meta Cloud API)
                  └───────────────────────┘
   External: S3 (resumes/exports) · SSO (Google/MS) · Coding-test webhooks
             (HackerRank/HackerEarth) · optional payroll/ERP sync
```

**Key architectural choices:** modular monolith (not microservices) — a 6-person team ships faster with clean module boundaries you *can* extract later. **Tenant isolation via Postgres Row-Level Security** (every table carries `tenant_id`, enforced at the DB, not just the app). **All heavy work is async** through BullMQ: a 50-year Excel import, a 2,000-student notification blast, and a batch resume-parse never block a request.

## 4. Core Data Model

Key entities (fields abbreviated; every table has `tenant_id`, timestamps, soft-delete):

- **Institution** (tenant) — config, branding, policy defaults, accreditation IDs.
- **Department / Program** — B.Tech-CSE, MBA, MCA, M.Tech-VLSI, etc.; belongs to Institution.
- **AcademicBatch** — e.g., "2022–2026"; the placement cohort unit.
- **Student** — belongs to Department + Batch. Holds `academic_profile` (CGPA, 10th %, 12th %, active_backlogs, backlog_history, gap_years, diploma_flag), `contact`, `resume_url`, `placement_status` (unplaced / placed-slab / debarred / opted-out), `category` (general/reserved if used for eligibility).
- **Company** — belongs to Institution's CRM; `sector`, `tier`, contacts, visit_history.
- **Recruiter (User)** — HR person linked to Company.
- **JobDescription (JD)** — belongs to Company; `role`, `ctc_lpa`, `ctc_breakup`, `slab` (dream/super-dream/non-dream — *derived* from policy), `eligible_programs[]`, `min_criteria` snapshot, `location`, `bond`.
- **Drive** — the campus event for a JD (or multi-JD). Has `status`, `round_pipeline[]`, `schedule`.
- **Round** — ordered stage in a Drive: `type` (aptitude/coding/GD/technical/HR/offer), `mode`, `cutoff`, `scheduled_at`.
- **Application** — Student ↔ Drive join. `current_round`, `status` (applied/shortlisted/in-round/rejected/selected/withdrawn), per-round results.
- **Offer** — result of an Application (or a PPO from internship). `ctc_lpa`, `slab`, `status` (extended/accepted/rejected/revoked), `is_ppo`, `source_internship_id`.
- **PolicyRule** — configurable, versioned, per-institution (see §5 Policy engine). Types: eligibility-criteria, slab-definition, offer-cap, debar-rule, re-eligibility.
- **EligibilityEvaluation** — cached result of running PolicyRules × Student × JD (with reasons).
- **NotificationLog** — every email/SMS/WhatsApp, with delivery status + template ref.
- **AuditEvent** — who did what, when (policy waivers, debars, overrides especially).
- **ImportJob** — a historical/bulk upload with mapping, validation report, row lineage.

Relationship spine: `Institution 1─* Department 1─* Student *─* Drive (via Application) 1─* Offer`; `Company 1─* JD 1─1 Drive 1─* Round`; `PolicyRule *── evaluated against ──* Student/JD`.

## 5. Feature Modules (by domain)

**A. Student Lifecycle**
Purpose: own the student from onboarding to placed. Why it matters: clean, complete student data is the fuel for eligibility + AI + reporting; garbage in = everything breaks. Sub-features: SSO onboarding, resume upload → AI autofill, profile completeness meter, academic-history editor (with backlog/gap tracking), placement-status timeline, opt-out/higher-studies flagging. Dependencies: Core schema, Auth, AI resume parser.

**B. Company & Drive Management**
Purpose: a lightweight recruiter CRM + the drive engine. Why it matters: this is the TPO's daily cockpit and the recruiter's only touchpoint. Sub-features: company CRM with visit history, recruiter portal (magic-link), JD builder with auto-slab classification, drive creation, **round-pipeline builder** (drag-order aptitude→GD→tech→HR→offer), shortlist upload/sync, per-round result entry, coding-test webhook ingestion. Dependencies: Policy engine (slab derivation), Notifications.

**C. Policy & Eligibility Engine** *(the crown jewel)*
Purpose: encode a college's real placement rules and enforce them automatically. Why it matters: this is what makes it a *placement system*, not a generic ATS — and it's where every Indian competitor is weak. Sub-features: configurable rule builder (CGPA/%/10th/12th/backlog/gap/program cutoffs), slab definitions (dream/super-dream/non-dream by CTC threshold), **one-student-one-offer + slab-based re-eligibility** (placed-in-non-dream can still sit for dream, etc.), offer-rejection debarring, PPO/internship-conversion handling, per-drive override with mandatory audit reason, dry-run simulation. Dependencies: Core schema, Student, Drive.

**D. Data Ingestion & Historical Import**
Purpose: turn years of chaotic Excel into structured, comparable data. Why it matters: your "one view" is worthless if it only starts today; historical YoY is what accreditation wants. Sub-features: column auto-mapping, fuzzy dedup, per-cell validation with fixable error report, per-year normalization, row lineage, idempotent re-import. Dependencies: Core schema.

**E. Analytics & Reporting**
Purpose: the unified view + accreditation outputs. Why it matters: NAAC/NBA/NIRF/AICTE deadlines are non-negotiable and currently cost weeks. Sub-features: unified dashboard (§6), YoY trends, per-branch/company drilldowns, at-risk-student detection, **one-click accreditation reports** (placement %, highest/median/average CTC, recruiter count), Excel/PDF export. Dependencies: all data modules.

**F. AI Suite** — see §5 detail below.

**G. Notifications**
Purpose: reach students/recruiters where they actually are. Why it matters: an unread email = a missed drive. Sub-features: email (SES) + SMS (MSG91, **DLT-registered templates**) + WhatsApp (Meta Cloud API), event-driven triggers (shortlist, round result, deadline), per-user channel preferences, delivery tracking, bulk blast with rate-limiting. Dependencies: Drive/Application events.

**H. Admin & Platform**
Purpose: run the tenant safely. Sub-features: institution config + branding, user/role management, audit log viewer, DPDP consent + data-retention, backups. Dependencies: Auth/RBAC.

### AI Suite — per-capability spec (what · data · fallback)

| Capability | What it does | Data it needs | Fallback when uncertain |
|---|---|---|---|
| **Resume parsing → autofill** | Extracts education, skills, projects, experience → prefills profile | PDF/DOCX resume | Low-confidence fields flagged yellow, left blank for manual entry; never silently overwrites verified academic data |
| **Candidate ↔ JD matching & ranking** | Scores/ranks eligible students against a JD (skills, projects, CGPA fit) | Student profiles + JD text + embeddings | Show score *with reasons*; TPO can always see full eligible list unranked; ranking never gates eligibility |
| **Automated eligibility check** | Explains *why* a student passes/fails policy in plain language | PolicyRules + student academics | The deterministic engine (§5C) is authoritative; AI only *narrates* it, never decides |
| **Predictive placement analytics + skill-gap** | Flags at-risk students, predicts placement likelihood, surfaces missing skills vs demand | Historical + current placement data, JD skill frequency | Present as probability with confidence band + drivers; labeled "estimate," never a hard verdict on a student |
| **Interview-prep assistant** | Role/company-specific mock Q&A, feedback | JD, company history, student profile | Falls back to a curated question bank if generation is thin |
| **TPO/Student chatbot** | Answers "am I eligible for X drive," "median CTC 2024," etc. | RBAC-scoped data + policy engine | Routes policy/eligibility questions to the engine; on low confidence, hands off with "check with your TPO" + link |

**Global AI guardrail:** AI *assists and explains*; deterministic engines *decide*. Eligibility, slab, debarring, and offer-cap outcomes are never produced by an LLM.

## 6. Unified Analytics Layer — "The One View"

A single dashboard, role-adaptive, that answers "how is placement going?" at a glance and drills to any detail. Top strip: live KPIs — **placement %**, students placed / eligible / unplaced, highest / median / average CTC, active drives, recruiters this season, YoY delta on each. Middle: a **season funnel** (registered → eligible → applied → shortlisted → selected → placed) and a branch-wise heatmap. Right rail: **at-risk students** (unplaced + high CGPA, or many rejections) and **upcoming drives with eligible counts**. A global date/batch/branch/company filter re-scopes the entire view. One toggle switches "current season" ↔ "all-time / YoY." Every number is clickable to its underlying list, and every list exports to Excel/PDF. This is the screen §1 promises.

## 7. UI/UX Design System

What separates this from a "college project" is restraint and consistency, not decoration.

- **Tokens:** an 8-pt spacing scale; a neutral gray ramp + a single brand accent (per-tenant, defaults to a deep indigo) + semantic colors (success/warn/danger/info). Radii 6/8/12px. Two elevation levels max.
- **Typography:** one geometric sans (Inter or Geist). Type scale 12/14/16/20/24/32. Tabular-nums for all metrics so columns align. Numbers are the hero — they get the weight, labels stay muted.
- **Component language:** shadcn/ui + Radix primitives. Data-dense tables with sticky headers, inline filters, and column controls (Linear-style). Command-palette (⌘K) navigation. Toasts, not alert boxes. Empty states that teach.
- **Layout:** generous whitespace, a fixed left nav, content max-width for readability, keyboard-first. Skeleton loaders, never spinners, on async.
- **"Premium" tells:** consistent 150ms transitions, no gradient soup, no clip-art, real empty/error/loading states everywhere, and *density that respects the TPO's time* — the opposite of a bootstrapped admin template.

## 8. Phased Roadmap

| Phase | Ships | Why this order |
|---|---|---|
| **Phase 0 — Foundations** (wks 1–6) | Multi-tenant schema + RLS, Auth/SSO, RBAC engine, design system, audit log, CI/CD | Nothing is safe or buildable without tenant isolation + RBAC first. |
| **MVP** (wks 7–16) | Student profiles + **AI resume parsing**, Company/Drive + round pipeline, **Policy & Eligibility engine**, Applications, Offers, basic notifications (email+SMS) | Delivers the core loop: onboard students → run a compliant drive → record offers. Usable for one live season. |
| **V1** (wks 17–28) | Historical bulk import, **Unified Analytics "one view"**, accreditation report generator, Excel/PDF export, WhatsApp channel, recruiter portal polish | Turns a working tool into the *system of record* — and makes accreditation trivial. |
| **Advanced / AI** (wks 29–40) | Candidate↔JD matching, predictive/skill-gap analytics, interview-prep assistant, TPO/student chatbot, mobile-optimized student app | AI features need real data volume (from MVP+V1) to be trustworthy — sequencing them last is deliberate, not lazy. |

## 9. Risks, Edge Cases & Handling

- **Policy is per-college and mutates mid-season** → rules are *versioned*; evaluations record which rule version applied; changing a rule never silently rewrites history.
- **Messy historical Excel** → import is a supervised pipeline with a fixable validation report and row lineage; no silent coercion; re-import is idempotent.
- **Slab re-eligibility ambiguity** ("placed in non-dream, can I sit for dream?") → modeled explicitly as configurable re-eligibility rules with a **dry-run simulator** so TPOs verify behavior before a drive.
- **PPO double-counting against offer cap** → PPOs are first-class Offers with `is_ppo` + `source_internship_id`; cap logic references offer count, not application count.
- **AI hallucination on eligibility** → deterministic engine is authoritative; AI only narrates. Hard rule.
- **SMS/WhatsApp compliance** → DLT-registered templates only; sends blocked if template unregistered; opt-out honored.
- **DPDP / data privacy** → consent capture, retention windows, RLS, PII access audited; recruiters see only shortlisted-relevant data.
- **Debarred student tries to apply** → blocked at API *and* hidden in UI; attempt logged.
- **Concurrent offer acceptance / race conditions** → offer state transitions are transactional with row locks; one-offer cap enforced in the same transaction.
- **Notification storms** (2,000 students, one deadline) → BullMQ rate-limiting + provider throttles; batched, retried, tracked.

---

# PART B — THE DECOMPOSITION

## Reusable Sub-Prompt Template

```
SUB-PROMPT SP-XX — <Feature Name>
1. Feature name
2. Priority & dependencies (which SPs must exist first)
3. Why it matters (1–2 lines, business value)
4. Scope — In / Out (explicit boundaries)
5. Data model touchpoints (entities/fields read & written)
6. API / contract (endpoints, request/response shapes, events emitted)
7. UI spec (screens, states, components, interactions)
8. AI behavior + fallback (if any; else "none")
9. Acceptance criteria (testable, given/when/then)
10. Edge cases & error states
11. Definition of "bug-free / done" (tests, coverage, a11y, perf bar)
```

## Sub-Prompt Index (dependency-ordered, grouped by module)

| # | Sub-prompt | Module | Depends on |
|---|---|---|---|
| **SP-01** | Multi-tenant foundation, Auth (SSO + magic link) & RBAC engine | Foundations | — |
| SP-02 | Core data schema & migrations (all entities) | Foundations | 01 |
| SP-03 | Design system & component library setup | Foundations | — |
| SP-04 | Audit log & activity trail | Foundations | 01,02 |
| SP-05 | Institution config & per-tenant branding | Admin | 01,02 |
| SP-06 | User & role management UI | Admin | 01,04 |
| SP-07 | Student profile & academic-history model | Student Lifecycle | 02 |
| **SP-08** | AI resume parsing → profile autofill | Student Lifecycle | 07 |
| SP-09 | Student self-service dashboard | Student Lifecycle | 07 |
| SP-10 | Bulk/historical student import (Excel) + validation | Data Ingestion | 07 |
| SP-11 | Company/recruiter CRM & profiles | Company/Drive | 02 |
| SP-12 | JD builder + auto-slab classification | Company/Drive | 11, 15 |
| SP-13 | Drive creation & round-pipeline builder | Company/Drive | 12 |
| SP-14 | Recruiter portal (magic-link, JD post, shortlist) | Company/Drive | 11,12 |
| **SP-15** | Policy rule builder (versioned, configurable) | Policy Engine | 02,07 |
| **SP-16** | Eligibility evaluation engine (real-time + dry-run) | Policy Engine | 15 |
| SP-17 | One-offer cap + slab re-eligibility logic | Policy Engine | 16 |
| SP-18 | Offer management (accept/reject/debar) | Policy Engine | 17 |
| SP-19 | PPO / internship-conversion handling | Policy Engine | 18 |
| SP-20 | Application & round-progression tracking | Company/Drive | 13,16 |
| SP-21 | Coding-test webhook ingestion (HackerRank/HackerEarth) | Company/Drive | 20 |
| SP-22 | Notification service (email/SMS/WhatsApp, DLT) | Notifications | 01 |
| SP-23 | Event-driven notification triggers & preferences | Notifications | 22,20 |
| SP-24 | Unified analytics dashboard ("one view") | Analytics | 20,18 |
| SP-25 | Accreditation report generator (NAAC/NBA/NIRF/AICTE) | Analytics | 24 |
| SP-26 | Export engine (Excel/PDF) | Analytics | 24 |
| SP-27 | Historical & YoY trend analytics | Analytics | 10,24 |
| SP-28 | AI candidate↔JD matching & ranking | AI Suite | 08,12 |
| SP-29 | Predictive placement + skill-gap analytics | AI Suite | 27 |
| SP-30 | Interview-prep assistant | AI Suite | 08,12 |
| SP-31 | TPO/student chatbot (RBAC-scoped) | AI Suite | 16,24 |
| SP-32 | DPDP consent, retention & backups | Admin | 02 |

---

## The First 3 Highest-Priority Sub-Prompts (full)

I chose these three because they are the true first builds: **SP-01** is the bedrock nothing else can exist without, **SP-16** is the differentiating heart of the product, and **SP-08** is the highest-value, most self-contained AI feature.

---

### SP-01 — Multi-Tenant Foundation, Auth & RBAC Engine

**2. Priority & dependencies:** Priority 1. Depends on: none. Blocks: everything.

**3. Why it matters:** Every row of data, every permission check, and every future SaaS customer depends on tenant isolation and role enforcement being correct *at the database level*. A leak here is catastrophic; getting it right once removes an entire class of bugs forever.

**4. Scope — In:** tenant model + provisioning; Postgres Row-Level Security; SSO login (Google Workspace / Microsoft 365) for staff/students; magic-link login for recruiters; JWT + refresh sessions; a declarative RBAC engine (resource-action, tenant-scoped, department-scoped for coordinators); a `@RequirePermission()` guard; session middleware injecting `tenant_id` + role. **Out:** user *management UI* (SP-06), branding (SP-05), audit log (SP-04) — this SP only emits events for them.

**5. Data model touchpoints:**
- `Institution(id, name, slug, sso_config, status)`
- `User(id, tenant_id, email, role, department_id?, auth_provider, status)`
- `Role` = enum: `SUPER_ADMIN | TPO | FACULTY_COORD | STUDENT | RECRUITER`
- `Session(id, user_id, refresh_token_hash, expires_at)`
- `Permission` registry (code-defined): `{resource, action} → allowed roles + scope`
- RLS policy on **every** tenant table: `USING (tenant_id = current_setting('app.tenant_id'))`

**6. API / contract:**
- `POST /auth/sso/callback` → `{ token, refreshToken, user }`
- `POST /auth/magic-link/request { email }` → `202`; `POST /auth/magic-link/verify { token }` → session
- `POST /auth/refresh { refreshToken }` → new token
- `POST /auth/logout` → `204`
- `GET /me` → `{ id, tenantId, role, departmentId, permissions[] }`
- Emits events: `user.logged_in`, `session.created` (consumed by audit).
- Contract rule: **every** authenticated request resolves `tenant_id` from the JWT and sets `app.tenant_id` in the DB session; no query runs without it.

**7. UI spec:** A clean centered login screen with two paths — "Continue with Google/Microsoft" (staff/students) and "Email me a link" (recruiters), auto-detected by domain where possible. States: idle, loading (skeleton, not spinner), magic-link-sent confirmation, error (expired/invalid link → friendly re-request). Post-login, route by role to the correct dashboard shell. 403 pages explain *what* permission is missing, not just "Forbidden."

**8. AI behavior + fallback:** None.

**9. Acceptance criteria:**
- Given a user from tenant A, when they query any endpoint, then no row from tenant B is ever returned (verified by an RLS test that seeds two tenants and asserts isolation).
- Given a FACULTY_COORD of Dept X, when they list students, then only Dept X students return.
- Given a RECRUITER, when they request a magic link, then a single-use, 15-min-expiry token is emailed and consumed on first use.
- Given an expired/refresh-rotated token, when reused, then it is rejected and the session invalidated.
- Given any request missing a valid tenant context, when it reaches the DB, then it fails closed (returns nothing / errors), never leaks.

**10. Edge cases & error states:** SSO email domain not mapped to a tenant → clear "your institution isn't set up" message; magic-link reuse → rejected with re-request; user disabled mid-session → next request 401; role changed mid-session → permissions re-resolved on next request; two tenants sharing a user email → email is unique *per tenant*, resolved by login path/domain.

**11. Definition of done:** RLS isolation test suite green (cross-tenant read/write/update all blocked); RBAC matrix (§2) covered by unit tests per role×resource; auth flows have integration tests; token rotation + revocation tested; p95 auth check < 20ms; a11y AA on login screen; zero `any` in the permission engine; documented `@RequirePermission` usage.

---

### SP-16 — Eligibility Evaluation Engine (real-time + dry-run)

**2. Priority & dependencies:** Priority 1 (product heart). Depends on: SP-02 (schema), SP-07 (student academics), SP-15 (policy rule builder — its rule schema is consumed here). Blocks: SP-17, SP-20, SP-24, SP-31.

**3. Why it matters:** This is the feature that makes it a *placement system*. It replaces hours of manual VLOOKUP-ing and eliminates the recurring disaster of an ineligible or debarred student being allowed to sit. It must be deterministic, explainable, and fast.

**4. Scope — In:** evaluate a Student against a JD/Drive and return pass/fail **with per-rule reasons**; support all Indian criteria — CGPA/%, 10th %, 12th %, active backlogs (0 or N allowed), backlog history, gap years, diploma flag, program/branch eligibility, category cutoffs; batch-evaluate a whole cohort for a drive; a **dry-run simulator** (evaluate hypothetical rule changes without persisting); cache results in `EligibilityEvaluation` keyed by (student, JD, ruleVersion). **Out:** slab re-eligibility & offer-cap (SP-17 layers on top), the rule *authoring UI* (SP-15), debarring transitions (SP-18).

**5. Data model touchpoints:**
- Reads: `Student.academic_profile`, `Department/Program`, `JobDescription.min_criteria`, `PolicyRule` (versioned set), `Student.placement_status`.
- Writes: `EligibilityEvaluation(student_id, jd_id, rule_version, result, reasons[], evaluated_at)`.
- `reasons[]` shape: `{ ruleCode, ruleLabel, passed: bool, expected, actual, message }`.

**6. API / contract:**
- `GET /drives/:driveId/eligibility` → `{ eligible: Student[], ineligible: {student, reasons[]}[], summary }` (batch, cached)
- `POST /eligibility/evaluate { studentId, jdId }` → single result with reasons
- `POST /eligibility/dry-run { jdId, proposedRules[] }` → cohort counts + diff vs current (persists nothing)
- Contract: engine is **pure/deterministic** — same inputs + rule version ⇒ same output. No LLM in this path. Emits `eligibility.recomputed` when rules or student data change (triggers cache invalidation).

**7. UI spec:** Inside a Drive, an "Eligibility" tab: top summary (X eligible / Y ineligible), a filterable table of ineligible students each with an expandable **reason chip list** ("CGPA 6.4 < required 7.0", "2 active backlogs > allowed 0"). A "Simulate rule change" panel where a TPO tweaks a threshold and instantly sees "would add 14 / remove 3 students" before committing. Eligible list is one-click exportable and one-click "notify eligible." Loading = skeleton rows; empty = "No students match — check criteria."

**8. AI behavior + fallback:** None in the decision path. (An *optional* later layer, SP-31, can narrate reasons conversationally — but the deterministic engine is always authoritative.)

**9. Acceptance criteria:**
- Given a student with CGPA 6.4 and a JD requiring 7.0, when evaluated, then result = fail with reason `{ruleCode: CGPA, expected: 7.0, actual: 6.4}`.
- Given a student with 1 active backlog and a JD allowing 0, then fail with backlog reason.
- Given a JD open to CSE+IT only, when an ECE student is evaluated, then fail with program reason.
- Given a debarred student, then fail with status reason (regardless of academics).
- Given a batch eval of 2,000 students, when requested, then completes < 5s and results are cached; a second call is < 200ms.
- Given a dry-run with a lowered CGPA cutoff, then returned counts differ correctly and **nothing is persisted**.
- Given identical inputs + rule version, then output is byte-identical across runs (determinism test).

**10. Edge cases & error states:** missing academic data (e.g., null 10th %) → treated as fail-with-reason "data missing," never silently pass; student in multiple programs → evaluate against enrolled program; rule version changes mid-season → old evaluations retain their version, new ones recompute; percentage-vs-CGPA colleges → engine normalizes per institution config; a JD with no criteria → everyone in eligible programs passes (explicit, not accidental).

**11. Definition of done:** exhaustive unit tests per rule type + combination matrix; determinism test; batch-perf test (< 5s / 2,000); cache invalidation test on rule/student change; 100% branch coverage on the rule evaluator; zero LLM/network calls in the evaluation path; dry-run proven side-effect-free.

---

### SP-08 — AI Resume Parsing → Profile Autofill

**2. Priority & dependencies:** Priority 2 (highest-value AI, self-contained). Depends on: SP-07 (student profile). Blocks: SP-28, SP-30 (matching/prep reuse parsed skills).

**3. Why it matters:** Manual profile entry is why student data sits at ~40% complete. One upload should populate 90%+ of a profile in seconds — this single feature is the difference between rich AI/analytics downstream and garbage-in.

**4. Scope — In:** accept PDF/DOCX resume; extract structured fields (education, skills, projects, experience, certifications, links); map to profile with **per-field confidence**; present a review-before-save diff; never overwrite verified academic fields (CGPA etc. are authoritative from records, not the resume). **Out:** resume *generation/formatting*, JD matching (SP-28).

**5. Data model touchpoints:**
- Reads/writes `Student.profile` (skills[], projects[], experience[], certifications[], links).
- Writes `Student.resume_url` (S3), `ResumeParseJob(id, student_id, status, confidence_map, raw_extract)`.
- Never writes `academic_profile.cgpa/backlogs/10th/12th` (registrar-owned) — these are read-only reference during review.

**6. API / contract:**
- `POST /students/:id/resume` (multipart) → `{ jobId }` (async via BullMQ)
- `GET /resume-jobs/:jobId` → `{ status, extracted: {...}, confidenceMap: {field: 0–1} }`
- `POST /students/:id/profile/apply { fields }` → persists only user-confirmed fields
- AI contract: LLM called with **structured-output schema**; returns typed JSON only; low-confidence fields (< 0.7) flagged, never auto-applied.

**7. UI spec:** Upload dropzone → progress ("Parsing your resume…" skeleton) → a **side-by-side review**: left = extracted values, right = current profile, with confidence badges (green ≥0.85, yellow 0.7–0.85, blank <0.7 requiring manual entry). Student toggles which fields to accept, edits inline, then "Apply." Academic fields shown greyed with a "from records" lock icon. Error state: unreadable/scanned PDF → "We couldn't read this — enter manually or re-upload a text PDF."

**8. AI behavior + fallback:** LLM extracts to schema with confidence. **Fallbacks:** (a) fields < 0.7 confidence are left blank for manual entry, never guessed into the profile; (b) if the file is an image/scanned PDF, run OCR first, and if still low-quality, degrade gracefully to full manual entry; (c) parsing never blocks profile completion — a student can always edit by hand; (d) the LLM output is schema-validated and rejected if malformed, with a retry then manual fallback.

**9. Acceptance criteria:**
- Given a standard text PDF resume, when parsed, then ≥90% of present skills/projects/experience are extracted with correct field mapping.
- Given extraction, when reviewed, then no field is written to the profile without explicit student confirmation.
- Given a resume listing a CGPA that differs from records, when applied, then the registrar CGPA is untouched and the discrepancy is not written.
- Given a scanned/image PDF, when uploaded, then OCR runs; if unreadable, a clear manual-entry fallback is shown (no crash, no garbage data).
- Given malformed LLM output, when returned, then it's rejected/retried and never persisted.

**10. Edge cases & error states:** multi-column/creative resume layouts (test set included); non-English/mixed-language sections → best-effort + flag; corrupt/oversized file → validated before job; duplicate skills → deduped; PII beyond scope (e.g., religion) → not extracted; two rapid uploads → latest job wins, prior cancelled.

**11. Definition of done:** parses a fixture set of ≥20 real-world Indian student resume formats at ≥90% field accuracy; confidence gating tested; academic-field protection tested; OCR fallback tested; malformed-output rejection tested; async job idempotent; p95 parse < 15s; no PII-out-of-scope leakage; review UI a11y AA.

---

That's the full master plan, the reusable template, the complete dependency-ordered index, and the three highest-priority sub-prompts written to hand-off quality.

