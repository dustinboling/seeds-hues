"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { CODE_TTL_MINUTES } from "@/lib/accounts";
import { Turnstile } from "@/components/ui/Turnstile";
import { FieldErrorLine, FieldSummary, focusFailureTarget, syncFilledClass } from "@/components/ui/field-states";
import { callApi, deliveryNote } from "@/components/account/api";
import {
  FINISH_PROFILE_SUMMARY_HEADING,
  WAITLIST_JOIN_SUMMARY_HEADING,
  profileFailure,
  waitlistJoinFailure,
  type MappedFormFailure,
} from "@/components/account/account-errors";
import { CodeEntry } from "@/components/account/CodeEntry";
import { FinishProfileFields, profileBody } from "@/components/account/FinishProfileFields";
import { SMS_CONSENT } from "@/components/account/SignupFields";
import {
  RESTING_FLOOR,
  WAITLIST_BLOCK_ID,
  type FloorChannel,
  type FloorCodeError,
  type FloorJoinError,
  type FloorState,
} from "@/lib/waitlist-floor";

type Channel = "email" | "sms";

type Status = {
  signed_in: boolean;
  variety: { slug: string; name: string; listed: boolean };
  on_list: boolean;
  user?: { name: string; email_verified: boolean; sms_opt_in: boolean; alert_phone_verified: boolean; profile_complete: boolean };
  channels?: Channel[];
  held?: string[];
  turnstile_site_key: string | null;
};

/** Alert channels in reader words: "email", "text", or "email and text" — never "sms", never "+". */
function channelsText(channels: readonly Channel[] | undefined): string {
  return (channels ?? []).map((c) => (c === "sms" ? "text" : "email")).join(" and ");
}

/** The API's held reasons run together, with the sentence's closing period added only if it is missing. */
function heldSentence(held: readonly string[]): string {
  const text = held.join(" ");
  return text.endsWith(".") ? text : `${text}.`;
}

// ─── Settled copy (SPEC §3.2.4/§3.2.5/§3.4.2, verbatim) + the build's flagged new strings ──

/** §3.2.4 — the recognized-contact transition. The email belongs to the submitter themselves. */
const recognizedCopy = (email: string) => `This email already has an account — we've sent a 6-digit code to ${email}. Enter it to join this waiting list.`;
/** §3.2.5 — the finish-your-account step. */
const FINISH_COPY = "Want to finish your account? A name and ZIP set your growing zone — you can do this any time, or not at all.";
/** §3.4.2 — the joined-and-verify floor state. */
const floorVerifyCopy = (varietyName: string) =>
  `You're on the waiting list for ${varietyName}. Alerts start once your email is confirmed — enter the 6-digit code from your email:`;

/** New strings this build adds beyond the spec's (flagged in the PR body, per the brief). */
const RECOGNIZED_HEADING = "Check your email for a code";
const FINISH_HEADING = "Finish your account";
const DIFFERENT_EMAIL = "Use a different email";
const FETCH_FAILED_NOTE = "We couldn't check your account status just now — you can still join the waiting list below.";
const PROFILE_SAVED_NOTE = "Your account details are saved.";
const FLOOR_SMS_TEXT = `We’ll text the phone number below (after a one-time code to confirm it). ${SMS_CONSENT}`;
const FLOOR_PHONE_LABEL = "Phone number (only needed for text alerts)";
const FLOOR_HELD_SENTENCE = "alerts are turned off for your account — turn them back on in your account";

const FLOOR_JOIN_FIELD_MESSAGES: Record<"email_invalid" | "phone_invalid", string> = {
  email_invalid: "Enter a valid email address.",
  phone_invalid: "Enter your phone number as a 10-digit US number.",
};

function floorJoinFormMessage(code: FloorJoinError, varietyName: string): string | null {
  if (code === "already_listed") return `Good news — ${varietyName} is already listed by a seller. Reload the page to see where to buy it.`;
  if (code === "rate_limited") return "That's a lot of requests in a short time — please wait a minute and try again.";
  if (code === "account_inactive") return "We couldn't join the waiting list with that email — please try again.";
  return null;
}

