"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="max-w-2xl py-6" aria-labelledby="err-title">
      <h1 id="err-title" className="text-3xl font-semibold text-leaf">
        Something went wrong
      </h1>
      <p className="mt-3 text-muted">
        This page couldn’t load. If you are offline, pages you have opened before still work.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Home
        </Link>
      </div>
    </section>
  );
}
