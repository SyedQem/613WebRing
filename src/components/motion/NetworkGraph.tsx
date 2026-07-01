import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EdgeType, NetworkEdge, NetworkNode } from "../../lib/members";

const PALETTE = [
  "#1c1c1c",
  "#2a2a2a",
  "#383838",
  "#4a4a4a",
  "#5c5c5c",
  "#707070",
];

/** Edge colour + legend label per relationship type. */
const EDGE_STYLE: Record<EdgeType, { color: string; label: string }> = {
  referred: { color: "var(--rel-referred)", label: "Referred" },
  collaborator: { color: "var(--rel-collaborator)", label: "Collaborator" },
  mentor: { color: "var(--rel-mentor)", label: "Mentor" },
  friend: { color: "var(--rel-friend)", label: "Friend" },
  connection: { color: "var(--node-line)", label: "Connection" },
};

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

export default function NetworkGraph({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const simRef = useRef<SimNode[]>([]);
  const rafRef = useRef<number>(0);

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
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cx = size.w / 2;
    const cy = size.h / 2;
    const spread = Math.min(size.w, size.h) * 0.32;
    const initial: SimNode[] = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      return {
        ...n,
        x: cx + spread * Math.cos(angle),
        y: cy + spread * Math.sin(angle),
        vx: 0,
        vy: 0,
        degree: degreeMap.get(n.id) ?? 0,
      };
    });
    simRef.current = initial;
    setSimNodes(initial);
  }, [nodes, edges, size.w, size.h, degreeMap]);

  useEffect(() => {
    const cx = size.w / 2;
    const cy = size.h / 2;

    const tick = () => {
      const sim = simRef.current;
      const dragId = draggingRef.current;

      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const a = sim[i];
          const b = sim[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 1;
          const minDist = nodeRadius(a.degree) + nodeRadius(b.degree) + 24;
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

      for (const edge of edges) {
        const a = sim.find((n) => n.id === edge.source);
        const b = sim.find((n) => n.id === edge.target);
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy) || 1;
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

      for (const n of sim) {
        if (n.id === dragId) continue;
        n.vx += (cx - n.x) * 0.002;
        n.vy += (cy - n.y) * 0.002;
        n.vx *= 0.82;
        n.vy *= 0.82;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(40, Math.min(size.w - 40, n.x));
        n.y = Math.max(40, Math.min(size.h - 40, n.y));
      }

      setSimNodes([...sim]);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [edges, size.w, size.h]);

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
    setFocusedId(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const id = draggingRef.current;
    if (!id) return;
    const { x, y } = getPointerPos(e.clientX, e.clientY);
    const sim = simRef.current;
    const node = sim.find((n) => n.id === id);
    if (node) {
      node.x = x;
      node.y = y;
      node.vx = 0;
      node.vy = 0;
      setSimNodes([...sim]);
    }
  };

  const onPointerUp = () => {
    draggingRef.current = null;
  };

  const openWebsite = (node: SimNode) => {
    window.open(node.website, "_blank", "noopener,noreferrer");
  };

  const summary = `${nodes.length} builders, ${edges.length} connections`;

  return (
    <div className="network-graph-wrap" ref={containerRef}>
      <svg
        viewBox={`0 0 ${size.w} ${size.h}`}
        className="network-graph-svg"
        role="img"
        aria-label={`Ottawa builder network: ${summary}`}
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
            <g
              key={n.id}
              className={`ng-node${active ? " ng-node-active" : ""}`}
              transform={`translate(${n.x}, ${n.y})`}
              onPointerDown={(e) => onPointerDown(n.id, e)}
              onMouseEnter={() => setHoveredId(n.id)}
              onMouseLeave={() => setHoveredId(null)}
              onFocus={() => setFocusedId(n.id)}
              onBlur={() => setFocusedId(null)}
              onClick={() => openWebsite(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openWebsite(n);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${n.name}, ${n.domain}`}
            >
              <circle className="ng-halo" r={r + 6} />
              <circle className="ng-dot" r={r} fill={swatchFor(n.name)} />
              <text className="ng-label" y={1}>
                {monogram(n.name) || "·"}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="ng-panel" aria-live="polite">
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
            <span className="ng-panel-hint">Click to visit site</span>
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
              <span
                className="ng-legend-dot"
                style={{ background: EDGE_STYLE[t].color }}
              />
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
          touch-action: none;
          cursor: grab;
        }
        .network-graph-svg:active {
          cursor: grabbing;
        }
        .ng-edge {
          stroke-width: 1.2;
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
          cursor: pointer;
          outline: none;
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
        .ng-legend-dot {
          width: 9px;
          height: 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
