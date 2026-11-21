/** Listings section (Slice 0 frame — listing management lands in Slice C). */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { SectionFrame } from "@/components/admin/SectionFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Listings" };

export default async function AdminListingsPage() {
  const { viewer, totalWaiting } = await adminPageData("/admin/listings");
  return <SectionFrame viewer={viewer} section="listings" reviewTotal={totalWaiting} title="Listings" line="Listing management arrives in a later build slice." />;
}
