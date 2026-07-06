"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  FileText,
  Globe,
  Link2,
  Plus,
  Printer,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
  Skeleton,
  cn,
  useToast,
} from "@pms/ui";
import type { ResumeContent, RoundType, Student } from "@pms/types";
import { ResumeContentSchema } from "@pms/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useStudents } from "@/lib/students/use-students";
import { useDrives } from "@/lib/drives/use-drives";
import { useApplications } from "@/lib/applications/use-applications";
import { useCompanies } from "@/lib/companies/use-companies";
import { useMyResume, useUpdateMyLinks, useUpdateMyResume } from "@/lib/resume/use-resume";
import { jdKeywords, scoreResume } from "@/lib/resume/ats";
import { PREP_PACKS } from "@/lib/resume/prep-resources";

const EMPTY: ResumeContent = ResumeContentSchema.parse({});

/** textarea helpers: bullets are edited one-per-line */
const toLines = (arr: string[]) => arr.join("\n");
const fromLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </Card>
  );
}

function BulletTextarea({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      id={id}
      value={toLines(value)}
      onChange={(e) => onChange(e.target.value.split("\n"))}
      onBlur={(e) => onChange(fromLines(e.target.value))}
      placeholder={placeholder ?? "One bullet per line — start with an action verb, quantify impact"}
      rows={3}
      className="w-full rounded-[var(--radius-md)] border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
    />
  );
}

