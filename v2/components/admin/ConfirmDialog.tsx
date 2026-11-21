"use client";

/**
 * Destructive confirm (spec §10.1): title = the action in words, body = the concrete
 * consequence, Cancel (secondary, initial focus — the safe choice) plus the verb button
 * filled with the admin danger token, always paired with its verb label.
 */
import { useId, useRef } from "react";
import { Sheet } from "./Sheet";

export function ConfirmDialog({
  title,
  consequence,
  verb,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  consequence: string;
  verb: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const consequenceId = useId();
  return (
    <Sheet title={title} onClose={onCancel} initialFocusRef={cancelRef} describedById={consequenceId}>
      <p id={consequenceId} className="font-sans text-base">
        {consequence}
      </p>
      <div className="flex flex-col gap-2 min-[744px]:flex-row">
        <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {verb}
        </button>
      </div>
    </Sheet>
  );
}
