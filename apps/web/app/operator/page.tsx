"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldBan,
  ShieldCheck,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Input,
  Label,
  Logo,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  useToast,
} from "@pms/ui";
import type { InstitutionSummary } from "@pms/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const KEY_STORAGE = "pms-platform-key";

async function operatorFetch<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "x-platform-key": key,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export default function OperatorConsolePage() {
  const [key, setKey] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [rows, setRows] = useState<InstitutionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showProvision, setShowProvision] = useState(false);
  const { show } = useToast();

  const load = useCallback(
    async (k: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await operatorFetch<InstitutionSummary[]>(k, "/operator/institutions");
        setRows(data);
        setUnlocked(true);
        window.sessionStorage.setItem(KEY_STORAGE, k);
      } catch (e) {
        const status = e instanceof Error ? e.message : "";
        setError(
          status === "401"
            ? "Invalid platform key."
            : status === "404"
              ? "The operator console isn't enabled on this deployment (PLATFORM_ADMIN_KEY not set)."
              : "Couldn't reach the platform API.",
        );
        setUnlocked(false);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const saved = window.sessionStorage.getItem(KEY_STORAGE);
    if (saved) {
      setKey(saved);
      void load(saved);
    }
  }, [load]);

  async function toggleStatus(inst: InstitutionSummary) {
    const next = inst.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await operatorFetch(key, `/operator/institutions/${inst.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      show({
        tone: next === "SUSPENDED" ? "danger" : "success",
        title: `${inst.name} ${next === "SUSPENDED" ? "suspended" : "reactivated"}`,
        description:
          next === "SUSPENDED" ? "Their users can no longer start new sessions." : "Logins re-enabled.",
      });
      void load(key);
    } catch {
      show({ tone: "danger", title: "Couldn't update the client's status" });
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--color-sidebar)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" aria-hidden />
      <div
        className="animate-float-slow pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-30 blur-[100px]"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/">
          <Logo textClassName="text-white" />
        </Link>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
          Platform operator — vendor access only
        </span>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        {!unlocked ? (
          <div className="mx-auto max-w-md">
            <Card className="bg-white text-neutral-900">
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-5 w-5 text-brand-600" />
                <h1 className="text-lg font-bold">Operator console</h1>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                Manage your client institutes. Enter the platform key from your deployment&apos;s
                environment settings.
              </p>
              <form
                className="mt-5 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void load(key);
                }}
              >
                <div>
                  <Label htmlFor="platform-key">Platform key</Label>
                  <Input
                    id="platform-key"
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-[var(--color-danger)]">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading || !key}>
                  {loading ? "Checking…" : "Unlock console"}
                </Button>
              </form>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Client institutes</h1>
                <p className="mt-1 text-sm text-white/50">
                  {rows?.length ?? 0} tenants · counts only — client records stay inside their own
                  workspace, unreadable from here.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void load(key)} disabled={loading}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
                <Button onClick={() => setShowProvision(true)}>
                  <Plus className="h-4 w-4" />
                  Provision institute
                </Button>
              </div>
            </div>

            <Card className="bg-white p-0 text-neutral-900">
              {rows === null || loading ? (
                <div className="space-y-2 p-6">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell className="pl-6">Institute</TableHeaderCell>
                      <TableHeaderCell>Code</TableHeaderCell>
                      <TableHeaderCell>Students</TableHeaderCell>
                      <TableHeaderCell>Staff/Users</TableHeaderCell>
                      <TableHeaderCell>Companies</TableHeaderCell>
                      <TableHeaderCell>Drives</TableHeaderCell>
                      <TableHeaderCell>Offers accepted</TableHeaderCell>
                      <TableHeaderCell>Since</TableHeaderCell>
                      <TableHeaderCell>Status</TableHeaderCell>
                      <TableHeaderCell className="pr-6" aria-label="Actions" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell className="pl-6">
                          <span className="flex items-center gap-2 font-medium text-neutral-900">
                            <Building2 className="h-4 w-4 text-neutral-300" />
                            {inst.name}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{inst.slug}</TableCell>
                        <TableCell className="tabular-nums">{inst.counts.students}</TableCell>
                        <TableCell className="tabular-nums">{inst.counts.users}</TableCell>
                        <TableCell className="tabular-nums">{inst.counts.companies}</TableCell>
                        <TableCell className="tabular-nums">{inst.counts.drives}</TableCell>
                        <TableCell className="tabular-nums">{inst.counts.acceptedOffers}</TableCell>
                        <TableCell className="text-xs text-neutral-500">
                          {new Date(inst.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge tone={inst.status === "ACTIVE" ? "success" : "danger"} dot>
                            {inst.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6">
                          <Button
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => void toggleStatus(inst)}
                          >
                            {inst.status === "ACTIVE" ? (
                              <>
                                <ShieldBan className="h-3.5 w-3.5 text-rose-500" /> Suspend
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Reactivate
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        )}
      </main>

      {showProvision && (
        <ProvisionDialog
          platformKey={key}
          onClose={() => setShowProvision(false)}
          onDone={() => {
            setShowProvision(false);
            void load(key);
          }}
        />
      )}
    </div>
  );
}

function ProvisionDialog({
  platformKey,
  onClose,
  onDone,
}: {
  platformKey: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { show } = useToast();
  const [institutionName, setInstitutionName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const result = await operatorFetch<{ slug: string }>(platformKey, "/operator/institutions", {
        method: "POST",
        body: JSON.stringify({ institutionName, adminName, adminEmail }),
      });
      show({
        tone: "success",
        title: "Client provisioned",
        description: `Institution code: ${result.slug} — share it with their placement cell.`,
      });
      onDone();
    } catch {
      show({ tone: "danger", title: "Couldn't provision", description: "A similar institution may already exist." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Provision a client institute"
      description="Creates their isolated workspace and first Super Admin — sales-led onboarding."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="prov-name">Institution name</Label>
          <Input id="prov-name" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} minLength={3} required autoFocus />
        </div>
        <div>
          <Label htmlFor="prov-admin">Admin name</Label>
          <Input id="prov-admin" value={adminName} onChange={(e) => setAdminName(e.target.value)} minLength={2} required />
        </div>
        <div>
          <Label htmlFor="prov-email">Admin email</Label>
          <Input id="prov-email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Provisioning…" : "Provision"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
