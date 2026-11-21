/**
 * Admin home — the dashboard (spec §7B): what needs a decision (queue cards with real
 * counts + oldest age from the existing queues, and the designed all-clear zero state),
 * the wired stats snapshot band (the four site cards over the fixed 7-day window —
 * Visitors in its not-connected state, the other three live), most-wanted varieties,
 * and recent decisions from the audit trail. Identical content for both roles.
 */
import { requireAdmin } from "@/lib/admin-current-user";
import { getServices } from "@/lib/services/context";
import { formatAdminDate, oldestLine, timeAgo } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { QueueCard } from "@/components/admin/QueueCard";
import { RoleChip } from "@/components/admin/RoleChip";
import { StatsSnapshot } from "@/components/admin/StatsSnapshot";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const viewer = await requireAdmin("/admin");
  const services = await getServices();
  const [{ cards, totalWaiting }, decisions, demand, snapshot] = await Promise.all([
    services.adminAuth.queueCards(),
    services.adminAuth.recentDecisions(6),
    services.farms.demandView(5),
    services.adminStatistics.snapshot().catch(() => null),
  ]);
  const wanted = demand.varieties.slice(0, 5);

  return (
    <AdminShell viewer={viewer} section="home" reviewTotal={totalWaiting}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h1 className="text-[28px] font-semibold leading-[1.15]">Admin home</h1>
        <p className="flex items-center gap-2 font-sans text-sm text-muted">
          <RoleChip role={viewer.role} />
          <span>{formatAdminDate(new Date().toISOString(), "")}</span>
        </p>
      </header>

      <section aria-labelledby="admin-needs-decision" className="mt-6">
        <h2 id="admin-needs-decision" className="text-xl font-semibold">
          Needs a decision
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 min-[744px]:grid-cols-2 min-[1181px]:grid-cols-4">
          {cards.map((c) => (
            <QueueCard key={c.key} name={c.name} description={c.description} count={c.count} oldest={oldestLine(c.oldest)} href={c.href} />
          ))}
        </div>
        {totalWaiting === 0 ? <p className="mt-3 font-serif text-[17px] leading-[1.6]">Nothing waiting. The directory is up to date.</p> : null}
      </section>

      <section aria-labelledby="admin-site-doing" className="mt-6">
        <h2 id="admin-site-doing" className="text-xl font-semibold">
          How the site is doing
        </h2>
        <div className="mt-3">
          <StatsSnapshot snapshot={snapshot} />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <section aria-labelledby="admin-most-wanted" className="card flex flex-col gap-2 p-4 min-[744px]:p-5">
          <h2 id="admin-most-wanted" className="font-sans text-base font-semibold">
            Most wanted
          </h2>
          {wanted.length === 0 ? (
            <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">No one is waiting on a variety yet.</p>
          ) : (
            <ol className="flex flex-col">
              {wanted.map((v, i) => (
                <li key={v.slug} className="flex items-baseline justify-between gap-3 border-b border-line py-2 font-sans last:border-b-0">
                  <span>
                    <span className="mr-2 tabular-nums text-muted">{i + 1}</span>
                    {v.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    {v.waiters} waiting
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="admin-recent-decisions" className="card flex flex-col gap-2 p-4 min-[744px]:p-5">
          <h2 id="admin-recent-decisions" className="font-sans text-base font-semibold">
            Recent decisions
          </h2>
          {decisions.length === 0 ? (
            <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">Decisions your team makes will appear here.</p>
          ) : (
            <ol className="flex flex-col">
              {decisions.map((d, i) => (
                <li key={`${d.at}-${i}`} className="border-b border-line py-2 font-sans last:border-b-0">
                  {d.text} <span className="text-sm text-muted">· {timeAgo(d.at)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
