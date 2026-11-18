import type { Metadata } from "next";
import Link from "next/link";
import { ThemeArt } from "@/components/ui/ThemeArt";

export const metadata: Metadata = {
  title: "You’re offline",
  description: "This page isn’t saved on your device yet.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://seeds.hues.flowers/offline" },
};

/** PWA offline fallback (P7). Static; precached by the service worker. */
export default function OfflinePage() {
  return (
    <section className="max-w-2xl py-6" aria-labelledby="offline-title">
      <ThemeArt name="offline-path" priority className="art-frame mx-auto mb-4 h-[260px] w-auto" />
      <h1 id="offline-title" className="text-3xl font-semibold text-leaf">
        You’re offline
      </h1>
      <p className="mt-3 text-lg">
        This page hasn’t been saved on your device yet. Pages you have already opened still work offline — showing the
        last version we saved.
      </p>
      <p className="mt-3 text-muted">Reconnect to search and to see the latest stock states.</p>
      <ul className="mt-6 flex flex-wrap gap-2">
        <li>
          <Link href="/" className="btn btn-primary">
            Go to the home page
          </Link>
        </li>
        <li>
          <Link href="/variety" className="btn btn-secondary">
            Varieties
          </Link>
        </li>
        <li>
          <Link href="/seller" className="btn btn-secondary">
            Sellers
          </Link>
        </li>
      </ul>
    </section>
  );
}
