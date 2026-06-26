import { useEffect, useRef } from "react";

/**
 * A slowly rotating ring of `0 1 3 6` glyphs with `613` held in the centre —
 * the manifesto scene's visual metaphor for the webring. Self-contained canvas.
 */
export default function AsciiRing({ label = "613" }: { label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const glyphs = "0136";
    const outerCount = 40;
    const innerCount = 26;
    let size = 0;
    let raf = 0;
    let running = true;

    const layout = () => {
      const r = canvas.getBoundingClientRect();
      size = Math.min(r.width, r.height);
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ring = (
      t: number,
      count: number,
      radius: number,
      dir: number,
      cx: number,
      cy: number,
      fontSize: number,
    ) => {
      ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2 + t * 0.12 * dir;
        const x = cx + Math.cos(a) * radius;
        const y = cy + Math.sin(a) * radius;
        const shimmer = 0.45 + 0.55 * Math.sin(t * 1.4 + k * 0.6);
        ctx.globalAlpha = 0.18 + 0.5 * shimmer;
        ctx.fillText(glyphs[(k + Math.floor(t * 2)) % glyphs.length], x, y);
      }
    };

    const draw = (now: number) => {
      if (!running) return;
      const t = now / 1000;
      const r = canvas.getBoundingClientRect();
      const cx = r.width / 2;
      const cy = r.height / 2;
      ctx.clearRect(0, 0, r.width, r.height);
      ctx.fillStyle = "rgb(210,214,226)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ring(t, outerCount, size * 0.42, 1, cx, cy, size * 0.05);
      ring(t, innerCount, size * 0.3, -1, cx, cy, size * 0.042);

      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgb(240,242,248)";
      ctx.font = `600 ${size * 0.16}px "Space Grotesk", sans-serif`;
      ctx.fillText(label, cx, cy + size * 0.005);
      ctx.globalAlpha = 1;

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    layout();
    const onResize = () => {
      layout();
      if (reduced) draw(0);
    };
    window.addEventListener("resize", onResize);
    const onVis = () => {
      if (reduced) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    if (reduced) draw(0);
    else raf = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [label]);

  return <canvas ref={ref} className="manifesto-ring" aria-hidden="true" />;
}
