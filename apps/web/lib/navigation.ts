import {
  Award,
  BarChart3,
  Building2,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import type { Role } from "@pms/types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
  /** extra search terms for the command palette */
  keywords?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
    keywords: ["home", "dashboard"],
  },
  {
    label: "Students",
    href: "/students",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT"],
    keywords: ["roster", "cgpa", "batch"],
  },
  {
    label: "Companies & Drives",
    href: "/companies",
    icon: Building2,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
    keywords: ["recruiters", "jd", "job descriptions", "drives"],
  },
  {
    label: "Policy & Eligibility",
    href: "/policy",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN", "TPO"],
    keywords: ["rules", "criteria", "debar", "offer cap", "slab"],
  },
  {
    label: "Applications",
    href: "/applications",
    icon: ClipboardList,
    roles: ["TPO", "FACULTY_COORD", "STUDENT"],
    keywords: ["shortlist", "rounds"],
  },
  {
    label: "Offers",
    href: "/offers",
    icon: Award,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
    keywords: ["ctc", "ppo", "accepted"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
    keywords: ["placement percent", "funnel", "yoy", "branch"],
  },
  {
    label: "Report Studio",
    href: "/reports",
    icon: FileCheck2,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD"],
    keywords: ["nirf", "naac", "aicte", "accreditation", "export", "pdf", "print"],
  },
];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TPO: "Training & Placement Officer",
  FACULTY_COORD: "Faculty Coordinator",
  STUDENT: "Student",
  RECRUITER: "Recruiter",
};
