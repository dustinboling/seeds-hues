import { useState } from "react";
import { callApi } from "./api";

/**
 * Confirm step for a signed unsubscribe link, ported from
 * v2/components/account/UnsubscribeButton.tsx (POSTs, so link scanners
 * can’t unsubscribe anyone).
 */
export function UnsubscribeButton({ token, label, doneText }: { token: string; label: string; doneText: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");
  if (state === "done")
    return (
      <p role="status" className="card field-pad form-message">
        {doneText}
      </p>
    );
  return (
    <div className="form-stack-tight">
      <div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const r = await callApi(`/api/v1/unsubscribe?token=${encodeURIComponent(token)}`, {});
            if (r.ok) setState("done");
            else {
              setError(r.message);
              setState("error");
            }
          }}
        >
          {label}
        </button>
      </div>
      {state === "error" ? (
        <p role="alert" className="form-message-alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
