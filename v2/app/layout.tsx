import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { fraunces, newsreader } from "./fonts";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TabBar } from "@/components/layout/TabBar";
import { PwaRegister } from "@/components/layout/PwaRegister";
import { APP_SHORT_NAME, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, THEME_COLOR } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { capable: true, title: APP_SHORT_NAME, statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/hues-icon.svg", type: "image/svg+xml" }, { url: "/icons/hues-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/hues-apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
  colorScheme: "light",
};

const analyticsToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN?.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className={`${fraunces.variable} ${newsreader.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 rounded-lg bg-leaf px-4 py-3 font-sans font-semibold text-white">
          Skip to main content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="container-page flex-1 pt-6 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
        <TabBar />
        <PwaRegister />
        {analyticsToken ? (
          <Script
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={JSON.stringify({ token: analyticsToken })}
          />
        ) : null}
      </body>
    </html>
  );
}
