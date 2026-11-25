/**
 * The form chassis' shared builders (Step 2.1): one field mapping the
 * SSR floor POSTs and the enhanced JSON submits both use, so the two
 * paths carry identical payloads by construction, plus the floor
 * outcome mapping (success states as v2 renders them; rejections mapped
 * to the plain-language failures with the typed values preserved).
 * Normalization in both builders is v2's submit-handler mapping,
 * exactly (ReportForm.submit / AddYourFarmForm.submit).
 */
import type { MappedFormFailure } from "../components/account/account-errors";
import { farmFailure } from "../components/farm/farm-errors";
import { reportFailure } from "../components/report/report-errors";

/** The backend's answer reduced to what the outcome mapping reads. */
export interface BackendResult {
  ok: boolean;
  status: number;
  code: string;
  detail: string;
}

export function backendResultOf(status: number, json: { code?: string; detail?: string }): BackendResult {
  return { ok: status >= 200 && status < 300, status, code: json.code ?? "error", detail: json.detail ?? `Something went wrong (${status}).` };
}

/* ── report ── */

export interface ReportFloorValues {
  type: string;
  targetType: "variety" | "seller";
  targetRef: string;
  message: string;
  contact: string;
}

export type ReportFloorOutcome =
  | { kind: "success"; targetType: "variety" | "seller"; targetRef: string }
  | { kind: "failure"; failure: MappedFormFailure; values: ReportFloorValues };

/** Floor fields → backend JSON (v2's ReportForm.submit mapping). */
export function reportJsonFromForm(fields: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: (fields.type ?? "").trim(),
    target_type: (fields.target_type ?? "").trim(),
    target_ref: (fields.target_ref ?? "").trim().toLowerCase(),
    message: fields.message ?? "",
    contact: (fields.contact ?? "").trim(),
  };
  const token = (fields.turnstile_token ?? "").trim();
  if (token) out.turnstile_token = token;
  return out;
}

/** The normalized values a floor re-render preserves (target coerced to its two legal values). */
export function reportValuesFromSubmission(submission: Record<string, unknown>): ReportFloorValues {
  return {
    type: typeof submission.type === "string" ? submission.type : "",
    targetType: submission.target_type === "variety" ? "variety" : "seller",
    targetRef: typeof submission.target_ref === "string" ? submission.target_ref : "",
    message: typeof submission.message === "string" ? submission.message : "",
    contact: typeof submission.contact === "string" ? submission.contact : "",
  };
}

export function reportFloorOutcome(result: BackendResult, values: ReportFloorValues): ReportFloorOutcome {
  if (result.ok) return { kind: "success", targetType: values.targetType, targetRef: values.targetRef };
  return { kind: "failure", failure: reportFailure(result.status, result.code, result.detail), values };
}

/* ── farm ── */

export interface FarmFloorValues {
  farm_name: string;
  contact_name: string;
  contact_email: string;
  city: string;
  state: string;
  website: string;
  about: string;
  varieties: string;
  authorized: boolean;
  business_phone: string;
  gbp_url: string;
  instagram_url: string;
  tiktok_url: string;
  facebook_url: string;
  wholesale: string;
  notes: string;
}

export type FarmFloorOutcome = { kind: "success" } | { kind: "failure"; failure: MappedFormFailure; values: FarmFloorValues };

/** Floor fields → backend JSON (v2's AddYourFarmForm.submit mapping). */
export function farmJsonFromForm(fields: Record<string, string>): Record<string, unknown> {
  const s = (k: string): string => (fields[k] ?? "").trim();
  const out: Record<string, unknown> = {
    farm_name: s("farm_name"),
    contact_name: s("contact_name"),
    contact_email: s("contact_email"),
    city: s("city"),
    state: s("state"),
    website: s("website"),
    about: s("about"),
    varieties: s("varieties"),
    authorized: fields.authorized === "on",
    business_phone: s("business_phone"),
    gbp_url: s("gbp_url"),
    instagram_url: s("instagram_url"),
    tiktok_url: s("tiktok_url"),
    facebook_url: s("facebook_url"),
    wholesale: s("wholesale"),
    notes: s("notes"),
  };
  const token = s("turnstile_token");
  if (token) out.turnstile_token = token;
  return out;
}

/** The normalized values a floor re-render preserves. */
export function farmValuesFromSubmission(submission: Record<string, unknown>): FarmFloorValues {
  const s = (v: unknown): string => (typeof v === "string" ? v : "");
  return {
    farm_name: s(submission.farm_name),
    contact_name: s(submission.contact_name),
    contact_email: s(submission.contact_email),
    city: s(submission.city),
    state: s(submission.state),
    website: s(submission.website),
    about: s(submission.about),
    varieties: s(submission.varieties),
    authorized: submission.authorized === true,
    business_phone: s(submission.business_phone),
    gbp_url: s(submission.gbp_url),
    instagram_url: s(submission.instagram_url),
    tiktok_url: s(submission.tiktok_url),
    facebook_url: s(submission.facebook_url),
    wholesale: s(submission.wholesale),
    notes: s(submission.notes),
  };
}

export function farmFloorOutcome(result: BackendResult, values: FarmFloorValues): FarmFloorOutcome {
  if (result.ok) return { kind: "success" };
  return { kind: "failure", failure: farmFailure(result.status, result.code, result.detail), values };
}
