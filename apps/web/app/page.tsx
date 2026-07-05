"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  ClipboardList,
  FileCheck2,
  Gauge,
  IndianRupee,
  MessageCircle,
  Radar,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  X as XIcon,
} from "lucide-react";
import { Button, Logo, cn } from "@pms/ui";
import { useAuthStore } from "@/lib/auth/auth-store";

const INDIA_EDGE = [
  {
    icon: FileCheck2,
    title: "NIRF & NAAC reports in seconds",
    description:
      "One click turns live placement data into an accreditation-ready report — placement %, median CTC, branch-wise tables — formatted the way ranking bodies expect. What takes placement cells weeks, PMS does before the meeting starts.",
    tag: "Report Studio",
  },
  {
    icon: IndianRupee,
    title: "₹-native CTC intelligence",
    description:
      "Dream, Super Dream, and Non-Dream slabs are first-class. CTC breakups, PPO tracking, offer caps, and median/highest analytics in lakhs per annum — the way Indian placement seasons actually run.",
    tag: "Slab analytics",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp-first communication",
    description:
      "Drive announcements, shortlist alerts, and offer updates over the channel Indian students actually read — with email and SMS fallbacks, every send logged and auditable.",
    tag: "Notifications",
  },
  {
    icon: ScrollText,
    title: "Policy engine with an audit trail",
    description:
      "Eligibility criteria, debar rules, and offer caps are versioned policies — every evaluation records exactly which rule version produced it. When a parent or auditor asks 'why was my child ineligible', you have the receipt.",
    tag: "Governance",
  },
];

const PLATFORM = [
  {
    icon: ShieldCheck,
    title: "Role-aware access control",
    description: "Tenant, department, and role scoping enforced at the database layer, not just the UI.",
  },
  {
    icon: Gauge,
    title: "Eligibility engine with reasons",
    description: "Every student × JD evaluation returns pass/fail per rule — expected vs actual, no black box.",
  },
  {
    icon: Radar,
    title: "Placement intelligence",
    description: "Live funnel, at-risk signals, and YoY deltas recomputed automatically as offers land.",
  },
  {
    icon: ClipboardList,
    title: "Drives, rounds, and results",
    description: "Aptitude to HR, every round and decision is logged against the drive — end to end.",
  },
  {
    icon: Building2,
    title: "Companies & recruiters, CRM-style",
    description: "Tiers, sectors, JDs, bond terms, and drive history for every recruiting relationship.",
  },
  {
    icon: Users,
    title: "Built for university groups",
    description: "One college or a 40-department group — same system, strict tenant isolation, zero rewrites.",
  },
];

const COMPARISON = [
  { capability: "Branch-wise placement % for NIRF", old: "Weeks of Excel consolidation", now: "Generated live, always current" },
  { capability: "Eligibility for a 7 LPA Dream drive", old: "Manual filtering, disputes later", now: "Policy-versioned, reasons recorded" },
  { capability: "Telling 400 students about a drive", old: "Notice board + forwarded PDFs", now: "WhatsApp, SMS & email, logged" },
  { capability: "Offer caps & debar rules", old: "Tribal knowledge, applied unevenly", now: "Enforced automatically, audited" },
  { capability: "Who touched this record?", old: "Nobody knows", now: "Full audit trail, every action" },
];

const ROLES = [
  "Super Admin",
  "Training & Placement Officer",
  "Faculty Coordinator",
  "Student",
  "Recruiter",
];

const MOCK_FUNNEL = [
  { label: "Eligible", pct: 100, value: "1,240" },
  { label: "Applied", pct: 82, value: "1,017" },
  { label: "Shortlisted", pct: 54, value: "670" },
  { label: "Selected", pct: 31, value: "384" },
  { label: "Placed", pct: 28, value: "347" },
];

