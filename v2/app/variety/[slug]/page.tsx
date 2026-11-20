import type { Metadata } from "next";
import { VarietyView, varietyMetadata } from "./variety-view";

// X4: nothing is pre-rendered at build (no build-time D1); every variety renders on first hit
// and is cached (ISR, OpenNext R2 incremental cache) with on-demand revalidation + 24 h fallback.
// This route never reads searchParams (that would opt it into dynamic rendering): the
// `?small_farm=true` view is the sibling route ./small-farms, reached by a middleware rewrite.
export const revalidate = 86400;
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return varietyMetadata(slug, false);
}

export default async function VarietyPage({ params }: Props) {
  const { slug } = await params;
  return <VarietyView slug={slug} smallFarmOnly={false} />;
}
