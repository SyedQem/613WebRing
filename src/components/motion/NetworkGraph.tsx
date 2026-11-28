import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EdgeType, NetworkEdge, NetworkNode } from "../../lib/members";
import { motionOn, onMotionChange } from "../../lib/motion-pref";

// Same steps as MemberCard.astro: the lightest still gives the monogram 7:1.
const PALETTE = [
  "#1c1c1c",
  "#262626",
  "#303030",
  "#3a3a3a",
  "#444444",
  "#4c4c4c",
];

/**
 * Edge colour, dash pattern and legend label per relationship type. The dash
 * pattern means the types can be told apart without relying on colour
 * (WCAG 1.4.1).
 */
const EDGE_STYLE: Record<
  EdgeType,
  { color: string; dash?: string; label: string }
> = {
  referred: { color: "var(--rel-referred)", label: "Referred" },
  collaborator: {
    color: "var(--rel-collaborator)",
    dash: "9 4",
    label: "Collaborator",
  },
  mentor: { color: "var(--rel-mentor)", dash: "2 4", label: "Mentor" },
  friend: { color: "var(--rel-friend)", dash: "9 4 2 4", label: "Friend" },
  connection: { color: "var(--node-line)", label: "Connection" },
};

/** Smallest comfortable pointer target, as a radius (WCAG 2.5.5: 44px). */
const MIN_HIT_RADIUS = 22;
/** Arrow-key step when moving a focused node. */
const NUDGE = 16;
/** Pointer travel (px) beyond which a press counts as a drag, not a click. */
const DRAG_SLOP = 4;

const EDGE_TYPES: EdgeType[] = [
  "referred",
  "collaborator",
  "mentor",
  "friend",
  "connection",
];

/** Phrase an edge from the active node's perspective. */
function phraseOutgoing(type: EdgeType, name: string): string {
  switch (type) {
    case "referred":
      return `Referred by ${name}`;
    case "collaborator":
      return `Collaborates with ${name}`;
    case "mentor":
      return `Mentored by ${name}`;
    case "friend":
      return `Friends with ${name}`;
    default:
      return `Connected to ${name}`;
  }
}

function phraseIncoming(type: EdgeType, name: string): string {
  switch (type) {
    case "referred":
      return `Referred ${name}`;
    case "collaborator":
      return `Collaborates with ${name}`;
    case "mentor":
      return `Mentors ${name}`;
    case "friend":
      return `Friends with ${name}`;
    default:
      return `Linked from ${name}`;
  }
}

type SimNode = NetworkNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
};

type Props = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

