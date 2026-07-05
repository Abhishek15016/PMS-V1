"use client";

import { useState } from "react";
import { CheckCircle2, Plus, ShieldCheck, XCircle } from "lucide-react";
import {
  Badge,
  BadgeTone,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  useToast,
} from "@pms/ui";
import type {
  DebarRuleDefinition,
  DryRunResult,
  EligibilityCriteriaDefinition,
  JobDescription,
  OfferCapDefinition,
  PolicyRule,
  PolicyRuleType,
  ReEligibilityDefinition,
  SlabDefinition,
} from "@pms/types";
import { useDryRunEligibility } from "@/lib/eligibility/use-eligibility";
import { useJobDescriptions } from "@/lib/job-descriptions/use-job-descriptions";
import {
  useActivatePolicyRule,
  useCreatePolicyRule,
  useCreatePolicyRuleVersion,
  usePolicyRules,
} from "@/lib/policy-rules/use-policy-rules";

const RULE_TYPES: PolicyRuleType[] = [
  "ELIGIBILITY_CRITERIA",
  "SLAB_DEFINITION",
  "OFFER_CAP",
  "DEBAR_RULE",
  "RE_ELIGIBILITY",
];

const RULE_TYPE_LABELS: Record<PolicyRuleType, string> = {
  ELIGIBILITY_CRITERIA: "Eligibility criteria",
  SLAB_DEFINITION: "Slab definition",
  OFFER_CAP: "Offer cap",
  DEBAR_RULE: "Debar rule",
  RE_ELIGIBILITY: "Re-eligibility",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  ACTIVE: "success",
  ARCHIVED: "neutral",
};

export default function PolicyPage() {
  const [tab, setTab] = useState<"rules" | "simulator">("rules");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Policy & Eligibility"
        description="Author versioned eligibility, slab, offer-cap, and debar rules; simulate criteria changes before activating them."
      />

      <Tabs
        items={[
          { value: "rules", label: "Policy rules" },
          { value: "simulator", label: "Eligibility simulator" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as "rules" | "simulator")}
      />

      {tab === "rules" ? <PolicyRulesTab /> : <SimulatorTab />}
    </div>
  );
}

