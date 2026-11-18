/**
 * sendEmail() — the one place mail leaves the app (USER-ACCOUNTS-DESIGN §4). Provider:
 * Cloudflare Email Service (Email Sending) through the Workers `send_email` binding
 * (decided 2026-11-16; sending domain seeds.hues.flowers). The binding is NOT configured until
 * the domain is onboarded: until then every send returns { ok: false, status:
 * "mail_not_configured" } and callers leave their work queued (no crash). A different provider
 * (Resend, Amazon SES) can be swapped in behind Mailer without touching call sites.
 *
 * Binding API (developers.cloudflare.com/email-service/api/send-emails/workers-api/):
 *   env.EMAIL.send({ to, from, subject, html, text, replyTo, headers }) → { messageId }
 *   errors are thrown with a `code` (E_SENDER_NOT_VERIFIED, E_RATE_LIMIT_EXCEEDED, …).
 */
import { CONTACT_EMAIL } from "@/lib/config";

export const MAIL_FROM = { email: "found@seeds.hues.flowers", name: "Seed Directory" } as const;

/** The subset of the Workers `send_email` binding this app uses. */
export interface SendEmailBinding {
  send(message: {
    to: string | { email: string; name?: string };
    from: string | { email: string; name?: string };
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string | { email: string; name?: string };
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }>;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; status: "mail_not_configured" | "send_failed"; code?: string; message?: string };

export interface Mailer {
  /** False until the send_email binding exists (and, for alerts, the unsubscribe signing key). */
  readonly configured: boolean;
  send(msg: OutgoingEmail): Promise<SendResult>;
}

export async function sendEmail(binding: SendEmailBinding | null | undefined, msg: OutgoingEmail): Promise<SendResult> {
  if (!binding || typeof binding.send !== "function") return { ok: false, status: "mail_not_configured" };
  try {
    const r = await binding.send({
      to: msg.to,
      from: MAIL_FROM,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(CONTACT_EMAIL ? { replyTo: CONTACT_EMAIL } : {}),
      ...(msg.headers && Object.keys(msg.headers).length ? { headers: msg.headers } : {}),
    });
    return { ok: true, messageId: r.messageId };
  } catch (err) {
    const e = err as { code?: unknown; message?: unknown };
    return { ok: false, status: "send_failed", code: typeof e.code === "string" ? e.code : "E_UNKNOWN", message: typeof e.message === "string" ? e.message.slice(0, 200) : undefined };
  }
}

export function bindingMailer(binding: SendEmailBinding | null | undefined): Mailer {
  return {
    configured: Boolean(binding && typeof binding.send === "function"),
    send: (msg) => sendEmail(binding, msg),
  };
}

export const NO_MAILER: Mailer = { configured: false, send: async () => ({ ok: false, status: "mail_not_configured" }) };

/** Minimal HTML escaping for template interpolation. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
