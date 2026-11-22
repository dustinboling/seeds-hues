"use client";

/**
 * Accounts client islands (Slice C): the Change-role sheet (the spec's three verbatim
 * radio cards; Grant Admin takes its §10.1 confirm inside the sheet), the Set-as-farm-
 * owner sheet (seller picker: a search field + result list, never a typed slug, then a
 * confirm), and the revoke confirm. All state changes in event handlers only; saves
 * post via fetch and navigate to the server's redirect on success (on failure the sheet
 * stays open with values intact and the §10.2 error at its head).
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Sheet } from "@/components/admin/Sheet";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { grantAdminConsequence, grantFarmOwnerConsequence, REVOKE_FARM_OWNER_CONSEQUENCE, ROLE_CARDS, type AccountRoleValue } from "@/lib/admin/accounts";

export interface AccountCtx {
  account: string;
  q: string | null;
  show: string;
}

export interface SellerOption {
  slug: string;
  name: string;
  location: string | null;
}

interface FieldError {
  field: string;
  message: string;
}

function HiddenCtx({ ctx, action }: { ctx: AccountCtx; action: string }) {
  return (
    <>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="account" value={ctx.account} />
      {ctx.q ? <input type="hidden" name="q" value={ctx.q} /> : null}
      {ctx.show !== "50" ? <input type="hidden" name="show" value={ctx.show} /> : null}
    </>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false" className="mt-0.5 size-4 shrink-0">
      <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2c-.5 0-.9.4-.9.9v3.1c0 .5.4.9.9.9s.9-.4.9-.9V6.6c0-.5-.4-.9-.9-.9Zm0 6.1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </svg>
  );
}

async function postSheet(form: HTMLFormElement): Promise<{ ok: true; redirect: string } | { ok: false; errors: FieldError[]; message: string }> {
  let res: Response;
  try {
    res = await fetch(form.action, { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, errors: [{ field: "form", message: "That didn't go through. Check your connection and try again — nothing was changed." }], message: "connection" };
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; redirect?: unknown; errors?: unknown; message?: unknown } | null;
  if (res.ok && body?.ok === true && typeof body.redirect === "string") return { ok: true, redirect: body.redirect };
  const errors = Array.isArray(body?.errors)
    ? (body.errors as { field?: unknown; message?: unknown }[]).map((e) => ({ field: typeof e.field === "string" ? e.field : "form", message: typeof e.message === "string" ? e.message : "That didn't go through." }))
    : [];
  const message = typeof body?.message === "string" ? body.message : "That didn't go through. Nothing was changed — try again.";
  return { ok: false, errors: errors.length > 0 ? errors : [{ field: "form", message }], message };
}

// ─── Change role ──────────────────────────────────────────────────────────────

/** The Grant Admin confirm step (consequence + danger verb + safe cancel). Exported for tests. */
export function GrantAdminConfirmView({ accountName, busy, onBack }: { accountName: string; busy: boolean; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-base">{grantAdminConsequence(accountName)}</p>
      <div className="flex flex-col gap-2 admin:flex-row">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn-danger" disabled={busy}>
          {busy ? "Granting…" : "Grant admin"}
        </button>
      </div>
    </div>
  );
}

/** The role form: three verbatim radio cards; granting Admin confirms first. Exported for tests. */
export function RoleForm({ accountName, currentRole, ctx }: { accountName: string; currentRole: string; ctx: AccountCtx }) {
  const [chosen, setChosen] = useState<AccountRoleValue>(currentRole === "admin" || currentRole === "reviewer" || currentRole === "visitor" ? currentRole : "visitor");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const needsConfirm = chosen === "admin" && currentRole !== "admin";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (needsConfirm && !confirming) {
      setConfirming(true);
      return;
    }
    const form = formRef.current;
    if (!form || busy) return;
    setBusy(true);
    const r = await postSheet(form);
    if (r.ok) {
      window.location.assign(r.redirect);
      return;
    }
    setError(r.errors.find((x) => x.field === "form")?.message ?? r.errors[0]?.message ?? "That didn't go through.");
    setConfirming(false);
    setBusy(false);
  }

  return (
    <form ref={formRef} method="post" action="/admin/accounts/actions" onSubmit={onSubmit} className="flex flex-col gap-3">
      <HiddenCtx ctx={ctx} action="role_save" />
      {error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-control border border-line-strong bg-warn-50 p-4">
          <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
            <ErrorIcon />
            <span>{error}</span>
          </p>
        </div>
      ) : null}
      {confirming ? (
        <>
          <input type="hidden" name="role" value={chosen} />
          <GrantAdminConfirmView accountName={accountName} busy={busy} onBack={() => setConfirming(false)} />
        </>
      ) : (
        <>
          <fieldset className="flex flex-col gap-3" onChange={(e) => setChosen((e.target as unknown as HTMLInputElement).value as AccountRoleValue)}>
            <legend className="mb-1 font-sans text-base font-semibold">Change {accountName}&apos;s role</legend>
            {ROLE_CARDS.map((c) => (
              <label key={c.value} className="block cursor-pointer rounded-control border border-line-strong bg-surface p-4 has-[:checked]:border-leaf has-[:checked]:bg-leaf-50 has-[:focus-visible]:outline has-[:focus-visible]:outline-focus">
                <span className="flex items-start gap-3">
                  <input type="radio" name="role" value={c.value} defaultChecked={c.value === chosen} className="mt-1 size-5 shrink-0 accent-leaf" />
                  <span>
                    <span className="block font-sans text-base font-semibold">{c.title}</span>
                    <span className="mt-0.5 block font-sans text-[15px] text-ink-soft">{c.words}</span>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Save role
            </button>
          </div>
        </>
      )}
    </form>
  );
}

/** G2's Change role button + sheet (Admin only; absent on self-view). */
export function ChangeRoleButton({ accountName, currentRole, ctx }: { accountName: string; currentRole: string; ctx: AccountCtx }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Change role
      </button>
      {open ? (
        <Sheet title="Change role" onClose={() => setOpen(false)}>
          <RoleForm accountName={accountName} currentRole={currentRole} ctx={ctx} />
        </Sheet>
      ) : null}
    </>
  );
}

