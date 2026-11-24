import { preloadFaces } from "../src/design-system/fonts";
import { SW_URL, buildRegistrationScript } from "../src/pwa";
import { APP_SHORT_NAME, THEME_COLOR } from "../src/site";

// https://vike.dev/Head — tags every page carries.
export function Head() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="color-scheme" content="light" />
      <meta name="theme-color" content={THEME_COLOR} />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content={APP_SHORT_NAME} />
      <link rel="manifest" href="/manifest.webmanifest" />
      <link rel="icon" href="/icons/hues-icon.svg" type="image/svg+xml" />
      <link rel="icon" href="/icons/hues-icon-192.png" sizes="192x192" type="image/png" />
      <link rel="apple-touch-icon" href="/icons/hues-apple-touch-icon.png" />
      {preloadFaces().map((face) => (
        <link
          key={face.file}
          rel="preload"
          href={face.file}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      ))}
      {/* The service worker exists only in production builds (built + asserted
          by `npm run build`); registering in dev would 404 against /sw.js. */}
      {import.meta.env.PROD && (
        <script
          data-sw-register={SW_URL}
          dangerouslySetInnerHTML={{ __html: buildRegistrationScript() }}
        />
      )}
    </>
  );
}
