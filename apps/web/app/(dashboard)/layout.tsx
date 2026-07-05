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
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] px-3 py-5">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-brand-600 text-sm font-bold text-white">
            P
          </div>
          <div>
            <p className="text-sm font-semibold text-white">PMS</p>
            <p className="text-[11px] text-[var(--color-sidebar-foreground-muted)]">
              Placement Management
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 text-sm">
          {visibleItems.map(({ label, href, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={label}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 font-medium transition-colors duration-150",
                  isActive
                    ? "bg-[var(--color-sidebar-active-bg)] text-white"
                    : "text-[var(--color-sidebar-foreground)] hover:bg-[var(--color-sidebar-hover-bg)] hover:text-white",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand-400" : "text-[var(--color-sidebar-foreground-muted)]")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--color-sidebar-border)] pt-3">
          {me.isLoading ? (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <Skeleton className="h-9 w-9 rounded-full bg-[var(--color-sidebar-hover-bg)]" />
              <Skeleton className="h-3 w-24 bg-[var(--color-sidebar-hover-bg)]" />
            </div>
          ) : (
            <DropdownMenu
              align="start"
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

      <div className="flex flex-1 flex-col">
        <main className="flex-1 bg-neutral-50 p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
