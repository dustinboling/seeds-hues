/** Varieties section (Slice 0 frame — variety and crop management lands in Slice C). */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { SectionFrame } from "@/components/admin/SectionFrame";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Varieties" };

export default async function AdminVarietiesPage() {
  const { viewer, totalWaiting } = await adminPageData("/admin/varieties");
  return (
    <SectionFrame viewer={viewer} section="varieties" reviewTotal={totalWaiting} title="Varieties" line="Variety and crop management arrives in a later build slice." />
  );
}
