import type { ReactNode } from "react";
import { ADMIN_MORE, navFor, type AdminNavItem, type AdminSectionKey } from "../../lib/admin/auth";
import { useAdminViewport } from "./viewport";
import { RoleChip } from "./Banner";

/**
 * The admin shell (spec §4, §6) — ported from v2's AdminShell: one
 * navigation model in two shells — the left rail at ≥744px (216px iPad,
 * 232px desktop), the bottom tab bar below that. 1180px belongs to the
 * iPad band; desktop starts at 1181px. Role rendering rule (§11):
 * Act = absent — items outside the role are not rendered at all.
 * The band switch is viewport-driven (useAdminViewport) so the iPad and
 * phone layouts are structurally distinct, not CSS-only.
 */
export interface AdminShellViewer {
  name: string;
  email: string;
  role: string;
}

function RailItem({ item, active, reviewTotal }: { item: AdminNavItem; active: boolean; reviewTotal: number }) {
  const badge = item.key === "review" && reviewTotal > 0;
  return (
    <a href={item.href} aria-current={active ? "page" : undefined} aria-label={badge ? `Review, ${reviewTotal} waiting` : undefined} className={active ? "admin-rail-link admin-rail-active" : "admin-rail-link"}>
      <span>{item.label}</span>
      {badge ? (
        <span aria-hidden="true" className="admin-count-badge">
          {reviewTotal}
        </span>
      ) : null}
    </a>
  );
}

function TabItem({ item, active, reviewTotal }: { item: AdminNavItem; active: boolean; reviewTotal: number }) {
  const badge = item.key === "review" && reviewTotal > 0;
  return (
    <a href={item.href} aria-current={active ? "page" : undefined} aria-label={badge ? `Review, ${reviewTotal} waiting` : undefined} className={active ? "admin-tab admin-tab-active" : "admin-tab"}>
      <span>{item.shortLabel ?? item.label}</span>
      {badge ? (
        <span aria-hidden="true" className="admin-count-badge">
          {reviewTotal}
        </span>
      ) : null}
    </a>
  );
}

export function AdminShell({ viewer, section, reviewTotal, children }: { viewer: AdminShellViewer; section: AdminSectionKey; reviewTotal: number; children?: ReactNode }) {
  const { band } = useAdminViewport();
  const items = navFor(viewer.role);
  const phone = band === "phone";
  const tabs = [...items.filter((i) => i.key === "home" || i.key === "review" || i.key === "sellers" || i.key === "statistics"), ADMIN_MORE];
  return (
    <div className="admin-root admin-shell">
      {!phone ? (
        <nav aria-label="Admin sections" className="admin-rail">
          <p className="admin-rail-eyebrow">Seed Directory admin</p>
          <ul className="admin-rail-list">
            {items.map((item) => (
              <li key={item.key}>
                <RailItem item={item} active={item.key === section} reviewTotal={reviewTotal} />
              </li>
            ))}
          </ul>
          <div className="admin-rail-identity">
            <p className="admin-rail-name">{viewer.name}</p>
            <p className="admin-rail-email">{viewer.email}</p>
            <p className="admin-rail-role">
              <RoleChip role={viewer.role} />
            </p>
            <form method="post" action="/admin/sign-in/sign-out" className="admin-rail-signout">
              <button type="submit" className="btn btn-secondary">
                Sign out of admin
              </button>
            </form>
          </div>
        </nav>
      ) : null}
      <div className="admin-main">
        <div className="admin-content">{children}</div>
      </div>
      {phone ? (
        <nav aria-label="Admin sections" className="admin-tabs">
          <ul className="admin-tabs-list">
            {tabs.map((item) => (
              <li key={item.key}>
                <TabItem item={item} active={item.key === section} reviewTotal={reviewTotal} />
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
