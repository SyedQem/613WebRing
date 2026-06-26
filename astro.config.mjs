// @ts-check
import { defineConfig } from "astro/config";
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
});