function HeroMock() {
  return (
    <div
      className="relative mx-auto mt-14 w-full max-w-4xl"
      style={{ perspective: "1200px" }}
      aria-hidden
    >
      <div
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-2xl backdrop-blur-md"
        style={{ transform: "rotateX(8deg)", transformOrigin: "top" }}
      >
        <div className="flex items-center gap-1.5 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="ml-3 hidden flex-1 rounded-md bg-white/[0.06] px-3 py-1 text-left text-[10px] text-white/40 sm:block">
            pms.institution.edu/dashboard
          </span>
        </div>
        <div className="rounded-xl bg-[#0b0d14] p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Placement %", value: "87.4%", delta: "▲ 6.2 pts YoY" },
              { label: "Median CTC", value: "₹8.5L", delta: "▲ ₹1.2L YoY" },
              { label: "Highest CTC", value: "₹52L", delta: "Super Dream" },
              { label: "Active drives", value: "23", delta: "6 this week" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-3 text-left">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">{kpi.label}</p>
                <p className="mt-1 text-lg font-bold text-white sm:text-xl">{kpi.value}</p>
                <p className="mt-0.5 text-[10px] font-medium text-emerald-400/90">{kpi.delta}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-left sm:col-span-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">Placement funnel · 2025-26</p>
              <div className="mt-3 space-y-2.5">
                {MOCK_FUNNEL.map((row, i) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-[10px] text-white/50">{row.label}</span>
                    <div className="h-3.5 flex-1 overflow-hidden rounded-r-[4px] bg-white/[0.04]">
                      <div
                        className="animate-grow-bar h-full rounded-r-[4px] bg-gradient-brand"
                        style={{ width: `${row.pct}%`, animationDelay: `${200 + i * 120}ms` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[10px] font-semibold text-white/70">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-4 text-left sm:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/40">NIRF report</p>
                <span className="animate-pulse-soft inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                  <BadgeCheck className="h-2.5 w-2.5" /> READY
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {["Placement % — 3-yr trend", "Median salary (₹ LPA)", "Branch-wise tables", "Top recruiters"].map((line) => (
                  <div key={line} className="flex items-center gap-2">
                    <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                    <span className="text-[11px] text-white/60">{line}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3.5 rounded-md bg-gradient-brand px-3 py-1.5 text-center text-[10px] font-semibold text-white">
                Export for accreditation
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="pointer-events-none absolute -inset-x-8 -bottom-10 h-24 opacity-60 blur-2xl"
        style={{ background: "var(--gradient-brand)", maskImage: "linear-gradient(to top, black, transparent)" }}
      />
    </div>
  );
}

export default function LandingPage() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthed = hasHydrated && !!accessToken;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 32);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaHref = isAuthed ? "/dashboard" : "/login";
  const ctaLabel = isAuthed ? "Go to dashboard" : "Get started";

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden bg-[var(--color-sidebar)] text-white">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-30 transition-colors duration-300",
          scrolled
            ? "border-b border-white/10 bg-[var(--color-sidebar)]/80 backdrop-blur-md"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/">
            <Logo textClassName="text-white" />
          </Link>
          <div className="flex items-center gap-2">
            <a href="#india-edge" className="hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:block">
              Why PMS
            </a>
            <a href="#platform" className="mr-2 hidden text-sm font-medium text-white/60 transition-colors hover:text-white sm:block">
              Platform
            </a>
            <Link href={ctaHref}>
              <Button size="sm">{isAuthed ? "Go to dashboard" : "Sign in"}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" aria-hidden />
        <div
          className="animate-float-slow pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-[100px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div
          className="animate-float-slower pointer-events-none absolute right-0 top-1/4 h-80 w-80 rounded-full bg-violet-600 opacity-30 blur-[100px]"
          aria-hidden
        />
        <div
          className="animate-float-slow pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-sky-500 opacity-[0.18] blur-[100px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 opacity-40 [mask-image:linear-gradient(to_top,black,transparent_85%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(129,140,248,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(129,140,248,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            transform: "perspective(500px) rotateX(62deg)",
            transformOrigin: "bottom",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-28 text-center sm:px-6 sm:pt-36 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-brand-300 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            The Placement OS — built for Indian institutions
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Run your entire placement season on <span className="text-gradient-brand">one live system.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-white/60 sm:text-lg">
            Eligibility, drives, offers, WhatsApp-first comms, and NIRF/NAAC-ready reporting — replacing the
            spreadsheets, notice boards, and email threads your placement cell fights every season.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={ctaHref} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#india-edge" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                See the India edge
              </Button>
            </a>
          </div>

          <HeroMock />
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────────── */}
      <section className="relative border-y border-white/[0.07] bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: "< 30 sec", label: "to an accreditation-ready NIRF report" },
            { value: "5 roles", label: "TPO to recruiter, one scoped system" },
            { value: "100%", label: "of actions audit-trailed, by design" },
            { value: "₹ native", label: "LPA, slabs & PPOs as first-class data" },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 text-center lg:text-left">
              <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-white/50 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── India edge ───────────────────────────────────────── */}
      <section id="india-edge" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-300">The India edge</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Not adapted for India. <span className="text-gradient-brand">Architected for it.</span>
          </h2>
          <p className="mt-4 text-sm text-white/55 sm:text-base">
            Global placement tools bolt on Indian workflows as an afterthought. PMS starts from how Indian
            placement seasons, ranking bodies, and students actually operate.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2">
          {INDIA_EDGE.map(({ icon: Icon, title, description, tag }) => (
            <div
              key={title}
              className="card-hover-lift group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 backdrop-blur-sm hover:border-brand-400/30"
            >
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 blur-[70px] transition-opacity duration-500 group-hover:opacity-25"
                style={{ background: "var(--gradient-brand)" }}
                aria-hidden
              />
              <div className="relative flex items-start justify-between">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[var(--shadow-glow-brand)]"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                  {tag}
                </span>
              </div>
              <h3 className="relative mt-5 text-lg font-semibold text-white">{title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-white/55">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform grid ────────────────────────────────────── */}
      <section id="platform" className="relative border-t border-white/[0.07] bg-white/[0.02]">
        <div className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-brand-300">Platform</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a placement season needs
            </h2>
            <p className="mt-4 text-sm text-white/55 sm:text-base">
              One tenant-scoped system that replaces spreadsheets, email threads, and disconnected trackers.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="card-hover-lift rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 hover:border-white/20"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="mt-4 text-sm font-semibold text-white">{title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/50">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────── */}
      <section className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-300">Before / after</span>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            The placement cell, off spreadsheets
          </h2>
        </div>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03] text-xs uppercase tracking-wide text-white/40">
                <th className="px-5 py-3.5 font-semibold">Capability</th>
                <th className="px-5 py-3.5 font-semibold">Spreadsheets & notice boards</th>
                <th className="px-5 py-3.5 font-semibold text-brand-300">With PMS</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.capability} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-5 py-4 font-medium text-white">{row.capability}</td>
                  <td className="px-5 py-4 text-white/45">
                    <span className="flex items-start gap-2">
                      <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400/70" />
                      {row.old}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-white/80">
                    <span className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      {row.now}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Roles + CTA ──────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/[0.07]">
        <div
          className="animate-float-slow pointer-events-none absolute left-1/2 top-0 h-96 w-[42rem] -translate-x-1/2 rounded-full opacity-25 blur-[110px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Built for every role in the pipeline
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/55 sm:text-base">
            Sign in with your institutional account — what you see is scoped to exactly what your role needs.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {ROLES.map((role) => (
              <span
                key={role}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70"
              >
                <Award className="h-3 w-3 text-brand-300" />
                {role}
              </span>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={ctaHref}>
              <Button size="lg">
                {isAuthed ? "Go to dashboard" : "Sign in to PMS"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-white/35">
            <BarChart3 className="h-3.5 w-3.5" />
            Live analytics, policy enforcement, and audit logging are active from day one.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-center sm:flex-row sm:px-6 lg:px-8">
          <Logo size="sm" textClassName="text-white" />
          <p className="text-xs text-white/35">
            © {new Date().getFullYear()} PMS · The Placement OS for Indian institutions
          </p>
        </div>
      </footer>
    </div>
  );
}
