export interface ManifestExpectation {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
}

export interface ManifestIcon {
  src: string;
  sizes?: string;
  type?: string;
  purpose?: string;
}

export interface WebManifest {
  icons: ManifestIcon[];
  [key: string]: unknown;
}

export function checkManifestJson(manifest: unknown, expected: ManifestExpectation): string | null;
export function missingManifestIcons(manifest: WebManifest, exists: (sitePath: string) => boolean): string[];
export function htmlHasRegistration(html: string, script: string): boolean;
export function htmlHasHeadWiring(html: string, wiring: { themeColor: string; preloadHref: string }): string[];
export function swLooksInjected(swText: string, shape: { precachedUrl: string }): boolean;
