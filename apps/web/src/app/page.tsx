import { AuthGateway } from "@/components/auth-gateway";
import { ThemeToggle } from "@/components/theme-toggle";

const developmentAccounts = [
  {
    label: "Northlight Admin",
    email: "rhea@northlight.edu",
    note: "Starts with an empty community and can create invites, groups, and moderation actions.",
  },
  {
    label: "Northlight Teacher",
    email: "anika@northlight.edu",
    note: "Standard teacher account in an empty organization space.",
  },
  {
    label: "Horizon Teacher",
    email: "aarav@horizon.edu",
    note: "Use this from a second browser to test public-group joins later.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-10 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-8 lg:px-8">
      <section className="panel relative overflow-hidden rounded-[2rem] border border-[var(--line)] px-6 py-8 sm:px-8 sm:py-10 lg:min-h-[calc(100vh-3rem)]">
        <div className="absolute right-6 top-6">
          <ThemeToggle />
        </div>
        <div className="absolute left-6 top-6 rounded-full border border-[var(--line)] bg-[var(--panel-muted)] px-4 py-2 text-xs font-semibold tracking-[0.28em] text-[var(--ink-soft)] uppercase">
          Teacher Community MVP
        </div>

        <div className="mt-16 flex h-full flex-col justify-between gap-10">
          <div className="max-w-3xl">
            <p className="section-label">Internal faculty communication, minus the noise</p>
            <h1 className="display-font mt-4 max-w-4xl text-5xl leading-[0.94] font-bold tracking-tight text-[var(--ink)] sm:text-6xl lg:text-7xl">
              Build a staffroom that feels alive, organized, and safe to think in.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--ink-soft)] sm:text-xl">
              Community AI gives teachers a private campus feed, subject circles,
              cross-school public groups, threaded discussion, moderation, and
              invite-only access from the very first release.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Organization Feed", "Keep local campus discussion focused and searchable."],
              ["Open To All Toggle", "Turn one group public across institutions with a single switch."],
              ["Moderation Trail", "Reports, actions, and audit context stay visible to staff admins."],
            ].map(([title, copy]) => (
              <article
                key={title}
                className="card-lift rounded-[1.75rem] border border-[var(--line)] bg-[var(--panel-muted)] p-5"
              >
                <p className="section-label">{title}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{copy}</p>
              </article>
            ))}
          </div>

          <div className="rounded-[1.8rem] border border-[var(--line)] bg-[linear-gradient(135deg,var(--accent-soft),var(--success-soft))] p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--ink-soft)]">
              <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 font-medium">Invite + email OTP</span>
              <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 font-medium">Multi-tenant</span>
              <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 font-medium">Responsive web</span>
              <span className="rounded-full bg-[var(--panel-strong)] px-3 py-1 font-medium">Public groups behind a toggle</span>
            </div>
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <AuthGateway />

        <section className="panel rounded-[1.75rem] p-5 sm:p-6">
          <p className="section-label">Development sign-in accounts</p>
          <div className="mt-4 space-y-3">
            {developmentAccounts.map((account) => (
              <article
                key={account.email}
                className="rounded-[1.3rem] border border-[var(--line)] bg-[var(--panel-muted)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="display-font text-lg font-semibold">{account.label}</h2>
                  <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-[var(--success)]">
                    OTP in dev response
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-[var(--ink)]">{account.email}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{account.note}</p>
              </article>
            ))}
          </div>
        </section>
      </aside>
    </main>
  );
}
