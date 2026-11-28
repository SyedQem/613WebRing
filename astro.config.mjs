// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";

import { SITE_URL } from "./src/consts.ts";

// https://astro.build/config
export default defineConfig({
  // The production URL. Change `SITE_URL` in src/consts.ts when the final
  // domain is decided — every widget snippet and canonical link reads from it.
  site: SITE_URL,
  output: "static",
  integrations: [react(), sitemap()],
  trailingSlash: "ignore",

  // Fonts are downloaded at build time and served from our own origin (no
  // render-blocking request to Google Fonts, no third-party connection). Each
  // family is one variable file covering every weight the site uses, and Astro
  // generates metric-matched fallbacks so the swap doesn't shift layout.
  // BaseLayout renders them with <Font /> and global.css maps the variables
  // onto --font-sans / --font-display / --font-mono.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["400 700"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Space Grotesk",
      cssVariable: "--font-space-grotesk",
      weights: ["500 700"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      weights: ["400 700"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
});
