"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget (managed mode), rendered explicitly so several forms can share a
 * page. The token is written into a hidden `cf-turnstile-response` field and reported through
 * onToken; change `resetKey` after a submission to get a fresh token (tokens are single-use).
 * Accessibility: the widget is Cloudflare's keyboard/screen-reader operable challenge; the
 * surrounding form keeps its own labels, and a plain-text note explains what to do if it fails
 * to load (ad-blockers). No site key configured → the note says so (server-side the forms then
 * fail closed outside `next dev`).
 */
type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loader: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  loader ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loader = null;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export function Turnstile(props: { siteKey: string | null; onToken: (token: string | null) => void; resetKey?: number; action?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);
  const { siteKey, onToken, action } = props;
  const report = useRef(onToken);
  useEffect(() => {
    report.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile || widget.current) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          ...(action ? { action } : {}),
          callback: (t: string) => {
            setToken(t);
            report.current(t);
          },
          "expired-callback": () => {
            setToken("");
            report.current(null);
          },
          "error-callback": () => {
            setFailed(true);
            setToken("");
            report.current(null);
          },
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, action]);

  useEffect(() => {
    if (props.resetKey === undefined || !widget.current || !window.turnstile) return;
    window.turnstile.reset(widget.current);
    setToken("");
    report.current(null);
  }, [props.resetKey]);

  return (
    <div className="flex flex-col gap-1">
      {siteKey ? <div ref={ref} className="min-h-[65px]" /> : null}
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <p className="text-sm text-muted">
        {!siteKey
          ? "The human check isn’t set up on this server yet, so this form can’t be sent right now."
          : failed
            ? "The human check didn’t load. Some ad-blockers stop it — allow challenges.cloudflare.com and reload the page, or use the contact link in the footer."
            : "A quick check from Cloudflare confirms you’re a person. If it doesn’t appear, allow challenges.cloudflare.com and reload."}
      </p>
    </div>
  );
}
