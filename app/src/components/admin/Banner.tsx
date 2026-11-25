/**
 * The decision/result status line (role="status") + the role chip —
 * ported from v2's StatusBanner + RoleChip.
 */
export function StatusBanner({ status }: { status: { text: string; href?: string; hrefLabel?: string } }) {
  return (
    <p role="status" className="admin-status">
      {status.text}{" "}
      {status.href ? (
        <a href={status.href} className="admin-status-link">
          {status.hrefLabel ?? "Open"}
        </a>
      ) : null}
    </p>
  );
}

export function RoleChip({ role }: { role: string }) {
  const label = role === "admin" ? "Admin" : role === "reviewer" ? "Reviewer" : "Visitor";
  return <span className="admin-role-chip">{label}</span>;
}

export function ErrorCard({ label, retryHref }: { label: string; retryHref: string }) {
  return (
    <div role="alert" className="admin-error-card">
      <p className="admin-error-title">{label} didn’t load.</p>
      <p className="admin-error-body">Check your connection and try again.</p>
      <p className="admin-error-retry">
        <a href={retryHref} className="btn btn-secondary">
          Retry
        </a>
      </p>
    </div>
  );
}