// ─── Set as farm owner ────────────────────────────────────────────────────────

/** The grant confirm step (consequence + verb + back). Exported for tests. */
export function GrantFarmOwnerConfirmView({ accountName, sellerName, busy, onBack }: { accountName: string; sellerName: string; busy: boolean; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-base">{grantFarmOwnerConsequence(accountName, sellerName)}</p>
      <div className="flex flex-col gap-2 admin:flex-row">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onBack}>
          Back
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Granting…" : "Set as farm owner"}
        </button>
      </div>
    </div>
  );
}

/** The grant form: seller picker (search + result list) then the confirm. Exported for tests. */
export function FarmOwnerForm({ accountName, sellers, ctx }: { accountName: string; sellers: SellerOption[]; ctx: AccountCtx }) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const q = query.trim().toLowerCase();
  const matches = q ? sellers.filter((s) => s.name.toLowerCase().includes(q)) : sellers;
  const picked = sellers.find((s) => s.slug === chosen) ?? null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    if (!form || busy) return;
    if (!picked) {
      setError("Choose a seller.");
      return;
    }
    setBusy(true);
    const r = await postSheet(form);
    if (r.ok) {
      window.location.assign(r.redirect);
      return;
    }
    setError(r.errors.find((x) => x.field === "form" || x.field === "seller")?.message ?? "That didn't go through.");
    setBusy(false);
  }

  return (
    <form ref={formRef} method="post" action="/admin/accounts/actions" onSubmit={onSubmit} className="flex flex-col gap-3">
      <HiddenCtx ctx={ctx} action="farm_grant" />
      {error ? (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-control border border-line-strong bg-warn-50 p-4">
          <p className="flex items-start gap-1.5 font-sans text-base font-semibold text-warn">
            <ErrorIcon />
            <span>{error}</span>
          </p>
        </div>
      ) : null}
      {picked ? (
        <>
          <input type="hidden" name="seller" value={picked.slug} />
          <GrantFarmOwnerConfirmView accountName={accountName} sellerName={picked.name} busy={busy} onBack={() => setChosen(null)} />
        </>
      ) : (
        <>
          <p>
            <label htmlFor="farm-seller-search" className="mb-1 block font-sans text-sm font-semibold">
              Find their farm
            </label>
            <input
              id="farm-seller-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              placeholder="Seller name"
              className="field min-h-target w-full"
            />
          </p>
          {matches.length === 0 ? (
            <p className="font-sans text-[15px] text-ink-soft">{sellers.length === 0 ? "No sellers in the directory yet." : "No sellers match."}</p>
          ) : (
            <ul className="flex max-h-[40dvh] flex-col overflow-y-auto rounded-control border border-line" role="listbox" aria-label="Sellers">
              {matches.map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    disabled={busy}
                    onClick={() => setChosen(s.slug)}
                    className="block min-h-target w-full px-3 py-2.5 text-left font-sans hover:bg-paper-deep"
                  >
                    <span className="block text-base font-semibold">{s.name}</span>
                    {s.location ? <span className="block text-sm text-ink-soft">{s.location}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </form>
  );
}

/** G2's Set as farm owner button + sheet (Admin only). */
export function SetFarmOwnerButton({ accountName, sellers, ctx }: { accountName: string; sellers: SellerOption[]; ctx: AccountCtx }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Set as farm owner
      </button>
      {open ? (
        <Sheet title="Set as farm owner" onClose={() => setOpen(false)}>
          <FarmOwnerForm accountName={accountName} sellers={sellers} ctx={ctx} />
        </Sheet>
      ) : null}
    </>
  );
}

// ─── Remove farm-owner status ────────────────────────────────────────────────

/** G2's revoke button + §10.1 confirm (Admin only; the legacy consequence wording). */
export function RevokeFarmOwnerButton({ ctx }: { ctx: AccountCtx }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <>
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setOpen(true)}>
        Remove farm-owner status
      </button>
      <form ref={formRef} method="post" action="/admin/accounts/actions" className="hidden" aria-hidden="true" tabIndex={-1}>
        <HiddenCtx ctx={ctx} action="farm_revoke" />
      </form>
      {open ? (
        <ConfirmDialog
          title="Remove farm-owner status?"
          consequence={REVOKE_FARM_OWNER_CONSEQUENCE}
          verb="Remove farm-owner status"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setBusy(true);
            formRef.current?.requestSubmit();
          }}
        />
      ) : null}
    </>
  );
}
