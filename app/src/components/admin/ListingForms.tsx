import { useState } from "react";
import { RETIRE_REASONS, retireConsequence } from "../../lib/admin/listings";
import { callAdmin } from "./api";
import { Sheet } from "./Sheet";

/**
 * Listing sheets (E2 retire with the reason select inside the confirm,
 * restore) — ported from v2's listing-sheets. No open forms: everything
 * lives behind its button. Native POST forms enhanced with fetch:
 * success follows the handler's redirect, failure renders the message
 * with values preserved. Only submit buttons ever busy.
 */
export function RetireForm({ listing, varietyName, onDone }: { listing: number; varietyName: string; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Retire listing
      </button>
      {open ? (
        <Sheet title="Retire this listing?" onClose={() => setOpen(false)}>
          <form
            method="post"
            action="/admin/listings/actions"
            aria-busy={busy || undefined}
            className="admin-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              setBusy(true);
              setError(null);
              void callAdmin("/admin/listings/actions", {
                action: "retire",
                listing,
                reason: String(data.get("reason") ?? ""),
                note: String(data.get("note") ?? ""),
              }).then((r) => {
                setBusy(false);
                if (r.ok) onDone({ redirect: r.redirect });
                else setError(r.message);
              });
            }}
          >
            <input type="hidden" name="action" value="retire" />
            <input type="hidden" name="listing" value={String(listing)} />
            <p className="admin-prose">{retireConsequence(varietyName)}</p>
            {error ? (
              <p role="alert" className="admin-alert">
                {error}
              </p>
            ) : null}
            <p>
              <label htmlFor="retire-reason" className="admin-label">
                Reason
              </label>
              <select id="retire-reason" name="reason" defaultValue="" required className="field">
                <option value="">Choose a reason</option>
                {RETIRE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </p>
            <p>
              <label htmlFor="retire-note" className="admin-label">
                Note (optional)
              </label>
              <input id="retire-note" name="note" type="text" maxLength={500} autoComplete="off" className="field" />
            </p>
            <div className="admin-row">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn btn-danger">
                {busy ? "Retiring…" : "Retire listing"}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

export function RestoreForm({ listing, onDone }: { listing: number; onDone: (r: { redirect: string }) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      method="post"
      action="/admin/listings/actions"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        void callAdmin("/admin/listings/actions", { action: "restore", listing }).then((r) => {
          setBusy(false);
          if (r.ok) onDone({ redirect: r.redirect });
          else setError(r.message);
        });
      }}
    >
      <input type="hidden" name="action" value="restore" />
      <input type="hidden" name="listing" value={String(listing)} />
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="btn btn-secondary">
        {busy ? "Restoring…" : "Restore listing"}
      </button>
    </form>
  );
}