function PolicyRulesTab() {
  const [typeFilter, setTypeFilter] = useState<PolicyRuleType | "">("");
  const rules = usePolicyRules({ type: typeFilter || undefined });
  const [showCreate, setShowCreate] = useState(false);
  const [versioningRule, setVersioningRule] = useState<PolicyRule | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label htmlFor="type-filter">Rule type</Label>
          <Select
            id="type-filter"
            className="mt-1 w-56"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as PolicyRuleType | "")}
          >
            <option value="">All types</option>
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RULE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          New rule
        </Button>
      </div>

      <Card className="p-0">
        {rules.isLoading ? (
          <div className="space-y-2 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rules.data && rules.data.length > 0 ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className="pl-6">Name</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Version</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="pr-6" />
              </TableRow>
            </TableHead>
            <TableBody>
              {rules.data.map((rule) => (
                <RuleRow key={rule.id} rule={rule} onNewVersion={() => setVersioningRule(rule)} />
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No policy rules yet"
            description="Create your first eligibility criteria or slab definition."
            action={
              <Button variant="secondary" onClick={() => setShowCreate(true)}>
                + New rule
              </Button>
            }
          />
        )}
      </Card>

      <CreateRuleDialog open={showCreate} onClose={() => setShowCreate(false)} />
      {versioningRule && (
        <NewVersionDialog rule={versioningRule} onClose={() => setVersioningRule(null)} />
      )}
    </div>
  );
}

function RuleRow({ rule, onNewVersion }: { rule: PolicyRule; onNewVersion: () => void }) {
  const activate = useActivatePolicyRule();
  const { show } = useToast();

  return (
    <TableRow interactive>
      <TableCell className="pl-6 font-medium text-neutral-900">{rule.name}</TableCell>
      <TableCell>{RULE_TYPE_LABELS[rule.type]}</TableCell>
      <TableCell>v{rule.version}</TableCell>
      <TableCell>
        <Badge tone={STATUS_TONE[rule.status]} dot>
          {rule.status}
        </Badge>
      </TableCell>
      <TableCell className="pr-6">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" className="h-7 px-2 text-xs" onClick={onNewVersion}>
            New version
          </Button>
          {rule.status === "DRAFT" && (
            <Button
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={activate.isPending}
              onClick={() =>
                activate.mutate(rule.id, {
                  onSuccess: () => show({ tone: "success", title: "Rule activated", description: `${rule.name} v${rule.version}` }),
                  onError: () => show({ tone: "danger", title: "Couldn't activate rule" }),
                })
              }
            >
              Activate
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** One editable-fields block per PolicyRuleType — shape mirrors @pms/types' POLICY_RULE_DEFINITION_SCHEMAS exactly. */
function DefinitionFields({
  type,
  value,
  onChange,
}: {
  type: PolicyRuleType;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  function set(key: string, v: unknown) {
    onChange({ ...value, [key]: v });
  }

  if (type === "ELIGIBILITY_CRITERIA") {
    const v = value as EligibilityCriteriaDefinition;
    return (
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Min CGPA" value={v.minCgpa} onChange={(n) => set("minCgpa", n)} step="0.1" max={10} />
        <NumberField label="Min 10th %" value={v.minTenthPercent} onChange={(n) => set("minTenthPercent", n)} max={100} />
        <NumberField label="Min 12th %" value={v.minTwelfthPercent} onChange={(n) => set("minTwelfthPercent", n)} max={100} />
        <NumberField label="Max active backlogs" value={v.maxActiveBacklogs} onChange={(n) => set("maxActiveBacklogs", n)} />
        <NumberField label="Max backlog history" value={v.maxBacklogHistory} onChange={(n) => set("maxBacklogHistory", n)} />
        <NumberField label="Max gap years" value={v.maxGapYears} onChange={(n) => set("maxGapYears", n)} />
        <CheckboxField label="Allow diploma holders" checked={v.allowDiploma ?? false} onChange={(c) => set("allowDiploma", c)} />
        <div className="col-span-2">
          <Label htmlFor="allowedCategories">Allowed categories (comma-separated, blank = any)</Label>
          <Input
            id="allowedCategories"
            value={(v.allowedCategories ?? []).join(", ")}
            onChange={(e) =>
              set(
                "allowedCategories",
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              )
            }
            placeholder="GEN, OBC, SC, ST"
          />
        </div>
      </div>
    );
  }

  if (type === "SLAB_DEFINITION") {
    const v = value as Partial<SlabDefinition>;
    return (
      <div className="grid grid-cols-2 gap-4">
        <NumberField label="Dream min CTC (LPA)" value={v.dreamMinCtc} onChange={(n) => set("dreamMinCtc", n)} required />
        <NumberField label="Super Dream min CTC (LPA)" value={v.superDreamMinCtc} onChange={(n) => set("superDreamMinCtc", n)} required />
      </div>
    );
  }

  if (type === "OFFER_CAP") {
    const v = value as Partial<OfferCapDefinition>;
    return <CheckboxField label="One offer per slab tier" checked={v.oneOfferPerSlabTier ?? false} onChange={(c) => set("oneOfferPerSlabTier", c)} />;
  }

  if (type === "DEBAR_RULE") {
    const v = value as Partial<DebarRuleDefinition>;
    return (
      <div className="space-y-4">
        <CheckboxField label="Debar on offer rejection" checked={v.debarOnOfferRejection ?? false} onChange={(c) => set("debarOnOfferRejection", c)} />
        <NumberField label="Max rejections before debar" value={v.maxRejectionsBeforeDebar} onChange={(n) => set("maxRejectionsBeforeDebar", n)} min={1} />
      </div>
    );
  }

  const v = value as Partial<ReEligibilityDefinition>;
  return (
    <div className="space-y-3">
      <CheckboxField label="Allow Dream after Non-Dream" checked={v.allowDreamAfterNonDream ?? false} onChange={(c) => set("allowDreamAfterNonDream", c)} />
      <CheckboxField label="Allow Dream after Super Dream" checked={v.allowDreamAfterSuperDream ?? false} onChange={(c) => set("allowDreamAfterSuperDream", c)} />
      <CheckboxField label="Allow Super Dream after Non-Dream" checked={v.allowSuperDreamAfterNonDream ?? false} onChange={(c) => set("allowSuperDreamAfterNonDream", c)} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
  min = 0,
  max,
  required,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  step?: string;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
      />
      {label}
    </label>
  );
}

function CreateRuleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createRule = useCreatePolicyRule();
  const { show } = useToast();
  const [type, setType] = useState<PolicyRuleType>("ELIGIBILITY_CRITERIA");
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState<Record<string, unknown>>({});

  function reset() {
    setType("ELIGIBILITY_CRITERIA");
    setName("");
    setDefinition({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createRule.mutateAsync({ type, name, definition });
      show({ tone: "success", title: "Rule created", description: `${name} (v1, draft)` });
      reset();
      onClose();
    } catch {
      show({ tone: "danger", title: "Couldn't create rule", description: "Check the definition fields and try again." });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New policy rule" description="New rules start as v1 in DRAFT — activate them once ready.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="rule-type">Type</Label>
          <Select
            id="rule-type"
            value={type}
            onChange={(e) => {
              setType(e.target.value as PolicyRuleType);
              setDefinition({});
            }}
          >
            {RULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RULE_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="rule-name">Name</Label>
          <Input
            id="rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="institution-default-eligibility-criteria"
            required
          />
        </div>
        <DefinitionFields type={type} value={definition} onChange={setDefinition} />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createRule.isPending || !name}>
            {createRule.isPending ? "Creating…" : "Create rule"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function NewVersionDialog({ rule, onClose }: { rule: PolicyRule; onClose: () => void }) {
  const createVersion = useCreatePolicyRuleVersion(rule.id);
  const { show } = useToast();
  const [definition, setDefinition] = useState<Record<string, unknown>>(rule.definition);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createVersion.mutateAsync({ definition });
      show({ tone: "success", title: "New version created", description: `${rule.name} v${rule.version + 1} (draft)` });
      onClose();
    } catch {
      show({ tone: "danger", title: "Couldn't create new version" });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`New version of ${rule.name}`}
      description={`Creates v${rule.version + 1} as DRAFT — activate it to supersede v${rule.version}.`}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <DefinitionFields type={rule.type} value={definition} onChange={setDefinition} />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createVersion.isPending}>
            {createVersion.isPending ? "Saving…" : "Save as new version"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function SimulatorTab() {
  const jds = useJobDescriptions();
  const dryRun = useDryRunEligibility();
  const [jdId, setJdId] = useState("");
  const [criteria, setCriteria] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<DryRunResult | null>(null);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    const data = await dryRun.mutateAsync({ jdId, proposedCriteria: criteria as EligibilityCriteriaDefinition });
    setResult(data);
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-sm font-medium text-neutral-900">Proposed criteria</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Simulates swapping the institution-wide default eligibility criteria — side-effect-free, nothing is saved.
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleRun}>
          <div>
            <Label htmlFor="sim-jd">Job description</Label>
            <Select id="sim-jd" value={jdId} onChange={(e) => setJdId(e.target.value)} required>
              <option value="" disabled>
                {jds.isLoading ? "Loading job descriptions…" : "Select a JD"}
              </option>
              {jds.data?.map((jd: JobDescription) => (
                <option key={jd.id} value={jd.id}>
                  {jd.title} · ₹{jd.ctcLpa} LPA
                </option>
              ))}
            </Select>
          </div>
          <DefinitionFields type="ELIGIBILITY_CRITERIA" value={criteria} onChange={setCriteria} />
          <Button type="submit" disabled={dryRun.isPending || !jdId}>
            {dryRun.isPending ? "Simulating…" : "Run simulation"}
          </Button>
        </form>
      </Card>

      {result && (
        <Card>
          <h2 className="text-sm font-medium text-neutral-900">Results</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <StatCard label="Currently eligible" value={result.current.eligibleCount} />
            <StatCard label="Proposed eligible" value={result.proposed.eligibleCount} tone="brand" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Newly eligible ({result.newlyEligible.length})
              </p>
              {result.newlyEligible.length > 0 ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                  {result.newlyEligible.map((s) => (
                    <li key={s.id} className="flex items-center gap-1.5 text-neutral-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
                      {s.displayName} <span className="text-neutral-400">· {s.departmentCode}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-400">None</p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
                Newly ineligible ({result.newlyIneligible.length})
              </p>
              {result.newlyIneligible.length > 0 ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
                  {result.newlyIneligible.map((s) => (
                    <li key={s.id} className="flex items-center gap-1.5 text-neutral-700">
                      <XCircle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                      {s.displayName} <span className="text-neutral-400">· {s.departmentCode}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-400">None</p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
