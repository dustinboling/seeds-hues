import type { Metadata } from "next";
import { VarietyView, varietyMetadata } from "../variety-view";

/**
 * The variety page narrowed to sellers carrying the Small farm badge (Open Directory, ux-spec §4).
 * Public URL: /variety/{slug}?small_farm=true — middleware.ts rewrites it here, so this view has
 * its own ISR cache entry, separate from /variety/{slug}'s. A direct request for this internal
 * path is redirected to the public URL by the same middleware. Same ISR contract as the parent.
 */
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return varietyMetadata(slug, true);
}

export default async function VarietySmallFarmsPage({ params }: Props) {
  const { slug } = await params;
  return <VarietyView slug={slug} smallFarmOnly />;
}