/**
 * The floor code forms reuse the CodeEntry sentences (COPY-3-3 §3.3) wherever they fit; the
 * three resend sentences are adapted because the floor has no "Send a new code" button —
 * re-submitting the join form is the floor's re-issue path, and the copy says so.
 */
const FLOOR_CODE_MESSAGES: Record<FloorCodeError, string> = {
  code_invalid: "Enter the 6-digit code.",
  code_incorrect: "That code isn't right — check it and try again.",
  code_expired: "That code has expired — join the waiting list again to get a fresh one.",
  code_dead: "Too many wrong tries — that code no longer works. Join the waiting list again to get a fresh one.",
  no_code: "There's no active code — join the waiting list again to get one.",
  no_pending_join: "There’s no waiting-list join waiting for that code — join the list first, then enter the new code.",
};

type CreateJoinData = {
  recognized?: boolean;
  email?: string;
  delivery?: string | null;
  verification?: { email: string; phone: string | null };
  waitlist?: { error?: string; message?: string } | null;
};

/**
 * The waiting-list panel under "No sellers yet" on zero-seller variety pages (design §4,
 * rebuilt by Tranche 3.2, SPEC §3). The page stays ISR-cached; this block asks
 * /api/v1/account/waitlist for the visitor's state.
 *
 * The flow is variety → contact + channel → done (§3.2):
 *  - signed out → the alert step: email + channel choice ("Email only" / "Email and text",
 *    compact radio rows in a real fieldset) + phone iff text; one submit creates the minimal
 *    account AND joins in place. An existing email is recognized inline (code state, never an
 *    error, never a link away); after joining, an optional finish-your-account step offers
 *    the deferred name/ZIP/type below the alert status.
 *  - signed in, not on the list → one-click join;
 *  - on the list → the success moment (UX spec 2026-11-19 §3): a celebration on the paper ground
 *    (heading + per-state line), then a card with the next step and the leave / alerts
 *    actions. States, in precedence order: B/C unverified email (code entry; B carries this
 *    session's delivery status), D verified but alerts held, A verified and alerts on.
 * Focus moves to the success heading (or back to the join heading after leaving, or to the
 * recognized heading after the inline transition) only after a user action in this session —
 * never on page load.
 *
 * The no-JS floor (§3.4) is this same component's pre-fetch render, server-rendered from the
 * `floor` prop: the alert-step form as a plain HTML form (its phone field visible and never
 * `required`), the verify/recognized code forms, the joined-and-active state, and the error
 * state in the enhanced form's error dialect. Hydration replaces the floor only after the
 * status fetch resolves; a failed fetch leaves the floor on screen with a brief note.
 */
