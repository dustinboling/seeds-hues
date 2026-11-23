import type { Metadata } from "next";
import { VarietyView, varietyMetadata } from "../variety-view";
import { parseFloorState } from "@/lib/waitlist-floor";

/**
 * The variety page carrying a no-JS waitlist floor state (Tranche 3.2, SPEC §3.4). Public URL:
 * /variety/{slug}?waitlist=… — middleware.ts rewrites it here, so the canonical page keeps its
 * ISR cache entry (an ISR page never sees its query string) and only floor-state URLs render
 * dynamically. A direct request for this internal path is redirected to the public URL by the
 * same middleware. Never indexed: the floor states are one visitor's transient form state.
 */
export const dynamic = "force-dynamic";
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const base = await varietyMetadata(slug, false);
  return { ...base, robots: { index: false, follow: true } };
}

export default async function VarietyWaitlistPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  return <VarietyView slug={slug} smallFarmOnly={false} waitlistFloor={parseFloorState(sp)} />;
}
