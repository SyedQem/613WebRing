<div align="center">

# 613 Webring

### The personal sites of Ottawa's builders, linked in a ring.

A webring connecting the software engineers, designers and budding coders
building in Ottawa — the **613**. Hop from one personal site to the next, or
add your own with a single pull request.

**Presented by [Builders Collective Ottawa](https://builderscollective.ca).**

[**→ Join the ring**](#-join-the-ring) · [Live site](https://www.613webring.ca) · [Contributing](./CONTRIBUTING.md)

</div>

---

## 🌷 What is this?

A **webring** is the old-internet way of connecting independent websites: each
member embeds a small widget that links to the **next** and **previous** site in
the loop. Start anywhere and keep clicking — you'll tour every builder in Ottawa
and end up right back where you began.

The 613 Webring is open to **anyone building software in or around Ottawa**:
students at uOttawa, Carleton and Algonquin, founders shipping startups,
seasoned engineers, and people writing their very first lines of code.

## 🔗 Join the ring

It takes three small steps and one pull request — full walkthrough in
**[CONTRIBUTING.md](./CONTRIBUTING.md)** (or the [/join](https://www.613webring.ca/join) page):

1. **Add your entry** to the end of the array in [`src/data/members.json`](./src/data/members.json):

   ```json
   {
     "name": "Ada Lovelace",
     "website": "https://ada.dev",
     "role": "Founder · ByWard Market",
     "location": "Ottawa, ON",
     "tags": ["frontend", "ai"],
     "blurb": "Building developer tools in the 613."
   }
   ```

   Only `name` and `website` are required.

2. **Add the widget** to your site's footer so visitors can travel the ring:

   ```html
   <!-- 613 Webring -->
   <div id="webring-613"></div>
   <script src="https://www.613webring.ca/widget.js" defer></script>
   ```

3. **Open a pull request.** Automated checks validate your entry; a maintainer
   merges it and you're live. 🎉

## 🛠️ Local development

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static build → dist/ (also validates members.json)
npm run preview  # preview the production build
```

Built with [Astro](https://astro.build) — pure static output, no backend.

## 📁 Project structure

```
src/
├── consts.ts              # site-wide config (domain, name, links) — one source of truth
├── data/members.json      # ← the ring. THIS is the file contributors edit
├── lib/members.ts         # Zod schema + validation (a bad entry fails the build)
├── components/            # Hero, RingViz, MemberGrid, EmbedSnippet, …
├── layouts/BaseLayout.astro
├── styles/global.css      # design tokens (BCO + Ottawa palette) as CSS variables
└── pages/
    ├── index.astro        # home
    ├── join.astro         # how to join
    ├── nav.astro          # the prev/next/random redirector
    └── 404.astro
public/
└── widget.js              # the embeddable ring widget members add to their sites
```

## 🎨 Branding & theming

Every colour is a CSS custom property in [`src/styles/global.css`](./src/styles/global.css).
The palette is rooted in Ottawa — tulip/Canada red, Rideau Canal blue, and the
oxidized-copper green of Parliament's rooftops — and is designed to be swapped
for Builders Collective Ottawa's exact brand by editing the **`BRAND TOKENS`**
block alone. The production domain lives in [`src/consts.ts`](./src/consts.ts)
as `SITE_URL` and feeds every widget snippet, so there's a single place to update
when the final domain is set.

## 🤝 Credits

Presented by **[Builders Collective Ottawa](https://builderscollective.ca)**.
Inspired by [uwatering](https://github.com/JusGu/uwatering) and
[se-webring](https://github.com/simcard0000/se-webring). Built with care for
everyone shipping in the **613**.

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for community expectations.