export function WaitlistBlock({ varietySlug, varietyName, floor = RESTING_FLOOR }: { varietySlug: string; varietyName: string; floor?: FloorState }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [reset, setReset] = useState(0);
  /** The email code's DeliveryStatus from this session's account creation (not an address). */
  const [createdDelivery, setCreatedDelivery] = useState<string | null>(null);
  /** The alert step's channel choice. The phone field reveals for "sms" only. */
  const [channel, setChannel] = useState<FloorChannel>(floor.kind === "error" ? floor.channel : "email");
  /** The recognized contact's email + delivery note, once the join submit recognizes them. */
  const [recognized, setRecognized] = useState<{ email: string; delivery: string | null } | null>(null);
  /** Escape hatch from the recognized state back to the alert step (a mistyped email). */
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [joinFailure, setJoinFailure] = useState<MappedFormFailure>({ fields: [], form: null });
  const [finishDismissed, setFinishDismissed] = useState(false);
  const [profileFailureState, setProfileFailureState] = useState<MappedFormFailure>({ fields: [], form: null });
  /**
   * What the visitor typed into the floor form before the status fetch resolved, carried into
   * the enhanced form so the enhancement never eats it. Initialized from the server-rendered
   * error floor's preserved values when there is one. (The channel choice is the shared
   * `channel` state above — one choice across the floor/enhanced swap.)
   */
  const [floorValues, setFloorValues] = useState<{ email: string; phone: string }>(() => ({
    email: floor.kind === "error" ? floor.email : "",
    phone: floor.kind === "error" ? floor.phone : "",
  }));

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((n) => n + 1), []);

  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const joinHeadingRef = useRef<HTMLHeadingElement>(null);
  const recognizedHeadingRef = useRef<HTMLHeadingElement>(null);
  const joinSummaryRef = useRef<HTMLDivElement | null>(null);
  const profileSummaryRef = useRef<HTMLDivElement | null>(null);
  /** The floor's server-rendered summaries are never focus targets (no focus move on load). */
  const floorSummaryRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusRef = useRef<"success" | "join" | null>(null);

  useEffect(() => {
    let live = true;
    void callApi<Status>(`/api/v1/account/waitlist?variety=${encodeURIComponent(varietySlug)}`, undefined, "GET").then((r) => {
      if (!live) return;
      if (r.ok) setStatus(r.data);
      else setFetchFailed(true);
    });
    return () => {
      live = false;
    };
  }, [varietySlug, version]);

  // Focus rescue after an in-session transition: the control that held focus has unmounted.
  useEffect(() => {
    if (!status) return;
    const pending = pendingFocusRef.current;
    if (!pending) return;
    pendingFocusRef.current = null;
    if (pending === "success" && status.on_list) successHeadingRef.current?.focus();
    if (pending === "join" && status.signed_in && !status.on_list) joinHeadingRef.current?.focus();
  }, [status]);

  // The recognized-contact transition moves focus to the code state's heading — the block's
  // deliberate-focus discipline, after this session's join submit (never on page load).
  useEffect(() => {
    if (recognized) recognizedHeadingRef.current?.focus();
  }, [recognized]);

  const joinEntries = joinFailure.fields.map((f) => ({ fieldId: f.key === "phone" ? "waitlist-phone" : "waitlist-email", message: f.message }));
  const showJoinSummary = joinFailure.form !== null || joinEntries.length >= 2;
  useEffect(() => {
    if (!showJoinSummary && joinEntries.length === 0) return;
    focusFailureTarget(joinSummaryRef.current, joinEntries, joinFailure.form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries/showJoinSummary derive from joinFailure
  }, [joinFailure]);

  const profileEntries = profileFailureState.fields.map((f) => ({ fieldId: `waitlist-finish-${f.key}`, message: f.message }));
  const showProfileSummary = profileFailureState.form !== null || profileEntries.length >= 2;
  useEffect(() => {
    if (!showProfileSummary && profileEntries.length === 0) return;
    focusFailureTarget(profileSummaryRef.current, profileEntries, profileFailureState.form);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries/showProfileSummary derive from profileFailureState
  }, [profileFailureState]);

  async function join() {
    setActionBusy(true);
    setError(null);
    const r = await callApi("/api/v1/account/waitlist/join", { variety: varietySlug });
    setActionBusy(false);
    if (!r.ok) setError(r.message);
    else pendingFocusRef.current = "success";
    load();
  }

  async function leave() {
    setActionBusy(true);
    setError(null);
    const r = await callApi("/api/v1/account/waitlist/leave", { variety: varietySlug });
    setActionBusy(false);
    if (!r.ok) setError(r.message);
    else {
      setNote(`You’ve left the waiting list for ${varietyName}.`);
      pendingFocusRef.current = "join";
    }
    load();
  }

  /**
   * The alert step's submit: one request creates the minimal account (contact + channel alone)
   * and joins in place. An existing email is never an error — the block transitions in place
   * to the recognized-contact code state.
   */
  async function createAndJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setJoinBusy(true);
    setJoinFailure({ fields: [], form: null });
    setError(null);
    const r = await callApi<CreateJoinData>("/api/v1/account", {
      email: String(form.get("email") ?? "").trim(),
      sms_opt_in: channel === "sms",
      ...(channel === "sms" ? { phone: String(form.get("phone") ?? "") } : {}),
      join_variety: varietySlug,
      ...(token ? { turnstile_token: token } : {}),
    });
    setJoinBusy(false);
    if (!r.ok) {
      setJoinFailure(waitlistJoinFailure(r.status, r.code, r.message));
      setReset((n) => n + 1);
      return;
    }
    if (r.data.recognized) {
      setRecognized({ email: r.data.email ?? "", delivery: r.data.delivery ?? null });
      return;
    }
    if (r.data.waitlist?.error) setError(r.data.waitlist.message ?? "We couldn’t add you to this list.");
    setCreatedDelivery(r.data.verification?.email ?? null);
    pendingFocusRef.current = "success";
    load();
  }

  /** The finish-your-account step's save: the deferred profile, together or piecemeal. */
  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileBusy(true);
    setProfileFailureState({ fields: [], form: null });
    const r = await callApi("/api/v1/account/profile", profileBody(new FormData(e.currentTarget)));
    setProfileBusy(false);
    if (!r.ok) {
      setProfileFailureState(profileFailure(r.status, r.code, r.message));
      return;
    }
    setNote(PROFILE_SAVED_NOTE);
    load();
  }

  function handleVerified() {
    setRecognized(null);
    setShowAlertForm(false);
    pendingFocusRef.current = "success";
    load();
  }

  /** Carry the floor form's typed values into the shared state the enhanced form reads. */
  function syncFloorValues(e: FormEvent<HTMLFormElement>) {
    const form = new FormData(e.currentTarget);
    setFloorValues({ email: String(form.get("email") ?? ""), phone: String(form.get("phone") ?? "") });
    const c = form.get("channel");
    if (c === "email" || c === "sms") setChannel(c);
  }

  if (status?.variety.listed) return null;

  const noteBlock = note ? (
    <p role="status" className="font-medium">
      {note}
    </p>
  ) : null;
  const errorBlock = error ? (
    <p role="alert" className="font-medium text-warn">
      {error}
    </p>
  ) : null;

  const joinEmailError = joinFailure.fields.find((f) => f.key === "email")?.message ?? null;
  const joinPhoneError = joinFailure.fields.find((f) => f.key === "phone")?.message ?? null;
  const profileErrors = Object.fromEntries(profileFailureState.fields.map((f) => [f.key, f.message]));

  const showFinish = Boolean(status && status.signed_in && status.on_list && status.user?.profile_complete === false && !finishDismissed);
  const finishStep = showFinish ? (
    <div className="mt-1 border-t border-line pt-3">
      <h5 className="text-base font-semibold">{FINISH_HEADING}</h5>
      <p className="mt-1 text-sm">{FINISH_COPY}</p>
      <form onSubmit={saveProfile} aria-busy={profileBusy || undefined} className="mt-3 flex flex-col gap-4" aria-label={`${FINISH_HEADING} for ${varietyName}`}>
        {showProfileSummary ? <FieldSummary heading={profileFailureState.form ?? FINISH_PROFILE_SUMMARY_HEADING} entries={profileEntries} summaryRef={profileSummaryRef} /> : null}
        <FinishProfileFields idPrefix="waitlist-finish" errors={profileErrors} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-primary" disabled={profileBusy}>
            {profileBusy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setFinishDismissed(true)}>
            Not now
          </button>
        </div>
      </form>
    </div>
  ) : null;

  if (status && status.signed_in && status.on_list) {
    const unverified = status.user?.email_verified === false;
    const held = status.held ?? [];
    const channels = channelsText(status.channels);

    let celebration: ReactNode;
    let nextTitle: string;
    let nextBody: ReactNode = null;

    if (unverified) {
      // States B (createdDelivery set this session) and C (returning, nothing sent this session).
      celebration = (
        <p className="mt-3 max-w-xl">
          Your place is saved now, and once your email is confirmed we’ll send one alert when a seller first lists {varietyName} — until
          then, alerts are held.
        </p>
      );
      nextTitle = "One last step so your alerts can reach you";
      nextBody = (
        <>
          {createdDelivery === "sent" ? (
            <p className="text-sm">
              Enter the 6-digit code from that email in the box below — that’s how we know this address is yours, and your alerts can
              reach you.
            </p>
          ) : createdDelivery === "mail_not_configured" ? (
            <p className="text-sm">
              We can’t email your code just yet, so there’s nothing to check in your inbox. Your place on the list is safe — ask for a new
              code from this page or your account later, once email sending is switched on.
            </p>
          ) : null}
          <CodeEntry
            channel="email"
            idPrefix="waitlist-email"
            initialNote={createdDelivery !== null ? deliveryNote(createdDelivery, "email") : null}
            onVerified={handleVerified}
          />
        </>
      );
    } else if (held.length > 0) {
      // State D: verified, alerts held for another reason — the API's strings, verbatim.
      celebration = <p className="mt-3 max-w-xl">Your place is saved, and your alerts are waiting for now: {heldSentence(held)}</p>;
      nextTitle = "Why your alerts are held";
    } else {
      // State A: verified, alerts genuinely on.
      celebration = (
        <>
          <p className="mt-3 max-w-xl">
            When a seller first lists {varietyName}, we’ll send you one alert by {channels} — and that’s all.
          </p>
          <p className="text-sm text-muted">Alerts on: {channels}.</p>
        </>
      );
      nextTitle = "Your waiting list";
    }

    return (
      <div className="mt-4" data-testid="waitlist-block" id={WAITLIST_BLOCK_ID}>
        {/* Celebration — on the PAPER ground: no .card, no border, no background. */}
        <section aria-labelledby="waitlist-success-title" className="mt-10 flex flex-col items-center text-center">
          <h3 id="waitlist-success-title" ref={successHeadingRef} tabIndex={-1} className="text-2xl font-semibold text-leaf">
            You’re on the waiting list for {varietyName} — glad to have you here.
          </h3>
          {celebration}
        </section>
        <section aria-labelledby="waitlist-next-title" className="card mt-8 flex flex-col gap-3 p-4">
          <h4 id="waitlist-next-title" className="text-base font-semibold">
            {nextTitle}
          </h4>
          {nextBody}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={leave} disabled={actionBusy}>
              Leave the waiting list
            </button>
            <Link href="/account" className="btn btn-secondary">
              Your alerts
            </Link>
          </div>
          {finishStep}
        </section>
        {noteBlock}
        {errorBlock}
      </div>
    );
  }

  // ─── The no-JS floor (§3.4): plain HTML forms, server-rendered from the `floor` prop ──

  const floorJoinErrors: FloorJoinError[] = floor.kind === "error" ? floor.errors : [];
  const floorEmailError = floorJoinErrors.includes("email_invalid") ? FLOOR_JOIN_FIELD_MESSAGES.email_invalid : null;
  const floorPhoneError = floorJoinErrors.includes("phone_invalid") ? FLOOR_JOIN_FIELD_MESSAGES.phone_invalid : null;
  const floorFormMessage = floorJoinErrors.map((c) => floorJoinFormMessage(c, varietyName)).find((m) => m !== null) ?? null;
  const floorJoinEntries = [
    ...(floorEmailError ? [{ fieldId: "waitlist-floor-email", message: floorEmailError }] : []),
    ...(floorPhoneError ? [{ fieldId: "waitlist-floor-phone", message: floorPhoneError }] : []),
  ];
  const floorJoinValues = floor.kind === "error" ? { email: floor.email, channel: floor.channel, phone: floor.phone } : { email: "", channel: "email" as FloorChannel, phone: "" };

  const floorJoinForm = (
    <form
      method="post"
      action="/api/v1/account/waitlist/join-form"
      onChange={syncFloorValues}
      className="flex flex-col gap-4"
      aria-label={`Join the waiting list for ${varietyName}`}
    >
      {floorFormMessage || floorJoinEntries.length >= 2 ? (
        <FieldSummary heading={floorFormMessage ?? WAITLIST_JOIN_SUMMARY_HEADING} entries={floorJoinEntries} summaryRef={floorSummaryRef} />
      ) : null}
      <p className="text-sm">Joining creates a free Seed Directory account.</p>
      <input type="hidden" name="variety" value={varietySlug} />
      <div className="flex flex-col gap-1">
        <label htmlFor="waitlist-floor-email" className="text-sm font-semibold">
          Email
        </label>
        <input
          id="waitlist-floor-email"
          name="email"
          type="email"
          required
          maxLength={320}
          autoComplete="email"
          defaultValue={floorJoinValues.email}
          aria-invalid={floorEmailError ? true : undefined}
          aria-describedby={floorEmailError ? "waitlist-floor-email-error" : undefined}
          className={`field${floorJoinValues.email !== "" ? " field-filled" : ""}`}
        />
        {floorEmailError ? <FieldErrorLine id="waitlist-floor-email-error" message={floorEmailError} /> : null}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">How should we tell you?</legend>
        <label className="flex min-h-target items-center gap-2">
          <input type="radio" name="channel" value="email" id="waitlist-floor-channel-email" defaultChecked={floorJoinValues.channel === "email"} />
          <span>Email only</span>
        </label>
        <label className="flex min-h-target items-start gap-2">
          <input type="radio" name="channel" value="sms" id="waitlist-floor-channel-sms" defaultChecked={floorJoinValues.channel === "sms"} className="mt-1" aria-describedby="waitlist-floor-sms-consent" />
          <span>
            Email and text
            <span id="waitlist-floor-sms-consent" className="block text-sm text-muted">
              {FLOOR_SMS_TEXT}
            </span>
          </span>
        </label>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor="waitlist-floor-phone" className="text-sm font-semibold">
          {FLOOR_PHONE_LABEL}
        </label>
        <input
          id="waitlist-floor-phone"
          name="phone"
          type="tel"
          maxLength={32}
          autoComplete="tel-national"
          inputMode="tel"
          defaultValue={floorJoinValues.phone}
          aria-invalid={floorPhoneError ? true : undefined}
          aria-describedby={floorPhoneError ? "waitlist-floor-phone-hint waitlist-floor-phone-error" : "waitlist-floor-phone-hint"}
          className={`field${floorJoinValues.phone !== "" ? " field-filled" : ""}`}
        />
        <span id="waitlist-floor-phone-hint" className="field-hint text-sm">
          US number. Your email + phone are how you sign in — there’s no password. We never show your phone number.
        </span>
        {floorPhoneError ? <FieldErrorLine id="waitlist-floor-phone-error" message={floorPhoneError} /> : null}
      </div>
      <div>
        <button type="submit" className="btn btn-primary">
          Join the waiting list
        </button>
      </div>
    </form>
  );

  // A code form holds one field, so a code failure is always the single-error case: the
  // inline line is the whole treatment, no summary box (SPEC §4.2.2; Ruling 9's "for a single
  // error, the block's error state").
  const floorCodeForm = (email: string | null, codeError: FloorCodeError | null) => (
    <form method="post" action="/api/v1/account/waitlist/verify-form" className="flex flex-col gap-2" aria-label="Verify your email">
      <input type="hidden" name="variety" value={varietySlug} />
      {email !== null ? <input type="hidden" name="email" value={email} /> : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="waitlist-floor-code" className="text-sm font-semibold">
          6-digit code from your email
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="waitlist-floor-code"
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? "waitlist-floor-code-hint waitlist-floor-code-error" : "waitlist-floor-code-hint"}
            className="field max-w-[11rem] font-mono tracking-[0.2em]"
          />
          <button type="submit" className="btn btn-primary">
            Verify
          </button>
        </div>
        <span id="waitlist-floor-code-hint" className="field-hint text-sm">
          It works for {CODE_TTL_MINUTES} minutes.
        </span>
        {codeError ? <FieldErrorLine id="waitlist-floor-code-error" message={FLOOR_CODE_MESSAGES[codeError]} /> : null}
      </div>
    </form>
  );

  if (!status) {
    // Before the status fetch resolves — and forever without JavaScript, or when the fetch
    // fails — the block IS the floor: the server-rendered state, never a loading shell.
    let floorBody: ReactNode;
    if (floor.kind === "verify" || floor.kind === "recognized") {
      const email = floor.kind === "recognized" ? floor.email : null;
      floorBody = (
        <>
          <h3 id="waitlist-code-title" className="text-xl font-semibold">
            {RECOGNIZED_HEADING}
          </h3>
          <p className="text-sm">{floor.kind === "recognized" ? recognizedCopy(email!) : floorVerifyCopy(varietyName)}</p>
          {floorCodeForm(email, floor.codeError)}
          {floor.kind === "recognized" ? (
            <p className="text-sm">
              <Link href={`/variety/${varietySlug}`}>{DIFFERENT_EMAIL}</Link>
            </p>
          ) : null}
        </>
      );
    } else if (floor.kind === "active") {
      const channels = floor.channels.map((c) => (c === "sms" ? "text" : "email")).join(" and ");
      floorBody = (
        <>
          <h3 id="waitlist-success-title" className="text-2xl font-semibold text-leaf">
            You’re on the waiting list for {varietyName} — glad to have you here.
          </h3>
          {floor.held || channels === "" ? (
            <p className="mt-3 max-w-xl">
              Your place is saved, and your alerts are waiting for now: {FLOOR_HELD_SENTENCE}.
            </p>
          ) : (
            <>
              <p className="mt-3 max-w-xl">
                When a seller first lists {varietyName}, we’ll send you one alert by {channels} — and that’s all.
              </p>
              <p className="text-sm text-muted">Alerts on: {channels}.</p>
            </>
          )}
          <p className="text-sm">
            <Link href="/account">Your alerts</Link>
          </p>
        </>
      );
    } else {
      floorBody = (
        <>
          <h3 id="waitlist-title" ref={joinHeadingRef} tabIndex={-1} className="text-xl font-semibold">
            Join the waiting list — we’ll let you know when a seller lists {varietyName}.
          </h3>
          <p className="text-sm text-muted">You can also choose a text alert. One alert when it’s first found; leave the list any time.</p>
          {fetchFailed ? (
            <p role="status" className="text-sm">
              {FETCH_FAILED_NOTE}
            </p>
          ) : null}
          {floorJoinForm}
        </>
      );
    }
    const labelledBy = floor.kind === "verify" || floor.kind === "recognized" ? "waitlist-code-title" : floor.kind === "active" ? "waitlist-success-title" : "waitlist-title";
    return (
      <section aria-labelledby={labelledBy} className="card mt-4 flex flex-col gap-3 p-4" data-testid="waitlist-block" id={WAITLIST_BLOCK_ID}>
        {floorBody}
      </section>
    );
  }

  if (status.signed_in) {
    // Signed in, not on the list (§3.2.6): one-click join, unchanged.
    return (
      <section aria-labelledby="waitlist-title" className="card mt-4 flex flex-col gap-3 p-4" data-testid="waitlist-block" id={WAITLIST_BLOCK_ID}>
        <h3 id="waitlist-title" ref={joinHeadingRef} tabIndex={-1} className="text-xl font-semibold">
          Join the waiting list — we’ll let you know when a seller lists {varietyName}.
        </h3>
        <p className="text-sm text-muted">You can also choose a text alert. One alert when it’s first found; leave the list any time.</p>
        {noteBlock}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={join} disabled={actionBusy}>
            Join the waiting list
          </button>
          <Link href="/account">Text alerts and settings</Link>
        </div>
        {errorBlock}
      </section>
    );
  }

  // Signed out, status resolved: the recognized-contact code state (§3.2.4) — reached either by
  // this session's join submit or by landing on the recognized floor with JavaScript on — or
  // the alert step.
  const continuity = !showAlertForm && floor.kind === "recognized" ? { email: floor.email, delivery: null as string | null } : null;
  const rec = recognized ?? continuity;
  if (rec) {
    return (
      <section aria-labelledby="waitlist-code-title" className="card mt-4 flex flex-col gap-3 p-4" data-testid="waitlist-block" id={WAITLIST_BLOCK_ID}>
        <h3 id="waitlist-code-title" ref={recognizedHeadingRef} tabIndex={-1} className="text-xl font-semibold">
          {RECOGNIZED_HEADING}
        </h3>
        <p className="text-sm">{recognizedCopy(rec.email)}</p>
        <CodeEntry
          channel="email"
          idPrefix="waitlist-recognized"
          initialNote={rec.delivery !== null ? deliveryNote(rec.delivery, "email") : null}
          onVerified={handleVerified}
          unauth={{ email: rec.email, verifyPath: "/api/v1/account/waitlist/verify", resendPath: "/api/v1/account/waitlist/code" }}
        />
        <p className="text-sm">
          <button
            type="button"
            className="underline"
            onClick={() => {
              setRecognized(null);
              setShowAlertForm(true);
            }}
          >
            {DIFFERENT_EMAIL}
          </button>
        </p>
        {errorBlock}
      </section>
    );
  }

  // The alert step (§3.2.1): email + channel choice, nothing else. No name, no ZIP, no account
  // type on this step.
  return (
    <section aria-labelledby="waitlist-title" className="card mt-4 flex flex-col gap-3 p-4" data-testid="waitlist-block" id={WAITLIST_BLOCK_ID}>
      <h3 id="waitlist-title" ref={joinHeadingRef} tabIndex={-1} className="text-xl font-semibold">
        Join the waiting list — we’ll let you know when a seller lists {varietyName}.
      </h3>
      <p className="text-sm text-muted">You can also choose a text alert. One alert when it’s first found; leave the list any time.</p>
      {noteBlock}
      <form onSubmit={createAndJoin} aria-busy={joinBusy || undefined} className="flex flex-col gap-4" aria-label={`Join the waiting list for ${varietyName}`}>
        {showJoinSummary ? <FieldSummary heading={joinFailure.form ?? WAITLIST_JOIN_SUMMARY_HEADING} entries={joinEntries} summaryRef={joinSummaryRef} /> : null}
        <p className="text-sm">Joining creates a free Seed Directory account.</p>
        <div className="flex flex-col gap-1">
          <label htmlFor="waitlist-email" className="text-sm font-semibold">
            Email
          </label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            defaultValue={floorValues.email}
            aria-invalid={joinEmailError ? true : undefined}
            aria-describedby={joinEmailError ? "waitlist-email-error" : undefined}
            onBlur={syncFilledClass}
            onChange={syncFilledClass}
            className={`field${floorValues.email !== "" ? " field-filled" : ""}`}
          />
          {joinEmailError ? <FieldErrorLine id="waitlist-email-error" message={joinEmailError} /> : null}
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">How should we tell you?</legend>
          <label className="flex min-h-target items-center gap-2">
            <input type="radio" name="channel" value="email" id="waitlist-channel-email" checked={channel === "email"} onChange={() => setChannel("email")} />
            <span>Email only</span>
          </label>
          <label className="flex min-h-target items-start gap-2">
            <input
              type="radio"
              name="channel"
              value="sms"
              id="waitlist-channel-sms"
              checked={channel === "sms"}
              onChange={() => setChannel("sms")}
              className="mt-1"
              aria-describedby="waitlist-sms-consent"
            />
            <span>
              Email and text
              <span id="waitlist-sms-consent" className="block text-sm text-muted">
                {FLOOR_SMS_TEXT}
              </span>
            </span>
          </label>
        </fieldset>
        {channel === "sms" ? (
          <div className="flex flex-col gap-1">
            <label htmlFor="waitlist-phone" className="text-sm font-semibold">
              Phone number
            </label>
            <input
              id="waitlist-phone"
              name="phone"
              type="tel"
              required
              maxLength={32}
              autoComplete="tel-national"
              inputMode="tel"
              defaultValue={floorValues.phone}
              aria-invalid={joinPhoneError ? true : undefined}
              aria-describedby={joinPhoneError ? "waitlist-phone-hint waitlist-phone-error" : "waitlist-phone-hint"}
              onBlur={syncFilledClass}
              onChange={syncFilledClass}
              className={`field${floorValues.phone !== "" ? " field-filled" : ""}`}
            />
            <span id="waitlist-phone-hint" className="field-hint text-sm">
              US number. Your email + phone are how you sign in — there’s no password. We never show your phone number.
            </span>
            {joinPhoneError ? <FieldErrorLine id="waitlist-phone-error" message={joinPhoneError} /> : null}
          </div>
        ) : null}
        <Turnstile siteKey={status.turnstile_site_key} onToken={setToken} resetKey={reset} action="waitlist-join" />
        <div>
          <button type="submit" className="btn btn-primary" disabled={joinBusy}>
            {joinBusy ? "Joining…" : "Join the waiting list"}
          </button>
        </div>
      </form>
      {errorBlock}
    </section>
  );
}
