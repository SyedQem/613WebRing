# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **613 Webring** — a static Astro site that links the personal websites of
Ottawa builders into a webring. Members add themselves via a single PR editing
one JSON file; the site renders member cards, ring/network visualizations, and
serves an embeddable widget plus a prev/next/random redirector.

## Commands

```bash
npm install
npm run dev          # dev server → http://localhost:4321
npm run build        # static build → dist/ (ALSO runs the members.json Zod validation)
npm run preview      # preview the production build
npm run format       # prettier --write .
npm run format:check # prettier --check . (what CI enforces)
```

There is **no test suite**. Validation happens at build time: `astro build`
imports `src/lib/members.ts`, which Zod-parses `members.json` and throws with a
pointed message on any bad entry. To "test" a data change, run `npm run build`.

CI (`.github/workflows/ci.yml`) runs exactly two jobs on every PR: `npm run
build` (validate + build) and `npm run format:check`. Run both locally before
considering work done.

## Architecture

**Static, no backend.** Astro with `output: "static"` (see `astro.config.mjs`),
React only for interactive `.tsx` islands under `src/components/motion/`.

Two files are the source of truth; most work flows through them:

- **`src/consts.ts`** — every site-wide value (production `SITE_URL`, name,
  nav/social links, repo URLs). `astro.config.mjs` and all widget snippets read
  `SITE_URL` from here. Change the domain in this one place.
- **`src/data/members.json`** — the ring itself. This is the file contributors
  edit; order in the array *is* ring order. Only `name` and `website` are
  required; see `memberSchema` for the rest.

**`src/lib/members.ts`** is the data layer. It validates `members.json`, then
derives everything the UI consumes: `members` (enriched with `id`/`domain`/
`origin`/`index`), `allTags`, and the link graph. It runs `resolveLinks()` which
validates the optional `links` field (must point to another member's origin, no
self-links) and produces `networkGraph` for the network visualization. Adding a
derived member field means editing `RingMember` and the `.map()` here — don't
recompute in components.

**Navigation flow (the webring mechanism):**
1. A member embeds `public/widget.js` on their own site. It renders in a Shadow
   DOM (style-isolated) and derives the ring's origin from its own `<script src>`.
2. Its prev/next/random links point to `SITE_URL/nav?dir=…&site=<their-origin>`.
3. `src/pages/nav.astro` inlines the ordered ring, finds the caller's origin in
   the list client-side, and `location.replace()`s to the neighbor. If the
   caller isn't in the ring it shows a "not on the ring yet" state.

The widget (`public/widget.js`) is hand-written vanilla ES5-style JS served as a
static asset — it is intentionally dependency-free and framework-free because it
runs on third-party sites. Keep it that way.

**Styling:** all colors are CSS custom properties in `src/styles/global.css`
under a `BRAND TOKENS` block (Ottawa-rooted palette). Theme by editing tokens,
not component styles.

## Conventions

- Prettier (with `prettier-plugin-astro`) is the only formatter; CI fails on
  unformatted files. Run `npm run format` before committing.
- Members join by appending to the end of the `members.json` array. Full
  contributor walkthrough is in `CONTRIBUTING.md`.
