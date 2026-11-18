import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "node_modules/**",
      "public/sw.js",
      "cloudflare-env.d.ts",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "tmp/**",
      "seed-data/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // Next's no-html-link-for-pages: /llms.txt is a route handler, not a page.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["scripts/sw.template.js"],
    languageOptions: { globals: { self: "readonly", caches: "readonly", fetch: "readonly", Response: "readonly", Request: "readonly", URL: "readonly" } },
  },
];

export default config;
