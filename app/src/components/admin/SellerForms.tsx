import { useState } from "react";
import { SELLER_FIELD_LABELS, type SellerUpdateField } from "../../lib/admin/sellers";
import { callAdmin } from "./api";
import { Sheet } from "./Sheet";

/**
 * Seller sheets (D3 edit, D4 classification, D5 note composer) — ported
 * from v2's seller-sheets. No open forms: everything lives behind its
 * button. Native POST forms enhanced with fetch: success follows the
 * handler's redirect, failure renders the message with values preserved.
 * Only submit buttons ever busy.
 */
function useSheetSubmit(onDone: (r: { redirect: string }) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (path: string, fields: Record<string, unknown>): void => {
    setBusy(true);
    setError(null);
    void callAdmin(path, fields).then((r) => {
      setBusy(false);
      if (r.ok) onDone({ redirect: r.redirect });
      else setError(r.message);
    });
  };
  return { busy, error, submit };
}

/** D5's Add note button + composer sheet (both roles). */
export function NoteComposer({ seller, onDone }: { seller: string; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  const { busy, error, submit } = useSheetSubmit(onDone);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Add note
      </button>
      {open ? (
        <Sheet title="Add a note" onClose={() => setOpen(false)}>
          <form
            method="post"
            action="/admin/sellers/actions"
            aria-busy={busy || undefined}
            className="admin-stack"
            onSubmit={(event) => {
              event.preventDefault();
              submit("/admin/sellers/actions", { action: "add_note", seller, body: String(new FormData(event.currentTarget).get("body") ?? "") });
            }}
          >
            <input type="hidden" name="action" value="add_note" />
            <input type="hidden" name="seller" value={seller} />
            {error ? (
              <p role="alert" className="admin-alert">
                {error}
              </p>
            ) : null}
            <p>
              <label htmlFor="note-body" className="admin-label">
                Note
              </label>
              <textarea id="note-body" name="body" rows={5} maxLength={2000} autoComplete="off" className="field" />
            </p>
            <div>
              <button type="submit" disabled={busy} className="btn btn-primary">
                {busy ? "Adding…" : "Add note"}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

export interface SellerEditDefaults {
  seller: string;
  name: string;
  type?: string;
  platform?: string | null;
  homepage?: string | null;
  contactEmail?: string | null;
  location?: string | null;
  region?: string | null;
  country?: string;
  shipsTo?: string;
  description?: string | null;
  orderingNotes?: string | null;
}

const EDIT_FIELDS: { key: SellerUpdateField; id: string; kind: "text" | "textarea" }[] = [
  { key: "name", id: "seller-name", kind: "text" },
  { key: "homepage", id: "seller-homepage", kind: "text" },
  { key: "contactEmail", id: "seller-contactEmail", kind: "text" },
  { key: "location", id: "seller-location", kind: "text" },
  { key: "region", id: "seller-region", kind: "text" },
  { key: "country", id: "seller-country", kind: "text" },
  { key: "shipsTo", id: "seller-shipsTo", kind: "text" },
  { key: "description", id: "seller-description", kind: "textarea" },
  { key: "orderingNotes", id: "seller-orderingNotes", kind: "textarea" },
];

/** D3 edit sheet (admin only): the full field set, posted whole (the service diffs). */
export function SellerEditForm({ defaults, onDone }: { defaults: SellerEditDefaults; onDone: (r: { redirect: string }) => void }) {
  const { busy, error, submit } = useSheetSubmit(onDone);
  return (
    <form
      method="post"
      action="/admin/sellers/actions"
      aria-busy={busy || undefined}
      className="admin-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const fields: Record<string, unknown> = { action: "edit_save", seller: defaults.seller };
        for (const { key } of EDIT_FIELDS) fields[key] = String(data.get(key) ?? "");
        fields.type = String(data.get("type") ?? "");
        fields.platform = String(data.get("platform") ?? "");
        submit("/admin/sellers/actions", fields);
      }}
    >
      <input type="hidden" name="action" value="edit_save" />
      <input type="hidden" name="seller" value={defaults.seller} />
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      {EDIT_FIELDS.map(({ key, id, kind }) => (
        <p key={key}>
          <label htmlFor={id} className="admin-label">
            {SELLER_FIELD_LABELS[key]}
          </label>
          {kind === "textarea" ? (
            <textarea id={id} name={key} defaultValue={String(defaults[key] ?? "")} autoComplete="off" className="field" />
          ) : (
            <input id={id} name={key} type="text" defaultValue={String(defaults[key] ?? "")} autoComplete="off" className="field" />
          )}
        </p>
      ))}
      <p>
        <label htmlFor="seller-type" className="admin-label">
          {SELLER_FIELD_LABELS.type}
        </label>
        <select id="seller-type" name="type" defaultValue={defaults.type ?? ""} className="field">
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
          <option value="specialty">Specialty</option>
        </select>
      </p>
      <p>
        <label htmlFor="seller-platform" className="admin-label">
          {SELLER_FIELD_LABELS.platform}
        </label>
        <select id="seller-platform" name="platform" defaultValue={defaults.platform ?? ""} className="field">
          <option value="">Not set</option>
          <option value="shopify">Shopify</option>
          <option value="woocommerce">WooCommerce</option>
          <option value="squarespace">Squarespace</option>
          <option value="other">Other</option>
        </select>
      </p>
      <div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

export function EditSellerButton({ defaults, onDone }: { defaults: SellerEditDefaults; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Edit
      </button>
      {open ? (
        <Sheet title={`Edit ${defaults.name}`} onClose={() => setOpen(false)}>
          <SellerEditForm defaults={defaults} onDone={onDone} />
        </Sheet>
      ) : null}
    </>
  );
}

/** D4 classification sheet (admin only): the Small farm call. */
export function ClassifyForm({ seller, sellerName, isSmallFarm, isCandidate, onDone }: { seller: string; sellerName: string; isSmallFarm: boolean; isCandidate: boolean; onDone: (r: { redirect: string }) => void }) {
  const { busy, error, submit } = useSheetSubmit(onDone);
  return (
    <form
      method="post"
      action="/admin/sellers/actions"
      aria-busy={busy || undefined}
      className="admin-stack"
      onSubmit={(event) => {
        event.preventDefault();
        submit("/admin/sellers/actions", { action: "classify", seller, is_small_farm: String(new FormData(event.currentTarget).get("is_small_farm") ?? "") === "true" });
      }}
    >
      <input type="hidden" name="action" value="classify" />
      <input type="hidden" name="seller" value={seller} />
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      {isCandidate ? <p className="admin-prose">Saving a classification for {sellerName} also completes their record — they become publicly listed.</p> : null}
      <div role="radiogroup" aria-label="Small farm classification" className="admin-stack">
        <label className="admin-radio-card">
          <input type="radio" name="is_small_farm" value="true" defaultChecked={isSmallFarm} />
          <span>
            <strong>Small farm</strong>
            <span className="admin-radio-words">The Small Farm badge shows on their page and listings.</span>
          </span>
        </label>
        <label className="admin-radio-card">
          <input type="radio" name="is_small_farm" value="false" defaultChecked={!isSmallFarm} />
          <span>
            <strong>Not a small farm</strong>
            <span className="admin-radio-words">No badge is shown.</span>
          </span>
        </label>
      </div>
      <div>
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : "Save classification"}
        </button>
      </div>
    </form>
  );
}

/** The §10.1 consequence lines (the dialogs render them verbatim). */
export function deactivateConsequence(listingCount: number): string {
  return `${listingsClause(listingCount)} Reactivating brings them back.`;
}

export function removeSellerConsequence(listingCount: number): string {
  return `${listingsClause(listingCount)} This can be undone by Hue from the record, not from this screen.`;
}

function listingsClause(n: number): string {
  return n === 1 ? "Their page and 1 listing will come off the public site." : n === 0 ? "Their page will come off the public site." : `Their page and ${n} listings will come off the public site.`;
}

function DangerConfirm({ label, title, consequence, verb, action, seller, onDone }: { label: string; title: string; consequence: string; verb: string; action: string; seller: string; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  const { busy, error, submit } = useSheetSubmit(onDone);
  return (
    <>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <form
            method="post"
            action="/admin/sellers/actions"
            aria-busy={busy || undefined}
            className="admin-stack"
            onSubmit={(event) => {
              event.preventDefault();
              submit("/admin/sellers/actions", { action, seller });
            }}
          >
            <input type="hidden" name="action" value={action} />
            <input type="hidden" name="seller" value={seller} />
            <p className="admin-prose">{consequence}</p>
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
                {verb}
              </button>
            </div>
          </form>
        </Sheet>
      ) : null}
    </>
  );
}

/** Reactivate (Admin only): the deactivated banner's one-click restore. */
export function ReactivateForm({ seller, onDone }: { seller: string; onDone: (r: { redirect: string }) => void }) {
  const { busy, error, submit } = useSheetSubmit(onDone);
  return (
    <form
      method="post"
      action="/admin/sellers/actions"
      aria-busy={busy || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit("/admin/sellers/actions", { action: "reactivate", seller });
      }}
    >
      <input type="hidden" name="action" value="reactivate" />
      <input type="hidden" name="seller" value={seller} />
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="btn btn-secondary">
        Reactivate
      </button>
    </form>
  );
}

/** Deactivate (Admin only): the reversible hide, behind its §10.1 confirm. */
export function DeactivateButton({ seller, sellerName, listingCount, onDone }: { seller: string; sellerName: string; listingCount: number; onDone: (r: { redirect: string }) => void }) {
  return <DangerConfirm label="Deactivate seller" title={`Deactivate ${sellerName}?`} consequence={deactivateConsequence(listingCount)} verb="Deactivate seller" action="deactivate" seller={seller} onDone={onDone} />;
}

/** Remove (Admin only): behind its §10.1 confirm. */
export function RemoveSellerButton({ seller, sellerName, listingCount, onDone }: { seller: string; sellerName: string; listingCount: number; onDone: (r: { redirect: string }) => void }) {
  return <DangerConfirm label="Remove seller" title={`Remove ${sellerName}?`} consequence={removeSellerConsequence(listingCount)} verb="Remove seller" action="remove" seller={seller} onDone={onDone} />;
}

export function ClassifyButton({ seller, sellerName, isSmallFarm, isCandidate, onDone }: { seller: string; sellerName: string; isSmallFarm: boolean; isCandidate: boolean; onDone: (r: { redirect: string }) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Classify
      </button>
      {open ? (
        <Sheet title={`Classify ${sellerName}`} onClose={() => setOpen(false)}>
          <ClassifyForm seller={seller} sellerName={sellerName} isSmallFarm={isSmallFarm} isCandidate={isCandidate} onDone={onDone} />
        </Sheet>
      ) : null}
    </>
  );
}
