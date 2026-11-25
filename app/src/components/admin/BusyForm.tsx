import { useState, type ReactNode } from "react";

/**
 * A native POST form whose submit button takes a busy label while the
 * submission is in flight — ported from v2's BusyForm. Only the submit
 * button ever disables: disabled controls are excluded from a native
 * submission's form data, so disabling the fields would submit the form
 * empty. The enhanced (fetch) forms below reuse the same rule.
 */
export function BusyForm({ action, submitLabel, busyLabel, children }: { action: string; submitLabel: string; busyLabel: string; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <form method="post" action={action} onSubmit={() => setBusy(true)} aria-busy={busy || undefined}>
      <fieldset className="admin-fieldset">
        {children}
        <div>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? busyLabel : submitLabel}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
