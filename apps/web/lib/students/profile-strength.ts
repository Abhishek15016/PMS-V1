import type { Student } from "@pms/types";

export function cgpaNumber(s: Pick<Student, "cgpa">): number {
  const n = Number(s.cgpa);
  return Number.isFinite(n) ? n : 0;
}

/** 0–100 heuristic from academics the registrar already tracks — CGPA carries most weight; backlogs and gap years pull it down. */
export function profileStrength(
  s: Pick<Student, "cgpa" | "resumeUrl" | "activeBacklogs" | "gapYears">,
): { score: number; label: string } {
  const cgpa = cgpaNumber(s);
  let score = Math.min(cgpa / 10, 1) * 70;
  score += s.resumeUrl ? 10 : 0;
  score += s.activeBacklogs === 0 ? 12 : Math.max(0, 12 - s.activeBacklogs * 6);
  score += s.gapYears === 0 ? 8 : 2;
  const rounded = Math.round(score);
  return {
    score: rounded,
    label: rounded >= 80 ? "Strong" : rounded >= 60 ? "Solid" : rounded >= 45 ? "Developing" : "Needs attention",
  };
}
