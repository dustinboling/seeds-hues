/** Detail-view prop types (the review service's hydrated union, split per workspace). */
import type { AdminReviewService } from "@/lib/admin/review-service";
import type { QueueKey } from "@/lib/admin/review-queues";

export type AnyDetail = NonNullable<Awaited<ReturnType<AdminReviewService["detail"]>>>;
export type HuntDetail = Extract<AnyDetail, { type: "seller_candidate" }>;
export type FarmDetail = Extract<AnyDetail, { type: "farm_submission" }>;
export type ListingDetail = Extract<AnyDetail, { type: "listing_match" } | { type: "new_variety" }>;
export type HoldDetail = Extract<AnyDetail, { type: "duplicate_hold" }>;
export type ReportDetail = Extract<AnyDetail, { type: "seller_correction" } | { type: "removal" }>;

/** The union-typed members defeat === narrowing; these predicates narrow explicitly. */
export function isHuntDetail(d: AnyDetail): d is HuntDetail {
  return d.type === "seller_candidate";
}
export function isFarmDetail(d: AnyDetail): d is FarmDetail {
  return d.type === "farm_submission";
}
export function isHoldDetail(d: AnyDetail): d is HoldDetail {
  return d.type === "duplicate_hold";
}
export function isReportDetail(d: AnyDetail): d is ReportDetail {
  return d.type === "seller_correction" || d.type === "removal";
}
export function isListingDetail(d: AnyDetail): d is ListingDetail {
  return d.type === "listing_match" || d.type === "new_variety";
}

export interface DetailShell {
  role: string;
  queue: QueueKey;
  show: number;
  /** Friendly submitted date ("Nov 18, 2026"). */
  submittedOn: string;
}
