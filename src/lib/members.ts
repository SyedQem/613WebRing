/**
 * Members data + validation.
 *
 * The raw list lives in `src/data/members.json` — that's the ONLY file
 * contributors touch. It is validated here with Zod at build time, so a
 * malformed entry fails `astro build` (and therefore CI) with a clear message
 * instead of silently shipping a broken card.
 */
import { z } from "zod";
import rawMembers from "../data/members.json";

const httpsUrl = z
  .string()
  .trim()
  .url({ message: "must be a full URL, e.g. https://your-site.com" })
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "must start with http:// or https://",
  });

export const memberSchema = z.object({
  /** Display name. Required. */
  name: z.string().trim().min(1).max(80),
  /** Personal website. Required, must be a full http(s) URL. */
  website: httpsUrl,
  /** Optional title / affiliation, e.g. "SWE @ Shopify" or "Student · uOttawa". */
  role: z.string().trim().max(100).optional(),
  /** Optional Ottawa neighbourhood or "Ottawa, ON". */
  location: z.string().trim().max(60).optional(),
  /** Optional tags used by search & filtering. */
  tags: z.array(z.string().trim().min(1).max(24)).max(10).optional(),
  /** Optional one-line bio (keep it short). */
  blurb: z.string().trim().max(200).optional(),
  /** Optional avatar image URL. */
  avatar: httpsUrl.optional(),
  /** Optional links to other ring members (full website URLs). */
  links: z.array(httpsUrl).max(10).optional(),
});

export type Member = z.infer<typeof memberSchema>;

/** A member enriched with derived, display-ready fields. */
export type RingMember = Member & {
  /** Stable slug derived from the name (used for ids / anchors). */
  id: string;
  /** Hostname of the website, for compact display (e.g. "ada.dev"). */
  domain: string;
  /** Normalised origin (protocol + host), used by the webring navigation. */
  origin: string;
  /** Position in the ring (0-based) and the human-friendly 1-based index. */
  index: number;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hostOf(url: string): { domain: string; origin: string } {
  try {
    const u = new URL(url);
    return { domain: u.host.replace(/^www\./, ""), origin: u.origin };
  } catch {
    return { domain: url, origin: url };
  }
}

function validate(): Member[] {
  const result = z.array(memberSchema).safeParse(rawMembers);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => {
        const where = i.path.length
          ? `members[${i.path.join(".")}]`
          : "members";
        return `  • ${where}: ${i.message}`;
      })
      .join("\n");
    throw new Error(
      "\n\n613 Webring — src/data/members.json failed validation:\n" +
        issues +
        "\n\nFix the entry above and try again. See CONTRIBUTING.md for the schema.\n",
    );
  }
  return result.data;
}

const validated = validate();

/** All members, in ring order, enriched with derived fields. */
export const members: RingMember[] = validated.map((m, index) => {
  const { domain, origin } = hostOf(m.website);
  return {
    ...m,
    id: slugify(m.name) || `member-${index + 1}`,
    domain,
    origin,
    index,
  };
});

export const memberCount = members.length;

/** All distinct tags across the ring, alphabetised. */
export const allTags: string[] = [
  ...new Set(members.flatMap((m) => m.tags ?? [])),
].sort((a, b) => a.localeCompare(b));

export type MemberEdge = { from: RingMember; to: RingMember };

export type NetworkNode = {
  id: string;
  name: string;
  domain: string;
  website: string;
  role?: string;
  tags?: string[];
};

export type NetworkEdge = { source: string; target: string };

function resolveLinks(): {
  memberEdges: MemberEdge[];
  networkGraph: { nodes: NetworkNode[]; edges: NetworkEdge[] };
} {
  const byOrigin = new Map(members.map((m) => [m.origin, m]));
  const edges: MemberEdge[] = [];
  const errors: string[] = [];

  for (const member of members) {
    const rawLinks = member.links ?? [];
    const seen = new Set<string>();

    for (const url of rawLinks) {
      const { origin } = hostOf(url);

      if (seen.has(origin)) continue;
      seen.add(origin);

      if (origin === member.origin) {
        errors.push(
          `  • ${member.name}: cannot link to yourself (${url})`,
        );
        continue;
      }

      const target = byOrigin.get(origin);
      if (!target) {
        errors.push(
          `  • ${member.name}: link target not in the ring (${url})`,
        );
        continue;
      }

      edges.push({ from: member, to: target });
    }
  }

  if (errors.length > 0) {
    throw new Error(
      "\n\n613 Webring — src/data/members.json link validation failed:\n" +
        errors.join("\n") +
        "\n\nEach link must be another member's full website URL. See CONTRIBUTING.md.\n",
    );
  }

  const nodes: NetworkNode[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    domain: m.domain,
    website: m.website,
    role: m.role,
    tags: m.tags,
  }));

  const networkEdges: NetworkEdge[] = edges.map((e) => ({
    source: e.from.id,
    target: e.to.id,
  }));

  return { memberEdges: edges, networkGraph: { nodes, edges: networkEdges } };
}

const { memberEdges, networkGraph } = resolveLinks();

/** All resolved directed edges between members. */
export { memberEdges };

/** Edge count across the network graph. */
export const linkCount = memberEdges.length;

/** Members with at least one outgoing or incoming link. */
export const membersWithLinks: RingMember[] = members.filter((m) =>
  memberEdges.some((e) => e.from.id === m.id || e.to.id === m.id),
);

/** Serializable graph payload for the network visualization. */
export { networkGraph };