export default function ResumeStudioPage() {
  const role = useAuthStore((s) => s.user?.role);
  const displayName = useAuthStore((s) => s.user?.displayName) ?? "";
  const email = useAuthStore((s) => s.user?.email) ?? "";
  const isStudent = role === "STUDENT";
  const { show } = useToast();

  const students = useStudents();
  const me: Student | undefined = students.data?.[0];
  const resume = useMyResume(isStudent);
  const saveResume = useUpdateMyResume();
  const saveLinks = useUpdateMyLinks();
  const drives = useDrives(undefined, isStudent);
  const applications = useApplications(undefined, isStudent);
  const companies = useCompanies();

  const [content, setContent] = useState<ResumeContent>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [targetDriveId, setTargetDriveId] = useState("");
  const [links, setLinks] = useState({ linkedinUrl: "", githubUrl: "", leetcodeUrl: "", codeforcesUrl: "" });

  useEffect(() => {
    if (resume.data) {
      const parsed = ResumeContentSchema.safeParse(resume.data.content);
      if (parsed.success) setContent(parsed.data);
    }
  }, [resume.data]);

  useEffect(() => {
    if (me) {
      setLinks({
        linkedinUrl: me.linkedinUrl ?? "",
        githubUrl: me.githubUrl ?? "",
        leetcodeUrl: me.leetcodeUrl ?? "",
        codeforcesUrl: me.codeforcesUrl ?? "",
      });
    }
  }, [me]);

  const patch = (p: Partial<ResumeContent>) => {
    setContent((c) => ({ ...c, ...p }));
    setDirty(true);
  };

  const targetDrive = drives.data?.find((d) => d.id === targetDriveId);
  const keywords = targetDrive ? jdKeywords(targetDrive.jobDescription) : null;
  const ats = useMemo(() => scoreResume(content, me, keywords), [content, me, keywords]);

  /** Round types the student will actually face next, from their live applications. */
  const upcomingRoundTypes = useMemo(() => {
    const active = new Set(
      (applications.data ?? [])
        .filter((a) => a.status === "APPLIED" || a.status === "SHORTLISTED" || a.status === "IN_ROUND")
        .map((a) => a.driveId),
    );
    const types = new Set<RoundType>();
    for (const d of drives.data ?? []) {
      if (!active.has(d.id)) continue;
      for (const r of d.rounds) types.add(r.type);
    }
    return types;
  }, [applications.data, drives.data]);

  if (!isStudent) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Resume Studio is a student workspace"
            description="Students build and score their resumes here; staff can read a student's resume from their profile."
          />
        </Card>
      </div>
    );
  }

  async function handleSave() {
    try {
      await saveResume.mutateAsync(ResumeContentSchema.parse(content));
      await saveLinks.mutateAsync({
        linkedinUrl: links.linkedinUrl.trim() || null,
        githubUrl: links.githubUrl.trim() || null,
        leetcodeUrl: links.leetcodeUrl.trim() || null,
        codeforcesUrl: links.codeforcesUrl.trim() || null,
      });
      setDirty(false);
      show({ tone: "success", title: "Resume saved" });
    } catch {
      show({ tone: "danger", title: "Couldn't save", description: "Check the profile links are valid URLs." });
    }
  }

  const isLoading = students.isLoading || resume.isLoading;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Resume Studio"
          description="Build once, score against real drives, export a print-perfect PDF."
          actions={
            <div className="flex items-center gap-2">
              {dirty && <Badge tone="warning">Unsaved changes</Badge>}
              <Button variant="secondary" onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print / PDF
              </Button>
              <Button onClick={handleSave} disabled={saveResume.isPending || saveLinks.isPending}>
                <Save className="h-4 w-4" />
                {saveResume.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          }
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* ── Builder ── */}
          <div className="space-y-4 print:hidden xl:col-span-2">
            {/* ATS panel */}
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900">ATS readiness</h2>
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    ats.score >= 75 ? "text-emerald-600" : ats.score >= 50 ? "text-amber-600" : "text-rose-600",
                  )}
                >
                  {ats.score}
                  <span className="text-sm font-medium text-neutral-400">/100</span>
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    ats.score >= 75 ? "bg-emerald-500" : ats.score >= 50 ? "bg-amber-500" : "bg-rose-500",
                  )}
                  style={{ width: `${ats.score}%` }}
                />
              </div>
              <div className="mt-3">
                <Label htmlFor="target-drive">Score against a drive</Label>
                <Select
                  id="target-drive"
                  className="mt-1 w-full"
                  value={targetDriveId}
                  onChange={(e) => setTargetDriveId(e.target.value)}
                >
                  <option value="">Generic (no target drive)</option>
                  {(drives.data ?? [])
                    .filter((d) => d.status === "SCHEDULED" || d.status === "ONGOING")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {companies.data?.find((c) => c.id === d.jobDescription.companyId)?.name ?? "Drive"} —{" "}
                        {d.jobDescription.title}
                      </option>
                    ))}
                </Select>
              </div>
              <ul className="mt-4 space-y-2">
                {ats.checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-2 text-xs">
                    {check.passed ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                    )}
                    <span className="min-w-0">
                      <span className={cn("font-medium", check.passed ? "text-neutral-700" : "text-neutral-900")}>
                        {check.label}
                      </span>{" "}
                      <span className="text-neutral-400">· {check.advice}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <SectionCard title="Headline & summary">
              <div>
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={content.headline}
                  onChange={(e) => patch({ headline: e.target.value })}
                  placeholder="Final-year CSE — backend & distributed systems"
                />
              </div>
              <div>
                <Label htmlFor="summary">Summary</Label>
                <textarea
                  id="summary"
                  value={content.summary}
                  onChange={(e) => patch({ summary: e.target.value })}
                  rows={3}
                  placeholder="Two–three sentences: strongest skill, proof, what you're seeking."
                  className="w-full rounded-[var(--radius-md)] border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>
            </SectionCard>

            <SectionCard title="Profile links">
              {(
                [
                  ["linkedinUrl", "LinkedIn", "https://linkedin.com/in/…"],
                  ["githubUrl", "GitHub", "https://github.com/…"],
                  ["leetcodeUrl", "LeetCode", "https://leetcode.com/u/…"],
                  ["codeforcesUrl", "Codeforces", "https://codeforces.com/profile/…"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={links[key]}
                    onChange={(e) => {
                      setLinks((l) => ({ ...l, [key]: e.target.value }));
                      setDirty(true);
                    }}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Skills">
              <BulletTextarea
                id="skills"
                value={content.skills}
                onChange={(skills) => patch({ skills })}
                placeholder={"One skill per line:\nTypeScript\nPostgreSQL\nDocker"}
              />
            </SectionCard>

            <SectionCard title="Experience / internships">
              {content.experience.map((exp, i) => (
                <div key={i} className="rounded-[var(--radius-md)] border border-neutral-100 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={exp.organization}
                      onChange={(e) => {
                        const experience = [...content.experience];
                        experience[i] = { ...exp, organization: e.target.value };
                        patch({ experience });
                      }}
                      placeholder="Organization"
                      aria-label="Organization"
                    />
                    <Input
                      value={exp.role}
                      onChange={(e) => {
                        const experience = [...content.experience];
                        experience[i] = { ...exp, role: e.target.value };
                        patch({ experience });
                      }}
                      placeholder="Role"
                      aria-label="Role"
                    />
                  </div>
                  <Input
                    className="mt-2"
                    value={exp.period}
                    onChange={(e) => {
                      const experience = [...content.experience];
                      experience[i] = { ...exp, period: e.target.value };
                      patch({ experience });
                    }}
                    placeholder="Jun 2025 – Aug 2025"
                    aria-label="Period"
                  />
                  <div className="mt-2">
                    <BulletTextarea
                      id={`exp-bullets-${i}`}
                      value={exp.bullets}
                      onChange={(bullets) => {
                        const experience = [...content.experience];
                        experience[i] = { ...exp, bullets };
                        patch({ experience });
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-xs text-rose-600"
                    onClick={() => patch({ experience: content.experience.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  patch({
                    experience: [...content.experience, { organization: "", role: "", period: "", bullets: [] }],
                  })
                }
              >
                <Plus className="h-4 w-4" /> Add experience
              </Button>
            </SectionCard>

            <SectionCard title="Projects">
              {content.projects.map((proj, i) => (
                <div key={i} className="rounded-[var(--radius-md)] border border-neutral-100 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={proj.name}
                      onChange={(e) => {
                        const projects = [...content.projects];
                        projects[i] = { ...proj, name: e.target.value };
                        patch({ projects });
                      }}
                      placeholder="Project name"
                      aria-label="Project name"
                    />
                    <Input
                      value={proj.link ?? ""}
                      onChange={(e) => {
                        const projects = [...content.projects];
                        projects[i] = { ...proj, link: e.target.value || undefined };
                        patch({ projects });
                      }}
                      placeholder="Link (optional)"
                      aria-label="Project link"
                    />
                  </div>
                  <div className="mt-2">
                    <BulletTextarea
                      id={`proj-bullets-${i}`}
                      value={proj.bullets}
                      onChange={(bullets) => {
                        const projects = [...content.projects];
                        projects[i] = { ...proj, bullets };
                        patch({ projects });
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-xs text-rose-600"
                    onClick={() => patch({ projects: content.projects.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => patch({ projects: [...content.projects, { name: "", bullets: [] }] })}
              >
                <Plus className="h-4 w-4" /> Add project
              </Button>
            </SectionCard>

            <SectionCard title="Achievements & certifications">
              <div>
                <Label htmlFor="achievements">Achievements</Label>
                <BulletTextarea
                  id="achievements"
                  value={content.achievements}
                  onChange={(achievements) => patch({ achievements })}
                  placeholder={"One per line:\nSmart India Hackathon 2025 finalist\nCodeforces Specialist (max 1450)"}
                />
              </div>
              <div>
                <Label htmlFor="certifications">Certifications</Label>
                <BulletTextarea
                  id="certifications"
                  value={content.certifications}
                  onChange={(certifications) => patch({ certifications })}
                  placeholder={"One per line:\nAWS Cloud Practitioner"}
                />
              </div>
            </SectionCard>

            {/* Interview prep */}
            <Card>
              <div className="flex items-center gap-2">
                <BookOpenCheck className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-neutral-900">Interview prep</h2>
                {upcomingRoundTypes.size > 0 && (
                  <Badge tone="brand">matched to your {upcomingRoundTypes.size} upcoming round types</Badge>
                )}
              </div>
              <div className="mt-3 space-y-4">
                {(Object.keys(PREP_PACKS) as RoundType[])
                  .sort((a, b) => Number(upcomingRoundTypes.has(b)) - Number(upcomingRoundTypes.has(a)))
                  .map((type) => {
                    const pack = PREP_PACKS[type];
                    const relevant = upcomingRoundTypes.has(type);
                    return (
                      <div key={type}>
                        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          {pack.label}
                          {relevant && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold normal-case text-amber-700">
                              In your pipeline
                            </span>
                          )}
                        </p>
                        <ul className="mt-1.5 space-y-1.5">
                          {pack.resources.map((r) => (
                            <li key={r.url} className="text-xs">
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-medium text-brand-600 hover:underline"
                              >
                                {r.title} ↗
                              </a>
                              <span className="text-neutral-400"> — {r.note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            </Card>
          </div>

          {/* ── Live preview (the only thing that prints) ── */}
          <div className="xl:col-span-3">
            <div className="rounded-[var(--radius-xl)] border border-neutral-200 bg-white p-8 shadow-[var(--shadow-md)] sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none xl:sticky xl:top-6">
              {/* Header */}
              <div className="border-b-2 border-neutral-900 pb-3 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{displayName}</h1>
                {content.headline && <p className="mt-0.5 text-sm text-neutral-600">{content.headline}</p>}
                <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
                  <span>{email}</span>
                  {me?.contactPhone && <span>{me.contactPhone}</span>}
                  {links.linkedinUrl && (
                    <span className="inline-flex items-center gap-0.5">
                      <Link2 className="h-3 w-3" />
                      {links.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                  )}
                  {links.githubUrl && (
                    <span className="inline-flex items-center gap-0.5">
                      <Link2 className="h-3 w-3" />
                      {links.githubUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                  )}
                  {(links.leetcodeUrl || links.codeforcesUrl) && (
                    <span className="inline-flex items-center gap-0.5">
                      <Globe className="h-3 w-3" />
                      {(links.leetcodeUrl || links.codeforcesUrl).replace(/^https?:\/\/(www\.)?/, "")}
                    </span>
                  )}
                </p>
              </div>

              {content.summary && (
                <ResumeSection title="Summary">
                  <p className="text-[13px] leading-relaxed text-neutral-700">{content.summary}</p>
                </ResumeSection>
              )}

              {/* Education — registrar-owned, can't be faked */}
              {me && (
                <ResumeSection title="Education">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold text-neutral-900">
                      B.Tech, {me.department.name}
                    </span>
                    <span className="text-neutral-500">Batch {me.batch.label}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-neutral-600">
                    CGPA {me.cgpa ? Number(me.cgpa).toFixed(2) : "—"}
                    {me.tenthPercent ? ` · 10th ${Number(me.tenthPercent).toFixed(1)}%` : ""}
                    {me.twelfthPercent ? ` · 12th ${Number(me.twelfthPercent).toFixed(1)}%` : ""}
                  </p>
                </ResumeSection>
              )}

              {content.skills.filter(Boolean).length > 0 && (
                <ResumeSection title="Skills">
                  <p className="text-[13px] leading-relaxed text-neutral-700">
                    {content.skills.filter(Boolean).join(" · ")}
                  </p>
                </ResumeSection>
              )}

              {content.experience.length > 0 && (
                <ResumeSection title="Experience">
                  {content.experience.map((exp, i) => (
                    <div key={i} className={i > 0 ? "mt-3" : ""}>
                      <div className="flex items-baseline justify-between text-[13px]">
                        <span className="font-semibold text-neutral-900">
                          {exp.role}
                          {exp.organization ? `, ${exp.organization}` : ""}
                        </span>
                        <span className="shrink-0 text-neutral-500">{exp.period}</span>
                      </div>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-neutral-700">
                        {exp.bullets.filter(Boolean).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </ResumeSection>
              )}

              {content.projects.length > 0 && (
                <ResumeSection title="Projects">
                  {content.projects.map((proj, i) => (
                    <div key={i} className={i > 0 ? "mt-3" : ""}>
                      <p className="text-[13px] font-semibold text-neutral-900">
                        {proj.name}
                        {proj.link && (
                          <span className="ml-2 font-normal text-neutral-500">
                            {proj.link.replace(/^https?:\/\/(www\.)?/, "")}
                          </span>
                        )}
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px] text-neutral-700">
                        {proj.bullets.filter(Boolean).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </ResumeSection>
              )}

              {content.achievements.filter(Boolean).length > 0 && (
                <ResumeSection title="Achievements">
                  <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-neutral-700">
                    {content.achievements.filter(Boolean).map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </ResumeSection>
              )}

              {content.certifications.filter(Boolean).length > 0 && (
                <ResumeSection title="Certifications">
                  <ul className="list-disc space-y-0.5 pl-4 text-[12.5px] text-neutral-700">
                    {content.certifications.filter(Boolean).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </ResumeSection>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h2 className="border-b border-neutral-300 pb-0.5 text-[11px] font-bold uppercase tracking-widest text-neutral-800">
        {title}
      </h2>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
