/**
 * Wrong-role landing (spec §7 A4) — ported from v2's NoAccess. No queue
 * counts, no section names, no data of any kind — the page confirms
 * nothing about what admin contains. A bare centered card, outside the
 * shell: the shell's navigation itself would leak the section list.
 */
export function NoAccess({ variant, name, email }: { variant: "no-role" | "reviewer-accounts"; name?: string; email?: string }) {
  return (
    <div className="admin-root admin-narrow">
      <div className="card admin-flow-card">
        <p className="admin-eyebrow">Seed Directory</p>
        <div aria-hidden="true" className="divider-stem" />
        {variant === "reviewer-accounts" ? (
          <>
            <h1 className="admin-title">Account settings</h1>
            <p className="admin-prose">
              Your reviewer role doesn’t include account settings. You can work the review queues and seller notes from the sections in your menu.
            </p>
            <div>
              <a href="/admin" className="btn btn-primary">
                Back to admin home
              </a>
            </div>
          </>
        ) : (
          <>
            <h1 className="admin-title">This is the admin section</h1>
            <p className="admin-prose">
              You’re signed in as {name} ({email}), and this account doesn’t have admin access. If Dustin has given you a reviewer or admin role, check you’re
              using the email he set it up for.
            </p>
            <div className="admin-stack">
              <a href="/" className="btn btn-primary">
                Go to the Seed Directory
              </a>
              <a href="/admin/sign-in" className="btn btn-secondary">
                Sign in with a different email
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
