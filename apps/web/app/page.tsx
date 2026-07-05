"use client";

import Link from "next/link";
import {
  Award,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@pms/ui";
import { useAuthStore } from "@/lib/auth/auth-store";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Role-aware access control",
    description: "Every record is scoped to tenant, department, and role — enforced at the database layer.",
  },
  {
    icon: Users,
    title: "One pipeline, every stakeholder",
    description: "Students, faculty coordinators, recruiters, and TPOs work from the same live data.",
  },
  {
    icon: BarChart3,
    title: "Placement analytics, live",
    description: "Funnel, branch breakdown, and YoY trends recompute automatically as offers land.",
  },
  {
    icon: ClipboardList,
    title: "Applications, tracked end to end",
    description: "From shortlist to offer, every round and decision is logged against the drive.",
  },
  {
    icon: Building2,
    title: "Companies & drives in one place",
    description: "Manage recruiters, job descriptions, and drive schedules without spreadsheets.",
  },
  {
    icon: Award,
    title: "Offers, approvals, and policy",
    description: "Eligibility, slab, and offer-cap rules are authored once and enforced automatically.",
  },
];

const ROLES = [
  "Super Admin",
  "Training & Placement Officer",
  "Faculty Coordinator",
  "Student",
  "Recruiter",
];

export default function LandingPage() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthed = hasHydrated && !!accessToken;

  return (
    <div className="flex flex-1 flex-col overflow-x-hidden bg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--color-sidebar)]/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-sm font-bold text-white shadow-[var(--shadow-glow-brand)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              P
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">PMS</span>
          </div>
          <Link href={isAuthed ? "/dashboard" : "/login"}>
            <Button size="sm">{isAuthed ? "Go to dashboard" : "Sign in"}</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[var(--color-sidebar)]">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" aria-hidden />
        <div
          className="animate-float-slow pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-[100px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div
          className="animate-float-slower pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-violet-600 opacity-30 blur-[100px]"
          aria-hidden
        />
        <div
          className="animate-float-slow pointer-events-none absolute bottom-1/3 left-1/3 h-64 w-64 rounded-full bg-sky-500 opacity-[0.18] blur-[100px]"
          aria-hidden
        />

        {/* 3D receding grid floor */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 opacity-50 [mask-image:linear-gradient(to_top,black,transparent_85%)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(129,140,248,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(129,140,248,0.5) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            transform: "perspective(500px) rotateX(62deg)",
            transformOrigin: "bottom",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-70"
          style={{
            background: "linear-gradient(to top, var(--color-sidebar), transparent)",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-300 backdrop-blur-sm">
              Enterprise placement platform
            </span>
            <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl">
              Unified placement management for your institution.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-sm text-[var(--color-sidebar-foreground-muted)] sm:text-base">
              Run eligibility, drives, applications, offers, and analytics from one live system —
              built for TPOs, faculty coordinators, students, and recruiters alike.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href={isAuthed ? "/dashboard" : "/login"} className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  {isAuthed ? "Go to dashboard" : "Get started"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#features" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  See what&apos;s inside
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Everything a placement season needs
          </h2>
          <p className="mt-3 text-sm text-neutral-500 sm:text-base">
            One tenant-scoped system that replaces spreadsheets, email threads, and disconnected trackers.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-[var(--radius-xl)] border border-neutral-200/80 bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-white shadow-[var(--shadow-sm)]"
                style={{ background: "var(--gradient-brand)" }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="mt-4 text-sm font-semibold text-neutral-900">{title}</p>
              <p className="mt-1.5 text-sm text-neutral-500">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              Built for every role in the pipeline
            </h2>
            <p className="mt-3 text-sm text-neutral-500 sm:text-base">
              Sign in with your institutional account — what you see is scoped to what your role needs.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {ROLES.map((role) => (
              <span
                key={role}
                className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3.5 py-1.5 text-xs font-medium text-neutral-700"
              >
                {role}
              </span>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link href={isAuthed ? "/dashboard" : "/login"}>
              <Button size="lg">
                {isAuthed ? "Go to dashboard" : "Sign in to PMS"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200/80 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-neutral-400 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} PMS. Internal use only.
        </div>
      </footer>
    </div>
  );
}
