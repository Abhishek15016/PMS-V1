import { BarChart3, ShieldCheck, Users } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Role-aware access control",
    description: "Every record is scoped to tenant, department, and role — enforced at the database layer.",
  },
  {
    icon: Users,
    title: "One pipeline, every stakeholder",
    description: "Students, faculty coordinators, recruiters, and TPOs work from the same live data.",
  },
  {
    icon: BarChart3,
    title: "Placement analytics, live",
    description: "Funnel, branch breakdown, and YoY trends recompute automatically as offers land.",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[var(--color-sidebar)] px-12 py-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" aria-hidden />
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-96 w-96 rounded-full opacity-30 blur-[100px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-violet-600 opacity-20 blur-[100px]"
          aria-hidden
        />

        <div className="relative flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-sm font-bold text-white shadow-[var(--shadow-glow-brand)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            P
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">PMS</span>
        </div>

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-300 backdrop-blur-sm">
            Enterprise placement platform
          </span>
          <h1 className="mt-5 max-w-md text-4xl font-bold leading-[1.15] tracking-tight text-white">
            Unified placement management for your institution.
          </h1>
          <div className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-3.5">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-white shadow-[var(--shadow-sm)]"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="mt-0.5 text-sm text-[var(--color-sidebar-foreground-muted)]">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-[var(--color-sidebar-foreground-muted)]">
          © {new Date().getFullYear()} PMS. Internal use only.
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-neutral-50 px-4 py-12">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-[0.07] blur-[100px]"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div className="relative w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
