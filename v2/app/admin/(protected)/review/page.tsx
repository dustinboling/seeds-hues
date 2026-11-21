/** Review section (Slice 0 frame — the queue workspace lands in Slice A). */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { SectionFrame } from "@/components/admin/SectionFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Review" };

export default async function AdminReviewPage() {
  const { viewer, totalWaiting } = await adminPageData("/admin/review");
  return <SectionFrame viewer={viewer} section="review" reviewTotal={totalWaiting} title="Review" line="The review queues arrive in a later build slice." />;
}
