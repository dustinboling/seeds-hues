import { useState } from "react";
import { ADD_ALIAS_CONSEQUENCE, varietyRemoveBlockLine, varietyRemoveConsequence } from "../../lib/admin/varieties";
import { callAdmin } from "./api";
import { Sheet } from "./Sheet";

/**
 * Variety sheets (F2 alias add, the remove danger zone) — ported from
 * v2's variety-sheets. No open forms: everything lives behind its
 * button. Native POST forms enhanced with fetch: success follows the
 * handler's redirect, failure renders the message with values preserved.
 * Only submit buttons ever busy.
 */
export function AliasAddForm({ variety, onDone }: { variety: string; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Add another name
      </button>
      {open ? (
        <Sheet title="Add another name" onClose={() => setOpen(false)}>
          <form
            method="post"
            action="/admin/varieties/actions"
            aria-busy={busy || undefined}
            className="admin-stack"
            onSubmit={(event) => {
              event.preventDefault();
              const name = String(new FormData(event.currentTarget).get("name") ?? "");
              setBusy(true);
              setError(null);
              void callAdmin("/admin/varieties/actions", { action: "alias_add", variety, name }).then((r) => {
                setBusy(false);
                if (r.ok) onDone({ redirect: r.redirect });
                else setError(r.message);
              });
            }}
          >
            <input type="hidden" name="action" value="alias_add" />
            <input type="hidden" name="variety" value={variety} />
            <p className="admin-prose">{ADD_ALIAS_CONSEQUENCE}</p>
            {error ? (
              <p role="alert" className="admin-alert">
                {error}
              </p>
            ) : null}
            <p>
              <label htmlFor="alias-name" className="admin-label">
                Another name
              </label>
              <input id="alias-name" name="name" type="text" maxLength={200} autoComplete="off" className="field" />
            </p>
            <div>
              <button type="submit" disabled={busy} className="btn btn-primary">
                {busy ? "Adding…" : "Add name"}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

/**
 * The F2 remove danger zone (admin only): blocked in words naming the
 * live-listing count while any live listing exists (no submit at all);
 * at zero the §10.1 confirm names the full consequence.
 */
export function VarietyRemoveForm({ variety, varietyName, liveListings, onDone }: { variety: string; varietyName: string; liveListings: number; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (liveListings > 0) {
    return <p className="admin-prose">{varietyRemoveBlockLine(liveListings)}</p>;
  }
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Remove variety
      </button>
      {open ? (
        <Sheet title={`Remove ${varietyName}?`} onClose={() => setOpen(false)}>
          <form
            method="post"
            action="/admin/varieties/actions"
            aria-busy={busy || undefined}
            className="admin-stack"
            onSubmit={(event) => {
              event.preventDefault();
              setBusy(true);
              setError(null);
              void callAdmin("/admin/varieties/actions", { action: "variety_remove", variety }).then((r) => {
                setBusy(false);
                if (r.ok) onDone({ redirect: r.redirect });
                else setError(r.message);
              });
            }}
          >
            <input type="hidden" name="action" value="variety_remove" />
            <input type="hidden" name="variety" value={variety} />
            <p className="admin-prose">{varietyRemoveConsequence(varietyName)}</p>
            {error ? (
              <p role="alert" className="admin-alert">
                {error}
              </p>
            ) : null}
            <div className="admin-row">
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn btn-danger">
                Confirm: remove the variety
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}