function monogram(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function swatchFor(name: string): string {
  const hash = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTE[hash % PALETTE.length];
}

function nodeRadius(degree: number): number {
  return 14 + Math.min(degree, 6) * 2;
}

/**
 * One step of the force layout, mutating `sim` in place. Returns the fastest
 * node's speed so the caller can tell when the layout has come to rest.
 */
function stepSimulation(
  sim: SimNode[],
  links: [SimNode, SimNode][],
  w: number,
  h: number,
  dragId: string | null,
): number {
  const cx = w / 2;
  const cy = h / 2;

  for (let i = 0; i < sim.length; i++) {
    for (let j = i + 1; j < sim.length; j++) {
      const a = sim[i];
      const b = sim[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = 4200 / (dist * dist);
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      if (a.id !== dragId) {
        a.vx -= dx;
        a.vy -= dy;
      }
      if (b.id !== dragId) {
        b.vx += dx;
        b.vy += dy;
      }
    }
  }

  for (const [a, b] of links) {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ideal = 120 + nodeRadius(a.degree) + nodeRadius(b.degree);
    const force = (dist - ideal) * 0.04;
    dx = (dx / dist) * force;
    dy = (dy / dist) * force;
    if (a.id !== dragId) {
      a.vx += dx;
      a.vy += dy;
    }
    if (b.id !== dragId) {
      b.vx -= dx;
      b.vy -= dy;
    }
  }

  let fastest = 0;
  for (const n of sim) {
    if (n.id === dragId) continue;
    n.vx += (cx - n.x) * 0.002;
    n.vy += (cy - n.y) * 0.002;
    n.vx *= 0.82;
    n.vy *= 0.82;
    const x = Math.max(40, Math.min(w - 40, n.x + n.vx));
    const y = Math.max(40, Math.min(h - 40, n.y + n.vy));
    fastest = Math.max(fastest, Math.hypot(x - n.x, y - n.y));
    n.x = x;
    n.y = y;
  }
  return fastest;
}

/**
 * Below this speed (px per step) the layout counts as settled. The forces have
 * a long, barely visible tail — the last 0.1px/frame of drift would otherwise
 * keep the loop (and a React render per frame) alive for several more seconds.
 */
const REST_SPEED = 0.1;
/** Safety net: never animate one run for longer than this many frames. */
const MAX_STEPS = 1500;

export default function NetworkGraph({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const simRef = useRef<SimNode[]>([]);
  const linksRef = useRef<[SimNode, SimNode][]>([]);
  const sizeRef = useRef(size);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const visibleRef = useRef(true);
  /** Wakes the layout loop after something disturbs it (drag, nudge, resize). */
  const kickRef = useRef<() => void>(() => {});

  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of nodes) map.set(n.id, 0);
    for (const e of edges) {
      map.set(e.source, (map.get(e.source) ?? 0) + 1);
      map.set(e.target, (map.get(e.target) ?? 0) + 1);
    }
    return map;
  }, [nodes, edges]);

  const activeId = hoveredId ?? focusedId;
  const activeNode = activeId
    ? simNodes.find((n) => n.id === activeId)
    : undefined;

  const incidentEdges = useMemo(() => {
    if (!activeId) return new Set<string>();
    return new Set(
      edges
        .filter((e) => e.source === activeId || e.target === activeId)
        .map((e) => `${e.source}->${e.target}`),
    );
  }, [activeId, edges]);

  const nameById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n.name])),
    [nodes],
  );

  /** Connections of the active node, phrased for the info panel. */
  const activeConnections = useMemo(() => {
    if (!activeId) return [] as { key: string; type: EdgeType; text: string }[];
    const out: { key: string; type: EdgeType; text: string }[] = [];
    for (const e of edges) {
      if (e.source === activeId) {
        const name = nameById.get(e.target) ?? e.target;
        out.push({
          key: `o:${e.source}->${e.target}`,
          type: e.type,
          text: phraseOutgoing(e.type, name),
        });
      } else if (e.target === activeId) {
        const name = nameById.get(e.source) ?? e.source;
        out.push({
          key: `i:${e.source}->${e.target}`,
          type: e.type,
          text: phraseIncoming(e.type, name),
        });
      }
    }
    return out;
  }, [activeId, edges, nameById]);

  /** Relationship types actually present, in canonical order (for the legend). */
  const presentTypes = useMemo(() => {
    const set = new Set(edges.map((e) => e.type));
    return EDGE_TYPES.filter((t) => set.has(t));
  }, [edges]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setSize((prev) =>
          prev.w === width && prev.h === height
            ? prev
            : { w: width, h: height },
        );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Seed the layout: every node on a circle. Runs when the data changes.
  useEffect(() => {
    const { w, h } = sizeRef.current;
    const spread = Math.min(w, h) * 0.32;
    const initial: SimNode[] = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      return {
        ...n,
        x: w / 2 + spread * Math.cos(angle),
        y: h / 2 + spread * Math.sin(angle),
        vx: 0,
        vy: 0,
        degree: degreeMap.get(n.id) ?? 0,
      };
    });
    const byId = new Map(initial.map((n) => [n.id, n]));
    simRef.current = initial;
    linksRef.current = edges.flatMap((e) => {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      return a && b ? [[a, b] as [SimNode, SimNode]] : [];
    });
    setSimNodes([...initial]);
    kickRef.current();
  }, [nodes, edges, degreeMap]);

  // On resize, keep the arrangement and just rescale it into the new box
  // (re-seeding here would throw the layout away every time a phone's URL bar
  // slides in or out).
  useEffect(() => {
    const prev = sizeRef.current;
    sizeRef.current = size;
    if (prev.w === size.w && prev.h === size.h) return;
    for (const n of simRef.current) {
      n.x = (n.x / prev.w) * size.w;
      n.y = (n.y / prev.h) * size.h;
    }
    setSimNodes([...simRef.current]);
    kickRef.current();
  }, [size]);

  // The layout loop. It animates only while the graph is actually moving, on
  // screen and in a visible tab, then stops — it used to run (and re-render the
  // whole SVG) 60 times a second forever. With motion off it jumps straight to
  // the settled layout instead of animating towards it.
  useEffect(() => {
    const step = () =>
      stepSimulation(
        simRef.current,
        linksRef.current,
        sizeRef.current.w,
        sizeRef.current.h,
        draggingRef.current,
      );

    const stop = () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };

    let steps = 0;
    const tick = () => {
      if (!runningRef.current) return;
      const fastest = step();
      setSimNodes([...simRef.current]);
      const dragging = draggingRef.current !== null;
      if (dragging) steps = 0;
      if (!dragging && (fastest < REST_SPEED || ++steps > MAX_STEPS)) {
        runningRef.current = false;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!simRef.current.length) return;
      if (!motionOn()) {
        stop();
        // Mid-drag the node simply follows the pointer; settle on release.
        if (draggingRef.current) return;
        for (let i = 0; i < MAX_STEPS && step() >= REST_SPEED; i++);
        setSimNodes([...simRef.current]);
        return;
      }
      if (runningRef.current || !visibleRef.current || document.hidden) return;
      runningRef.current = true;
      steps = 0;
      rafRef.current = requestAnimationFrame(tick);
    };
    kickRef.current = kick;

    const el = containerRef.current;
    const io = new IntersectionObserver((entries) => {
      visibleRef.current = entries[entries.length - 1].isIntersecting;
      if (visibleRef.current) kick();
      else stop();
    });
    if (el) io.observe(el);
    const onVisibility = () => (document.hidden ? stop() : kick());
    document.addEventListener("visibilitychange", onVisibility);
    const offMotion = onMotionChange(kick);

    kick();
    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      offMotion();
      kickRef.current = () => {};
    };
  }, []);

  const getPointerPos = useCallback(
    (clientX: number, clientY: number) => {
      const svg = containerRef.current?.querySelector("svg");
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scaleX = size.w / rect.width;
      const scaleY = size.h / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    [size.w, size.h],
  );

  const onPointerDown = (id: string, e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = id;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    draggedRef.current = false;
    setFocusedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const id = draggingRef.current;
    if (!id) return;
    const from = dragStartRef.current;
    if (
      !draggedRef.current &&
      from &&
      Math.hypot(e.clientX - from.x, e.clientY - from.y) < DRAG_SLOP
    )
      return;
    draggedRef.current = true;
    const { x, y } = getPointerPos(e.clientX, e.clientY);
    const sim = simRef.current;
    const node = sim.find((n) => n.id === id);
    if (node) {
      node.x = x;
      node.y = y;
      node.vx = 0;
      node.vy = 0;
      setSimNodes([...sim]);
      kickRef.current();
    }
  };

  const onPointerUp = () => {
    draggingRef.current = null;
    kickRef.current();
  };

  /** A drag ends in a click event too — don't follow the link for those. */
  const onNodeClick = (e: React.MouseEvent) => {
    if (draggedRef.current) e.preventDefault();
    draggedRef.current = false;
  };

  /** Arrow keys move the focused node: the keyboard's version of dragging. */
  const onNodeKeyDown = (id: string, e: React.KeyboardEvent) => {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-NUDGE, 0],
      ArrowRight: [NUDGE, 0],
      ArrowUp: [0, -NUDGE],
      ArrowDown: [0, NUDGE],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const node = simRef.current.find((n) => n.id === id);
    if (!node) return;
    const { w, h } = sizeRef.current;
    node.x = Math.max(40, Math.min(w - 40, node.x + d[0]));
    node.y = Math.max(40, Math.min(h - 40, node.y + d[1]));
    node.vx = 0;
    node.vy = 0;
    setSimNodes([...simRef.current]);
    kickRef.current();
  };

  /** Everything a screen reader should hear for a node, in one label. */
  const nodeLabel = (n: SimNode) => {
    const conns: string[] = [];
    for (const e of edges) {
      if (e.source === n.id)
        conns.push(phraseOutgoing(e.type, nameById.get(e.target) ?? e.target));
      else if (e.target === n.id)
        conns.push(phraseIncoming(e.type, nameById.get(e.source) ?? e.source));
    }
    // Leads with the initials drawn on the node: a control's name has to
    // contain the text shown on it (WCAG 2.5.3), e.g. for voice control.
    const initials = monogram(n.name);
    return (
      (initials ? `${initials}: ` : "") +
      `${n.name}, ${n.domain}. ` +
      (conns.length ? `${conns.join("; ")}. ` : "") +
      "Opens in a new tab."
    );
  };

  const summary = `${nodes.length} builders, ${edges.length} connections`;

  return (
    <div className="network-graph-wrap" ref={containerRef}>
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="network-graph-svg"
        role="group"
        aria-label={`Ottawa builder network: ${summary}. Each node is a link to that builder's site; arrow keys move the focused node.`}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          {EDGE_TYPES.map((t) => (
            <marker
              key={t}
              id={`arrow-${t}`}
              viewBox="0 -4 8 8"
              refX="6"
              refY="0"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,-4 L8,0 L0,4" fill={EDGE_STYLE[t].color} />
            </marker>
          ))}
        </defs>

        {edges.map((e) => {
          const from = simNodes.find((n) => n.id === e.source);
          const to = simNodes.find((n) => n.id === e.target);
          if (!from || !to) return null;
          const key = `${e.source}->${e.target}`;
          const active = incidentEdges.has(key);
          const dimmed = activeId != null && !active;
          const rFrom = nodeRadius(from.degree);
          const rTo = nodeRadius(to.degree);
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.hypot(dx, dy) || 1;
          const x1 = from.x + (dx / dist) * rFrom;
          const y1 = from.y + (dy / dist) * rFrom;
          const x2 = to.x - (dx / dist) * (rTo + 6);
          const y2 = to.y - (dy / dist) * (rTo + 6);
          return (
            <line
              key={key}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={EDGE_STYLE[e.type].color}
              strokeDasharray={EDGE_STYLE[e.type].dash}
              className={`ng-edge${active ? " ng-edge-active" : ""}${
                dimmed ? " ng-edge-dim" : ""
              }`}
              markerEnd={`url(#arrow-${e.type})`}
            />
          );
        })}

        {simNodes.map((n) => {
          const r = nodeRadius(n.degree);
          const active = n.id === activeId;
          return (
            <a
              key={n.id}
              href={n.website}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className={`ng-node${active ? " ng-node-active" : ""}`}
              transform={`translate(${n.x}, ${n.y})`}
              onPointerDown={(e) => onPointerDown(n.id, e)}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setFocusedId(n.id)}
              onBlur={() => setFocusedId(null)}
              onClick={onNodeClick}
              onDragStart={(e) => e.preventDefault()}
              onKeyDown={(e) => onNodeKeyDown(n.id, e)}
              aria-label={nodeLabel(n)}
            >
              {/* Invisible, but keeps every node a 44px target. */}
              <circle className="ng-hit" r={Math.max(r + 6, MIN_HIT_RADIUS)} />
              <circle className="ng-halo" r={r + 6} />
              <circle className="ng-dot" r={r} fill={swatchFor(n.name)} />
              <text className="ng-label" y={1} aria-hidden="true">
                {monogram(n.name) || "·"}
              </text>
            </a>
          );
        })}
      </svg>

      {/* A visual echo of the hovered / focused node. Screen readers get the
          same facts from each node's own label, so this stays out of their way. */}
      <div className="ng-panel" aria-hidden="true">
        {activeNode ? (
          <>
            <span className="ng-panel-name">{activeNode.name}</span>
            <span className="ng-panel-domain">{activeNode.domain}</span>
            {activeNode.role && (
              <span className="ng-panel-role">{activeNode.role}</span>
            )}
            {activeNode.tags && activeNode.tags.length > 0 && (
              <span className="ng-panel-tags">
                {activeNode.tags.slice(0, 4).join(" · ")}
              </span>
            )}
            {activeConnections.length > 0 && (
              <ul className="ng-panel-conns">
                {activeConnections.map((c) => (
                  <li key={c.key}>
                    <span
                      className="ng-conn-dot"
                      style={{ background: EDGE_STYLE[c.type].color }}
                      aria-hidden="true"
                    />
                    {c.text}
                  </li>
                ))}
              </ul>
            )}
            <span className="ng-panel-hint">Select to visit site</span>
          </>
        ) : (
          <>
            <span className="ng-panel-name">Builder network</span>
            <span className="ng-panel-role">{summary}</span>
            <span className="ng-panel-hint">
              Hover or focus a node to explore
            </span>
          </>
        )}
      </div>

      {presentTypes.length > 0 && (
        <div className="ng-legend" aria-hidden="true">
          {presentTypes.map((t) => (
            <span key={t} className="ng-legend-item">
              <svg className="ng-legend-line" viewBox="0 0 26 6">
                <line
                  x1="1"
                  y1="3"
                  x2="25"
                  y2="3"
                  stroke={EDGE_STYLE[t].color}
                  strokeDasharray={EDGE_STYLE[t].dash}
                />
              </svg>
              {EDGE_STYLE[t].label}
            </span>
          ))}
        </div>
      )}

      <style>{`
        .network-graph-wrap {
          position: relative;
          width: 100%;
          height: min(72vh, 560px);
          height: min(72svh, 560px);
          min-height: 360px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .network-graph-svg {
          display: block;
          width: 100%;
          height: 100%;
          /* Swiping the empty canvas scrolls the page; only a node itself
             captures the gesture (for dragging). */
          touch-action: pan-y;
        }
        .ng-edge {
          stroke-width: 1.4;
          opacity: 0.85;
          transition:
            opacity 0.15s var(--ease),
            stroke-width 0.15s var(--ease);
        }
        .ng-edge-active {
          stroke-width: 2;
          opacity: 1;
        }
        .ng-edge-dim {
          opacity: 0.14;
        }
        .ng-node {
          cursor: grab;
          outline: none;
          touch-action: none;
        }
        .ng-node:active {
          cursor: grabbing;
        }
        .ng-hit {
          fill: transparent;
        }
        .ng-node:focus-visible .ng-halo {
          stroke: var(--accent);
          stroke-width: 2;
        }
        .ng-halo {
          fill: none;
          stroke: transparent;
          stroke-width: 2;
          transition: stroke 0.15s var(--ease);
        }
        .ng-node-active .ng-halo,
        .ng-node:hover .ng-halo {
          stroke: var(--border-strong);
        }
        .ng-dot {
          stroke: var(--border-strong);
          stroke-width: 1.5;
          transition: stroke 0.15s var(--ease);
        }
        .ng-node-active .ng-dot,
        .ng-node:hover .ng-dot {
          stroke: var(--text-muted);
        }
        .ng-label {
          fill: var(--text);
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          text-anchor: middle;
          dominant-baseline: central;
          pointer-events: none;
          user-select: none;
        }
        .ng-panel {
          position: absolute;
          left: 1rem;
          bottom: 1rem;
          max-width: min(280px, calc(100% - 2rem));
          padding: 0.85rem 1rem;
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          pointer-events: none;
        }
        .ng-panel-name {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text);
        }
        .ng-panel-domain {
          font-family: var(--font-mono);
          font-size: 0.78rem;
          color: var(--text-muted);
        }
        .ng-panel-role,
        .ng-panel-tags {
          font-size: 0.82rem;
          color: var(--text-subtle);
        }
        .ng-panel-conns {
          list-style: none;
          margin: 0.35rem 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .ng-panel-conns li {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.82rem;
          color: var(--text-muted);
        }
        .ng-conn-dot {
          flex-shrink: 0;
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .ng-panel-hint {
          margin-top: 0.25rem;
          font-size: 0.72rem;
          color: var(--text-subtle);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ng-legend {
          position: absolute;
          right: 1rem;
          top: 1rem;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.35rem 0.75rem;
          max-width: min(320px, calc(100% - 2rem));
          padding: 0.55rem 0.75rem;
          background: color-mix(in srgb, var(--bg) 88%, transparent);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          pointer-events: none;
        }
        .ng-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.74rem;
          color: var(--text-muted);
        }
        .ng-legend-line {
          width: 26px;
          height: 6px;
          stroke-width: 2;
        }
      `}</style>
    </div>
  );
}
