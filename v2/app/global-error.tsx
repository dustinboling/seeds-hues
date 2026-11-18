"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-US">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", color: "#2e2a23", background: "#f8f1e1" }}>
        <main>
          <h1 style={{ color: "#1e4634" }}>Something went wrong</h1>
          <p>The site couldn’t load this page.</p>
          <p>
            <button type="button" onClick={reset} style={{ minHeight: 44, padding: "0.5rem 1rem" }}>
              Try again
            </button>{" "}
            <a href="/" style={{ color: "#1f5c3d" }}>
              Home
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
