import type { ResumeContent, Student } from "@pms/types";

/**
 * Deterministic, transparent ATS-readiness scorer — every check is a rule a
 * human can verify, deliberately not a black box. Mirrors what real
 * applicant-tracking parsers reward: complete contact info, scannable
 * sections, quantified impact bullets, action-verb phrasing, one-page
 * length, and keyword overlap with the target job description.
 */

export interface AtsCheck {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  advice: string;
}

export interface AtsResult {
  score: number; // 0–100
  checks: AtsCheck[];
}

const ACTION_VERBS = [
  "built", "led", "designed", "developed", "implemented", "created", "improved",
  "reduced", "increased", "optimized", "automated", "launched", "shipped",
  "migrated", "architected", "deployed", "won", "achieved", "delivered",
  "engineered", "integrated", "scaled", "refactored", "mentored", "published",
];

function allBullets(content: ResumeContent): string[] {
  return [
    ...content.experience.flatMap((e) => e.bullets),
    ...content.projects.flatMap((p) => p.bullets),
  ].filter((b) => b.trim().length > 0);
}

function wordCount(content: ResumeContent): number {
  const text = [
    content.headline,
    content.summary,
    ...content.skills,
    ...allBullets(content),
    ...content.achievements,
    ...content.certifications,
    ...content.experience.map((e) => `${e.organization} ${e.role}`),
    ...content.projects.map((p) => p.name),
  ].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

/** Tokenizes a JD title/location/programs into keywords worth matching. */
export function jdKeywords(jd: {
  title: string;
  location?: string | null;
  eligiblePrograms?: string[];
}): string[] {
  const stop = new Set(["and", "the", "for", "with", "of", "a", "an", "in", "to", "i", "ii", "iii", "1", "2"]);
  return [
    ...jd.title.toLowerCase().split(/[^a-z0-9+#.]+/),
    ...(jd.location ? jd.location.toLowerCase().split(/[^a-z0-9]+/) : []),
    ...(jd.eligiblePrograms ?? []).map((p) => p.toLowerCase()),
  ].filter((w) => w.length > 1 && !stop.has(w));
}

export function scoreResume(
  content: ResumeContent,
  student: Pick<Student, "linkedinUrl" | "githubUrl" | "leetcodeUrl" | "codeforcesUrl" | "cgpa"> | undefined,
  targetKeywords: string[] | null,
): AtsResult {
  const bullets = allBullets(content);
  const words = wordCount(content);
  const linkCount = student
    ? [student.linkedinUrl, student.githubUrl, student.leetcodeUrl, student.codeforcesUrl].filter(Boolean).length
    : 0;

  const quantified = bullets.filter((b) => /\d/.test(b)).length;
  const verbLed = bullets.filter((b) => {
    const first = b.trim().toLowerCase().split(/\s+/)[0] ?? "";
    return ACTION_VERBS.includes(first);
  }).length;

  const fullText = [content.summary, ...content.skills, ...bullets, content.headline]
    .join(" ")
    .toLowerCase();
  const matched = targetKeywords
    ? [...new Set(targetKeywords)].filter((k) => fullText.includes(k))
    : [];
  const keywordRatio = targetKeywords && targetKeywords.length > 0
    ? matched.length / new Set(targetKeywords).size
    : null;

  const checks: AtsCheck[] = [
    {
      id: "links",
      label: "Coding & professional profiles linked",
      weight: 10,
      passed: linkCount >= 2,
      advice:
        linkCount >= 2
          ? `${linkCount} profile links on record`
          : "Add at least two of LinkedIn / GitHub / LeetCode / Codeforces — recruiters check them first.",
    },
    {
      id: "headline",
      label: "Headline present",
      weight: 5,
      passed: content.headline.trim().length >= 10,
      advice: "One line stating what you are: 'Final-year CSE — backend & systems'.",
    },
    {
      id: "summary",
      label: "Summary is tight (40–400 chars)",
      weight: 10,
      passed: content.summary.trim().length >= 40 && content.summary.trim().length <= 400,
      advice: "Two to three sentences: strongest skill, proof of it, what you're looking for.",
    },
    {
      id: "skills",
      label: "At least 6 skills listed",
      weight: 10,
      passed: content.skills.filter((s) => s.trim()).length >= 6,
      advice: "ATS parsers match skills verbatim — list languages, frameworks, and tools separately.",
    },
    {
      id: "substance",
      label: "≥ 2 experience/project entries with ≥ 2 bullets each",
      weight: 15,
      passed:
        [...content.experience, ...content.projects].filter((e) => e.bullets.filter((b) => b.trim()).length >= 2)
          .length >= 2,
      advice: "Depth beats breadth: two well-evidenced entries outrank six one-liners.",
    },
    {
      id: "quantified",
      label: "≥ 40% of bullets carry a number",
      weight: 15,
      passed: bullets.length > 0 && quantified / bullets.length >= 0.4,
      advice: "\"Cut API latency 300ms→80ms\" beats \"improved performance\" — quantify impact.",
    },
    {
      id: "verbs",
      label: "≥ 50% of bullets start with an action verb",
      weight: 10,
      passed: bullets.length > 0 && verbLed / bullets.length >= 0.5,
      advice: "Start bullets with Built / Led / Reduced / Shipped — not \"was responsible for\".",
    },
    {
      id: "length",
      label: "One-page length (120–650 words)",
      weight: 10,
      passed: words >= 120 && words <= 650,
      advice:
        words < 120
          ? `Only ~${words} words — too thin for a parser to rank.`
          : words > 650
            ? `~${words} words — campus resumes should fit one page.`
            : "Right length for one page.",
    },
    {
      id: "keywords",
      label: targetKeywords ? "Keywords match the target drive" : "Target drive selected for keyword match",
      weight: 15,
      passed: keywordRatio != null && keywordRatio >= 0.4,
      advice:
        keywordRatio == null
          ? "Pick a target drive to check your resume against its actual JD wording."
          : `Matched ${matched.length}/${new Set(targetKeywords!).size} JD keywords${matched.length ? ` (${matched.slice(0, 5).join(", ")})` : ""} — mirror the JD's own vocabulary where honest.`,
    },
  ];

  const earned = checks.reduce((a, c) => a + (c.passed ? c.weight : 0), 0);
  const possible = checks.reduce((a, c) => a + c.weight, 0);
  return { score: Math.round((earned / possible) * 100), checks };
}
