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
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-[var(--color-sidebar)] px-12 py-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(99,102,241,0.2), transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-brand-600 text-sm font-bold text-white">
            P
          </div>
          <span className="text-sm font-semibold text-white">PMS</span>
        </div>

        <div className="relative">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">
            Unified placement management for your institution.
          </h1>
          <div className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-white/10 text-brand-400">
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

      <div className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
