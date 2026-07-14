# Contributing to the 613 Webring

Welcome! 🌷 This ring is for **everyone building software in or around Ottawa** —
students, founders, hobbyists, career-switchers, and people writing their very
first lines of code. If that's you, we'd love to have your site on the ring.

Opening this pull request might be your **first PR ever**. That's wonderful — we
kept the process as gentle as possible, and we're happy to help in the comments.

---

## The short version

1. Add yourself to [`src/data/members.json`](./src/data/members.json).
2. Add the [widget](#step-2-add-the-widget-to-your-site) to your site's footer.
3. [Open a pull request](#step-3-open-a-pull-request).

That's it. Below is the same thing, slowly.

---

## Who can join?

If you **build software in or around the 613** — living here, studying here,
working here, or repping Ottawa from afar — you belong. We keep it friendly and
low-gatekeeping. A simple personal page, portfolio, blog, or "link in bio" site
is perfectly fine.

## Step 1: Add yourself to `members.json`

Open [`src/data/members.json`](./src/data/members.json) and add an object to the
**end of the array**. Adding to the end keeps merge conflicts rare.

```jsonc
{
  "name": "Ada Lovelace",
  "website": "https://ada.dev",
  "role": "Founder · ByWard Market",
  "location": "Ottawa, ON",
  "tags": ["frontend", "ai"],
  "blurb": "Building developer tools in the 613.",
  "links": ["https://builderscollective.ca"],
}
```

### Fields

| Field      | Required | Notes                                                                                                                                                                              |
| ---------- | :------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     |    ✅    | Your name or handle (max 80 chars).                                                                                                                                                |
| `website`  |    ✅    | Full URL to your personal site, starting with `https://`.                                                                                                                          |
| `role`     |    —     | Title or affiliation, e.g. `"SWE @ Shopify"` (max 100 chars).                                                                                                                      |
| `location` |    —     | Ottawa neighbourhood or `"Ottawa, ON"` (max 60 chars).                                                                                                                             |
| `tags`     |    —     | Up to 10 short keywords — your stack, interests.                                                                                                                                   |
| `blurb`    |    —     | One short line about what you build (max 200 chars).                                                                                                                               |
| `avatar`   |    —     | URL to a square image. If omitted, we generate a tidy monogram.                                                                                                                    |
| `links`    |    —     | Up to 10 links to other ring members you're connected to. Each is either a plain URL or `{ "url": …, "type": … }`. Shown on the [network page](https://www.613webring.ca/network). |

### Linking to other members

The optional `links` array maps how builders connect in Ottawa. Each link must
point at another member's `website` in the ring (use the full `https://` URL).
You can **tag how you know them** so the network graph colours the connection:

| `type`         | Meaning                                       |
| -------------- | --------------------------------------------- |
| `referred`     | They brought you into the ring / referred you |
| `collaborator` | You've built something together               |
| `mentor`       | They mentor you                               |
| `friend`       | A friend in the 613                           |

Links are directed — your entry points toward people you're connected to. A
plain URL (no `type`) still works as shorthand and shows as a neutral connection.

Example (mix both forms freely):

```json
"links": [
  { "url": "https://zahin.org", "type": "mentor" },
  { "url": "https://saoussen-slii.vercel.app/", "type": "collaborator" },
  "https://builderscollective.ca"
]
```

> **Tip:** Don't forget the comma after the previous entry, and make sure your
> JSON is valid. The build checks this for you — see below.

The ring lists real builders only — add yourself to the end of the array when you join.

## Step 2: Add the widget to your site

So the ring is actually a _ring_, add the navigation widget to your site's
footer. Pick one:

**Recommended — auto widget** (renders prev / random / next controls):

```html
<!-- 613 Webring -->
<div id="webring-613"></div>
<script src="https://www.613webring.ca/widget.js" defer></script>
```

**No-JavaScript alternative** (replace `https://your-site.com` with your URL):

```html
<!-- 613 Webring -->
<nav class="webring-613" aria-label="613 Webring">
  <a href="https://www.613webring.ca/nav?dir=prev&site=https://your-site.com"
    >← prev</a
  >
  <a href="https://www.613webring.ca">613 Webring</a>
  <a href="https://www.613webring.ca/nav?dir=next&site=https://your-site.com"
    >next →</a
  >
</nav>
```

Please add the widget **before** your entry is merged. It's what keeps the loop
connected for everyone.

## Step 3: Open a pull request

- Fork the repo (or use GitHub's web editor — the ✏️ on `members.json`).
- Commit your change with a message like `Add Ada Lovelace to the ring`.
- Open a pull request and fill in the short checklist in the template.

Automated checks run `npm run build`, which **validates your entry against the
schema**. If something's off (a missing field, an invalid URL, broken JSON), the
check fails with a message pointing at the problem. Fix it and push again, or ask
for help — we're glad to assist.

Once it's merged, you're on the ring. Welcome to the loop. 🎉

## Running it locally (optional)

You don't need to, but if you'd like to preview your card:

```bash
npm install
npm run dev   # http://localhost:4321
```

## Leaving the ring

Open a pull request removing your entry from `members.json`, or message a
maintainer. No hard feelings — the door's always open to come back.

---

By participating you agree to our [Code of Conduct](./CODE_OF_CONDUCT.md).
Thanks for helping connect Ottawa's builders. ❤️
