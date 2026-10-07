// @ts-check
import { createHash } from "node:crypto";
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { JS_MARKER } from "./src/scripts/inline.mjs";

// The canonical address. Set SITE_URL in the build environment if the site moves.
const site = process.env.SITE_URL || "https://membercove.com";

const sha256 = (/** @type {string} */ text) => `sha256-${createHash("sha256").update(text).digest("base64")}`;

export default defineConfig({
  site,
  output: "static",
  compressHTML: true,
  build: { format: "directory" },
  integrations: [sitemap({ filter: (page) => !/\/(404|contact\/thanks)\/?$/.test(page) })],
  vite: { plugins: [tailwindcss()] },
  security: {
    // Astro writes a content security policy into each page, with hashes for the scripts and styles
    // it bundles. frame-ancestors cannot go in a meta tag; public/_headers sends it as a header.
    csp: {
      algorithm: "SHA-256",
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self' https://cdn.fontshare.com",
        "connect-src 'self' https://challenges.cloudflare.com",
        "frame-src https://challenges.cloudflare.com",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", "https://challenges.cloudflare.com"],
        hashes: [/** @type {`sha256-${string}`} */ (sha256(JS_MARKER))],
      },
      styleDirective: {
        resources: ["'self'", "https://api.fontshare.com"],
      },
    },
  },
});
