import { useState } from "react";
import { ROLE_CARDS, SELF_ROLE_LINE, grantAdminConsequence, grantFarmOwnerConsequence, type AccountRoleValue } from "../../lib/admin/accounts";
import { callAdmin } from "./api";
import { Sheet } from "./Sheet";

/**
 * Account sheets (G2 role radio cards, the farm-owner picker) — ported
 * from v2's account-sheets. No open forms: everything lives behind its
 * button. Granting Admin takes its §10.1 confirm inside the sheet.
 * Native POST forms enhanced with fetch: success follows the handler's
 * redirect, failure renders the message with values preserved. Only
 * submit buttons ever busy.
 */
export function RoleForm({ account, accountName, current, self, onDone }: { account: number; accountName: string; current: string; self: boolean; onDone: (r: { redirect: string }) => void }) {
  const [chosen, setChosen] = useState<AccountRoleValue | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (self) {
    return <p className="admin-prose">{SELF_ROLE_LINE}</p>;
  }

  const post = (role: string): void => {
    setBusy(true);
    setError(null);
    void callAdmin("/admin/accounts/actions", { action: "role_save", account, role }).then((r) => {
      setBusy(false);
      if (r.ok) onDone({ redirect: r.redirect });
      else setError(r.message);
    });
  };

  if (confirming && chosen) {
    return (
      <form
        method="post"
        action="/admin/accounts/actions"
        aria-busy={busy || undefined}
        className="admin-stack"
        onSubmit={(event) => {
          event.preventDefault();
          post(chosen);
        }}
      >
        <input type="hidden" name="action" value="role_save" />
        <input type="hidden" name="account" value={String(account)} />
        <input type="hidden" name="role" value={chosen} />
        <p className="admin-prose">{grantAdminConsequence(accountName)}</p>
        {error ? (
          <p role="alert" className="admin-alert">
            {error}
          </p>
        ) : null}
        <div className="admin-row">
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
            Back
          </button>
          <button type="submit" disabled={busy} className="btn btn-danger">
            Confirm: grant admin
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      method="post"
      action="/admin/accounts/actions"
      aria-busy={busy || undefined}
      className="admin-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const role = String(new FormData(event.currentTarget).get("role") ?? "");
        if (role !== "admin" && role !== "reviewer" && role !== "visitor") {
          setError("Choose Admin, Reviewer, or Visitor.");
          return;
        }
        // Granting Admin takes the §10.1 confirm; other saves post at once.
        if (role === "admin" && current !== "admin") {
          setChosen("admin");
          setConfirming(true);
          return;
        }
        post(role);
      }}
    >
      <input type="hidden" name="action" value="role_save" />
      <input type="hidden" name="account" value={String(account)} />
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      <div role="radiogroup" aria-label="Account role" className="admin-stack">
        {ROLE_CARDS.map((card) => (
          <label key={card.value} className="admin-radio-card">
            <input type="radio" name="role" value={card.value} defaultChecked={card.value === current} />
            <span>
              <strong>{card.title}</strong>
              <span className="admin-radio-words">{card.words}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : "Save role"}
        </button>
      </div>
    </form>
  );
}

export function RoleButton({ account, accountName, current, self, onDone }: { account: number; accountName: string; current: string; self: boolean; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  if (self) return <p className="admin-prose">{SELF_ROLE_LINE}</p>;
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Change role
      </button>
      {open ? (
        <Sheet title={`Change ${accountName}’s role`} onClose={() => setOpen(false)}>
          <RoleForm account={account} accountName={accountName} current={current} self={false} onDone={onDone} />
        </Sheet>
      ) : null}
    </>
  );
}

export function FarmOwnerForm({ account, accountName, options, onDone }: { account: number; accountName: string; options: { slug: string; name: string; location: string | null }[]; onDone: (r: { redirect: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const pickedName = options.find((o) => o.slug === picked)?.name ?? null;
  return (
    <form
      method="post"
      action="/admin/accounts/actions"
      aria-busy={busy || undefined}
      className="admin-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const seller = String(new FormData(event.currentTarget).get("seller") ?? "");
        if (!seller) {
          setError("Choose a seller.");
          return;
        }
        setBusy(true);
        setError(null);
        void callAdmin("/admin/accounts/actions", { action: "farm_grant", account, seller }).then((r) => {
          setBusy(false);
          if (r.ok) onDone({ redirect: r.redirect });
          else setError(r.message);
        });
      }}
    >
      <input type="hidden" name="action" value="farm_grant" />
      <input type="hidden" name="account" value={String(account)} />
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      {pickedName ? <p className="admin-prose">{grantFarmOwnerConsequence(accountName, pickedName)}</p> : null}
      <p>
        <label htmlFor="farm-seller" className="admin-label">
          Seller
        </label>
        <select id="farm-seller" name="seller" defaultValue="" className="field" onChange={(event) => setPicked(event.currentTarget.value)}>
          <option value="">Choose a seller</option>
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
              {o.location ? ` — ${o.location}` : ""}
            </option>
          ))}
        </select>
      </p>
      <div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : "Set as farm owner"}
        </button>
      </div>
    </form>
  );
}
