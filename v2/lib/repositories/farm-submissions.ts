/**
 * Add Your Farm submissions (design §9) + the farm_summary enrichment jobs, which ride the
 * existing crawl_jobs queue (type "farm_summary", target = submission id). PRIVATE data.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { crawlJobs, farmSubmissions, sellers, users } from "@/lib/db/schema";

export type FarmSubmissionRow = typeof farmSubmissions.$inferSelect;
export type NewFarmSubmission = typeof farmSubmissions.$inferInsert;

export const FARM_SUMMARY_JOB = "farm_summary";

export async function insertFarmSubmission(db: Db, row: NewFarmSubmission): Promise<FarmSubmissionRow> {
  const [r] = await db.insert(farmSubmissions).values(row).returning();
  return r!;
}

export async function farmSubmissionById(db: Db, id: number): Promise<FarmSubmissionRow | null> {
  const [r] = await db.select().from(farmSubmissions).where(eq(farmSubmissions.id, id)).limit(1);
  return r ?? null;
}

export async function listFarmSubmissions(db: Db, opts: { status?: FarmSubmissionRow["status"]; limit: number }) {
  return db
    .select()
    .from(farmSubmissions)
    .where(opts.status ? eq(farmSubmissions.status, opts.status) : undefined)
    .orderBy(desc(farmSubmissions.createdAt), desc(farmSubmissions.id))
    .limit(opts.limit);
}

export async function updateFarmSubmission(db: Db, id: number, set: Partial<NewFarmSubmission>): Promise<void> {
  await db.update(farmSubmissions).set(set).where(eq(farmSubmissions.id, id));
}

export async function enqueueFarmSummaryJob(db: Db, submissionId: number, at: string): Promise<number> {
  const [r] = await db
    .insert(crawlJobs)
    .values({ type: FARM_SUMMARY_JOB, target: String(submissionId), status: "queued", createdAt: at, updatedAt: at, nextRunAt: at })
    .returning({ id: crawlJobs.id });
  return r!.id;
}

/** Queued farm_summary jobs (the CLI worker processes them one host at a time). */
export async function queuedFarmSummaryJobs(db: Db, limit: number) {
  return db
    .select()
    .from(crawlJobs)
    .where(and(eq(crawlJobs.type, FARM_SUMMARY_JOB), eq(crawlJobs.status, "queued")))
    .orderBy(crawlJobs.id)
    .limit(limit);
}

/** A job is done once it has run — a failed draft is recorded on the submission, not retried. */
export async function finishFarmSummaryJob(db: Db, jobId: number, at: string): Promise<void> {
  const [j] = await db.select({ attempts: crawlJobs.attempts }).from(crawlJobs).where(eq(crawlJobs.id, jobId)).limit(1);
  await db.update(crawlJobs).set({ status: "done", attempts: (j?.attempts ?? 0) + 1, updatedAt: at }).where(eq(crawlJobs.id, jobId));
}

export async function sellerBySlug(db: Db, slug: string) {
  const [r] = await db.select({ id: sellers.id, slug: sellers.slug, name: sellers.name }).from(sellers).where(eq(sellers.slug, slug)).limit(1);
  return r ?? null;
}

export async function sellersByIds(db: Db, ids: number[]) {
  if (ids.length === 0) return [];
  return db.select({ id: sellers.id, slug: sellers.slug, name: sellers.name }).from(sellers).where(inArray(sellers.id, ids));
}

/** Accounts whose email matches a submission's contact email (approval links the farm owner). */
export async function userIdByEmail(db: Db, email: string): Promise<number | null> {
  const [r] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  return r?.id ?? null;
}
