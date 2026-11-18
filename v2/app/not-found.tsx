import Link from "next/link";
import { SearchBox } from "@/components/search/SearchBox";
import { ThemeArt } from "@/components/ui/ThemeArt";

export default function NotFound() {
  return (
    <section className="max-w-2xl py-6" aria-labelledby="nf-title">
      <ThemeArt name="offline-path" priority className="art-frame mx-auto mb-4 h-[260px] w-auto" />
      <p className="eyebrow">404</p>
      <h1 id="nf-title" className="mt-1 text-3xl font-semibold text-leaf">
        We couldn’t find that page
      </h1>
      <p className="mt-3 text-muted">The link may be old, or the variety or seller may have been removed.</p>
      <div className="mt-5">
        <SearchBox label="Search flower seeds" size="md" />
      </div>
      <ul className="mt-6 flex flex-wrap gap-2">
        <li>
          <Link href="/variety" className="btn btn-secondary">
            All varieties
          </Link>
        </li>
        <li>
          <Link href="/seller" className="btn btn-secondary">
            All sellers
          </Link>
        </li>
        <li>
          <Link href="/" className="btn btn-secondary">
            Home
          </Link>
        </li>
      </ul>
    </section>
  );
}
