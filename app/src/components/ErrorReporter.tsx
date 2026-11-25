import { useEffect } from "react";
import { buildErrorReport, postErrorReport } from "../../src/lib/error-report";

/**
 * Client error capture (Slice 8): window errors and unhandled rejections
 * are redacted and reported to the same-origin /api/client-errors relay
 * (which forwards to the configured sink). sendBeacon when available so
 * reports survive pagehide; fetch otherwise. Never loud, never PII —
 * buildErrorReport strips queries, tokens, prices, and contact data.
 */
export function ErrorReporter() {
  useEffect(() => {
    const send = (name: string, message: string, stack: string | undefined): void => {
      try {
        const report = buildErrorReport(
          { name, message, stack },
          { url: `${window.location.pathname}${window.location.search}`, userAgent: navigator.userAgent },
        );
        const body = JSON.stringify(report);
        if ("sendBeacon" in navigator && typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon("/api/client-errors", new Blob([body], { type: "application/json" }));
        } else {
          void postErrorReport("/api/client-errors", report);
        }
      } catch {
        // Monitoring must not break the page.
      }
    };
    const onError = (event: ErrorEvent): void => {
      send("ClientError", event.message, event.error instanceof Error ? event.error.stack : undefined);
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      const reason = event.reason as unknown;
      send(
        "UnhandledRejection",
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason),
        reason instanceof Error ? reason.stack : undefined,
      );
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
