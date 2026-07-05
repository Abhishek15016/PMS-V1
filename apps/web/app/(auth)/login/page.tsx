"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button, Card, Input, Label, Tabs } from "@pms/ui";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  fetchDevMagicLinkToken,
  requestMagicLink,
  ssoCallback,
  verifyMagicLink,
} from "@/lib/auth/api";
import { ApiError } from "@/lib/api-client";

type Tab = "staff" | "recruiter";
type FlowState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "magic-link-sent"; email: string; tenantSlug: string }
  | { kind: "error"; message: string };

const DEMO_TENANT_SLUG = "demo-college";
const DEMO_EMAILS = [
  "super.admin@demo-college.edu",
  "tpo@demo-college.edu",
  "faculty.cse@demo-college.edu",
  "student@demo-college.edu",
  "recruiter@demo-college.edu",
];

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | undefined;
    if (body?.message) return Array.isArray(body.message) ? body.message.join(", ") : body.message;
    if (err.status === 404) return "We couldn't find that institution.";
    if (err.status === 401) return "That email doesn't have an active account here.";
  }
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [tab, setTab] = useState<Tab>("staff");
  const [tenantSlug, setTenantSlug] = useState(DEMO_TENANT_SLUG);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FlowState>({ kind: "idle" });

  useEffect(() => {
    if (hasHydrated && accessToken) {
      router.replace("/");
    }
  }, [hasHydrated, accessToken, router]);

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "loading" });
    try {
      const result = await ssoCallback(tenantSlug, email);
      setSession(result);
      router.replace("/");
    } catch (err) {
      setState({ kind: "error", message: errorMessage(err) });
    }
  }

  async function handleRecruiterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "loading" });
    try {
      await requestMagicLink(tenantSlug, email);
      setState({ kind: "magic-link-sent", email, tenantSlug });
    } catch (err) {
      setState({ kind: "error", message: errorMessage(err) });
    }
  }

  async function handleOpenDevMagicLink() {
    if (state.kind !== "magic-link-sent") return;
    setState({ kind: "loading" });
    try {
      const { token } = await fetchDevMagicLinkToken(state.email);
      const result = await verifyMagicLink(token);
      setSession(result);
      router.replace("/");
    } catch (err) {
      setState({ kind: "error", message: errorMessage(err) });
    }
  }

  const isLoading = state.kind === "loading";

  return (
    <Card className="shadow-md">
      <h1 className="text-xl font-semibold tracking-tight text-neutral-900">Sign in to PMS</h1>
      <p className="mt-1 text-sm text-neutral-500">Enter your institutional credentials to continue.</p>

      <Tabs
        className="mt-6 w-full"
        items={[
          { value: "staff", label: "Staff & Students" },
          { value: "recruiter", label: "Recruiter" },
        ]}
        value={tab}
        onChange={(v) => {
          setTab(v as Tab);
          setState({ kind: "idle" });
        }}
      />

      {state.kind === "magic-link-sent" ? (
        <div className="mt-6 space-y-4">
          <div className="flex gap-3 rounded-[var(--radius-md)] bg-brand-50 p-4 text-sm text-brand-700">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              We sent a magic link to <strong>{state.email}</strong>. Click it to sign in — links
              expire in 15 minutes and can only be used once.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={handleOpenDevMagicLink}
            disabled={isLoading}
          >
            {isLoading ? "Opening…" : "Dev mode: open my magic link"}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-neutral-500 underline underline-offset-2"
            onClick={() => setState({ kind: "idle" })}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={tab === "staff" ? handleStaffSubmit : handleRecruiterSubmit}
        >
          <div>
            <Label htmlFor="tenantSlug">Institution</Label>
            <Input
              id="tenantSlug"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              placeholder="your-college"
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@institution.edu"
              required
            />
          </div>

          {state.kind === "error" && (
            <p role="alert" className="text-sm text-[var(--color-danger)]">
              {state.message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? "Please wait…"
              : tab === "staff"
                ? "Continue with institutional SSO"
                : "Email me a link"}
          </Button>

          <p className="text-xs text-neutral-400">
            Dev-mode seeded accounts: {DEMO_EMAILS.join(", ")}
          </p>
        </form>
      )}
    </Card>
  );
}
