"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Card, Input, Label, Logo } from "@pms/ui";
import type { RegisterInstitutionResult } from "@pms/types";
import { registerInstitution } from "@/lib/resume/api";
import { ApiError } from "@/lib/api-client";

const ONBOARD_POINTS = [
  "Your data lives in its own tenant — isolated at the database layer, not just the app.",
  "Departments, batches, policies, and drives are configured inside the dashboard.",
  "The placement analytics and NIRF-ready Report Studio work from day one.",
];

export default function RegisterInstitutionPage() {
  const [institutionName, setInstitutionName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "done"; result: RegisterInstitutionResult }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "loading" });
    try {
      const result = await registerInstitution({ institutionName, adminName, adminEmail });
      setState({ kind: "done", result });
    } catch (err) {
      setState({
        kind: "error",
        message:
          err instanceof ApiError && err.status === 409
            ? "An institution with a matching name already exists — try a more specific name."
            : "Couldn't complete registration. Please try again.",
      });
    }
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-[var(--color-sidebar)] text-white">
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

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/">
          <Logo textClassName="text-white" />
        </Link>
        <Link href="/login" className="text-sm font-medium text-white/60 hover:text-white">
          Already onboarded? Sign in
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-5xl flex-1 grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-brand-300 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            Institution onboarding
          </span>
          <h1 className="mt-5 text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl">
            Bring your institution onto the <span className="text-gradient-brand">Placement OS.</span>
          </h1>
          <p className="mt-4 max-w-md text-sm text-white/60 sm:text-base">
            One form creates your institution&apos;s own isolated workspace and its first
            administrator account.
          </p>
          <ul className="mt-8 space-y-3.5">
            {ONBOARD_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-sm text-white/70">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <Card className="bg-white text-neutral-900 shadow-2xl">
          {state.kind === "done" ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <h2 className="mt-4 text-xl font-bold">You&apos;re on the OS</h2>
              <p className="mt-2 text-sm text-neutral-500">
                <strong>{institutionName}</strong> is provisioned. Your institution code is
              </p>
              <p className="mx-auto mt-3 w-fit rounded-lg bg-neutral-100 px-4 py-2 font-mono text-sm font-semibold text-neutral-900">
                {state.result.slug}
              </p>
              <p className="mt-3 text-xs text-neutral-400">
                Share this code with your staff — everyone signs in with it plus their email.
              </p>
              <Link href={`/login?tenant=${encodeURIComponent(state.result.slug)}`} className="mt-6 block">
                <Button className="w-full">
                  Sign in as {state.result.adminEmail}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Register your institution</h2>
                  <p className="text-xs text-neutral-500">Takes under a minute.</p>
                </div>
              </div>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <Label htmlFor="institutionName">Institution name</Label>
                  <Input
                    id="institutionName"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="e.g. Vellore Institute of Technology"
                    minLength={3}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="adminName">Administrator name</Label>
                  <Input
                    id="adminName"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Head of Training & Placement"
                    minLength={2}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="adminEmail">Administrator email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="tpo@your-institution.edu"
                    required
                  />
                  <p className="mt-1 text-xs text-neutral-400">
                    This account gets Super Admin access to your workspace.
                  </p>
                </div>

                {state.kind === "error" && (
                  <p role="alert" className="text-sm text-[var(--color-danger)]">
                    {state.message}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={state.kind === "loading"}>
                  {state.kind === "loading" ? "Provisioning your workspace…" : "Create institution workspace"}
                </Button>
                <p className="text-center text-[11px] text-neutral-400">
                  Each institution is a fully isolated tenant — your records are never visible to
                  another organization.
                </p>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
