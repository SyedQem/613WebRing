/**
 * 613 Webring — global configuration.
 *
 * This is the single source of truth for site-wide values. The production
 * domain lives here as `SITE_URL`; the embeddable widget snippets, canonical
 * links, sitemap and Open Graph tags all read from it. When the final domain
 * is decided, change it in ONE place: right here.
 */

// The production origin (no trailing slash). Placeholder until the domain is set.
export const SITE_URL = "https://613webring.xyz";

export const SITE_NAME = "613 Webring";
export const SITE_TAGLINE =
  "The personal sites of Ottawa's builders, linked in a ring.";
export const SITE_DESCRIPTION =
  "The 613 Webring connects the personal websites of Ottawa's software engineers, " +
  "designers and budding coders into one navigable ring. Presented by Builders " +
  "Collective Ottawa. Add yours with a single pull request.";

/** Builders Collective Ottawa — the community that presents the ring. */
export const BCO = {
  name: "Builders Collective Ottawa",
  short: "BCO",
  url: "https://builderscollective.ca",
  instagram: "https://instagram.com/builderscollectiveottawa",
  discord: "https://discord.gg/builderscollective",
} as const;

/** Public repository — where members open their pull request to join. */
export const REPO_URL = "https://github.com/SyedQem/613WebRing";
export const REPO_EDIT_MEMBERS_URL = `${REPO_URL}/edit/main/src/data/members.json`;
export const REPO_NEW_PR_URL = `${REPO_URL}/compare`;

/** Top navigation. */
export const NAV_LINKS = [
  { label: "Members", href: "/#members" },
  { label: "The Ring", href: "/#ring" },
  { label: "Join", href: "/join" },
  { label: "GitHub", href: REPO_URL, external: true },
] as const;

/** Social / community links surfaced in the footer. */
export const SOCIAL_LINKS = [
  { label: "Builders Collective Ottawa", href: BCO.url },
  { label: "Instagram", href: BCO.instagram },
  { label: "Discord", href: BCO.discord },
  { label: "GitHub", href: REPO_URL },
] as const;
