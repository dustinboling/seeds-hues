import { navFor } from "../../lib/admin/auth";
import { RoleChip } from "./Banner";

/**
 * Phone-only More destination (spec §6) — ported from v2's more page:
 * Listings, Varieties, Accounts (admin only), identity, and sign-out.
 */
export function MoreView({ viewer }: { viewer: { name: string; email: string; role: string } }) {
  const links = navFor(viewer.role).filter((i) => i.key === "listings" || i.key === "varieties" || i.key === "accounts");
  return (
    <div className="admin-stack">
      <h1 className="admin-title-lg">More</h1>
      <ul className="card admin-more-list">
        {links.map((item) => (
          <li key={item.key}>
            <a href={item.href} className="admin-more-link">
              {item.label}
            </a>
          </li>
        ))}
      </ul>
      <section aria-label="Signed in" className="card admin-panel-card">
        <p className="admin-strong">{viewer.name}</p>
        <p className="admin-muted-line">{viewer.email}</p>
        <p>
          <RoleChip role={viewer.role} />
        </p>
        <form method="post" action="/admin/sign-in/sign-out">
          <button type="submit" className="btn btn-secondary">
            Sign out of admin
          </button>
        </form>
      </section>
    </div>
  );
}
