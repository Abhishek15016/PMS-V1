"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Award,
  BarChart3,
  Building2,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useLogout } from "@/lib/auth/use-logout";
import { Avatar, DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, Skeleton, cn } from "@pms/ui";
import type { Role } from "@pms/types";

const NAV_ITEMS: Array<{
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}> = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
  {
    label: "Students",
    href: "/students",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT"],
  },
  {
    label: "Companies & Drives",
    href: "/companies",
    icon: Building2,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
  {
    label: "Policy & Eligibility",
    href: "/policy",
    icon: ShieldCheck,
    roles: ["SUPER_ADMIN", "TPO"],
  },
  {
    label: "Applications",
    href: "/applications",
    icon: ClipboardList,
    roles: ["TPO", "FACULTY_COORD", "STUDENT"],
  },
  {
    label: "Offers",
    href: "/offers",
    icon: Award,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "TPO", "FACULTY_COORD", "STUDENT", "RECRUITER"],
  },
];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TPO: "Training & Placement Officer",
  FACULTY_COORD: "Faculty Coordinator",
  STUDENT: "Student",
  RECRUITER: "Recruiter",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const storedUser = useAuthStore((s) => s.user);
  const logout = useLogout();
  const me = useCurrentUser();

  useEffect(() => {
    if (hasHydrated && !accessToken) {
      router.replace("/login");
    }
  }, [hasHydrated, accessToken, router]);

  if (!hasHydrated || !accessToken) {
    return null;
  }

  const role = me.data?.role ?? storedUser?.role;
  const displayName = storedUser?.displayName ?? "";
  const email = storedUser?.email ?? "";
  const visibleItems = role ? NAV_ITEMS.filter((item) => item.roles.includes(role)) : NAV_ITEMS;

  return (
    <div className="flex flex-1">
      <aside className="relative flex w-64 shrink-0 flex-col overflow-hidden border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] px-3 py-5">
        <div
          className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full opacity-20 blur-[80px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-violet-600 opacity-[0.12] blur-[80px]"
          aria-hidden
        />

        <div className="relative mb-7 flex items-center gap-2.5 px-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-sm font-bold text-white shadow-[var(--shadow-glow-brand)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            P
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">PMS</p>
            <p className="text-[11px] text-[var(--color-sidebar-foreground-muted)]">
              Placement Management
            </p>
          </div>
        </div>

        <nav className="relative flex flex-1 flex-col gap-1 text-sm">
          {visibleItems.map(({ label, href, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 font-medium transition-all duration-150",
                  isActive
                    ? "bg-[var(--color-sidebar-active-bg)] text-white"
                    : "text-[var(--color-sidebar-foreground)] hover:bg-[var(--color-sidebar-hover-bg)] hover:text-white",
                )}
              >
                {isActive && (
                  <span
                    className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                    style={{ background: "var(--gradient-brand)" }}
                    aria-hidden
                  />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-400" : "text-[var(--color-sidebar-foreground-muted)] group-hover:text-brand-300")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="relative mt-auto border-t border-[var(--color-sidebar-border)] pt-3">
          {me.isLoading ? (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Skeleton className="h-9 w-9 rounded-full bg-[var(--color-sidebar-hover-bg)]" />
              <Skeleton className="h-3 w-24 bg-[var(--color-sidebar-hover-bg)]" />
            </div>
          ) : (
            <DropdownMenu
              align="start"
              side="top"
              trigger={
                <div className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-sidebar-hover-bg)]">
                  <Avatar name={displayName || email} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">
                      {displayName || email}
                    </p>
                    <p className="truncate text-[11px] text-[var(--color-sidebar-foreground-muted)]">
                      {role ? (ROLE_LABELS[role] ?? role) : ""}
                    </p>
                  </div>
                </div>
              }
            >
              <div className="px-2.5 py-2 text-xs text-neutral-500">{email}</div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenu>
          )}
        </div>
      </aside>

      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div
          className="animate-float-slow pointer-events-none fixed -right-32 -top-32 h-[32rem] w-[32rem] rounded-full opacity-[0.16] blur-[100px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div
          className="animate-float-slower pointer-events-none fixed -bottom-32 -left-16 h-[26rem] w-[26rem] rounded-full bg-violet-500 opacity-[0.14] blur-[100px]"
          aria-hidden
        />
        <div
          className="animate-float-slow pointer-events-none fixed bottom-20 right-[10%] h-72 w-72 rounded-full bg-sky-400 opacity-[0.10] blur-[100px]"
          aria-hidden
        />
        <main className="relative flex-1 overflow-y-auto bg-gradient-to-b from-neutral-50 via-neutral-50 to-neutral-50/60 p-6 sm:p-8">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
