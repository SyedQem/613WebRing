/**
 * AsciiEngine — a small, framework-agnostic renderer that paints a shimmering
 * field of `0`/`1` glyphs onto a <canvas>, optionally shaped by a logo / ring
 * mask. Used by AsciiField (ambient background), AsciiHero (the centerpiece)
 * and the boot loader.
 *
 * It owns its own sizing (ResizeObserver), animation loop (rAF with an fps
 * cap), tab-visibility pausing and an optional pointer ripple. Scroll reactivity
 * reads `window.lenis.velocity` when present.
 */
import type { Mask } from "../../lib/ascii-mask";

export type AsciiOptions = {
  canvas: HTMLCanvasElement;
  /** CSS px per glyph cell. */
  cell?: number;
  chars?: string;
  /** Base glyph colour as "r,g,b" (alpha applied per cell at draw time). */
  color?: string;
  /** Alpha for ambient (non-mask) glyphs. */
  baseAlpha?: number;
  /** Peak alpha for solid mask glyphs. */
  maskAlpha?: number;
  /** Fraction of ambient cells that are lit (0..1). */
  density?: number;
  /** Fraction of min(cols,rows) the mask box occupies. */
  maskCover?: number;
  /** Vertical placement bias for the mask (-0.5..0.5, negative = up). */
  verticalBias?: number;
  /** Provide a mask sized to the requested grid (square box). */
  getMask?: (size: number) => Promise<Mask> | Mask | null;
  reactToScroll?: boolean;
  interactive?: boolean;
  fps?: number;
  speed?: number;
  reducedMotion?: boolean;
};

type Lenis = { velocity?: number };

export class AsciiEngine {
  private o: Required<
    Omit<AsciiOptions, "getMask" | "canvas">
  > & { getMask?: AsciiOptions["getMask"]; canvas: HTMLCanvasElement };
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cols = 0;
  private rows = 0;
  private cssW = 0;
  private cssH = 0;
  private seeds = new Float32Array(0);
  private mask: Mask | null = null;
  private maskOffX = 0;
  private maskOffY = 0;
  private maskSize = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  private mouse = { x: -1, y: -1, on: false };
  private ro?: ResizeObserver;

  constructor(opts: AsciiOptions) {
    this.o = {
      cell: 16,
      chars: "01",
      color: "180,184,196",
      baseAlpha: 0.08,
      maskAlpha: 0.6,
      density: 0.4,
      maskCover: 0.55,
      verticalBias: 0,
      reactToScroll: false,
      interactive: false,
      fps: 30,
      speed: 1,
      reducedMotion: false,
      ...opts,
    } as AsciiEngine["o"];
    const ctx = opts.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
  }

  start() {
    this.resize();
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(this.o.canvas);
    document.addEventListener("visibilitychange", this.onVisibility);
    if (this.o.interactive) {
      this.o.canvas.addEventListener("pointermove", this.onPointerMove);
      this.o.canvas.addEventListener("pointerleave", this.onPointerLeave);
    }
    if (this.o.reducedMotion) {
      this.draw(0);
      return;
    }
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.o.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.o.canvas.removeEventListener("pointerleave", this.onPointerLeave);
  }

  private onVisibility() {
    if (this.o.reducedMotion) return;
    if (document.hidden) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    } else if (!this.running) {
      this.running = true;
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  private onPointerMove(e: PointerEvent) {
    const r = this.o.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, on: true };
  }
  private onPointerLeave() {
    this.mouse.on = false;
  }

  private async resize() {
    const r = this.o.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.cssW = r.width;
    this.cssH = r.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.o.canvas.width = Math.floor(r.width * this.dpr);
    this.o.canvas.height = Math.floor(r.height * this.dpr);
    this.cols = Math.max(1, Math.floor(r.width / this.o.cell));
    this.rows = Math.max(1, Math.floor(r.height / this.o.cell));

    this.seeds = new Float32Array(this.cols * this.rows);
    for (let i = 0; i < this.seeds.length; i++) this.seeds[i] = Math.random();

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.font = `${this.o.cell * 0.92}px ui-monospace, "JetBrains Mono", "Cascadia Code", monospace`;
    this.ctx.textBaseline = "top";

    if (this.o.getMask) {
      const size = Math.max(
        1,
        Math.round(Math.min(this.cols, this.rows) * this.o.maskCover),
      );
      this.maskSize = size;
      this.maskOffX = Math.floor((this.cols - size) / 2);
      this.maskOffY = Math.floor(
        (this.rows - size) / 2 + this.rows * this.o.verticalBias,
      );
      this.mask = await this.o.getMask(size);
    }

    if (this.o.reducedMotion) this.draw(0);
  }

  private maskAt(col: number, row: number): number {
    if (!this.mask) return 0;
    const mx = col - this.maskOffX;
    const my = row - this.maskOffY;
    if (mx < 0 || my < 0 || mx >= this.maskSize || my >= this.maskSize) return 0;
    return this.mask.data[my * this.maskSize + mx];
  }

  private frame(now: number) {
    if (!this.running) return;
    const interval = 1000 / this.o.fps;
    if (now - this.last >= interval) {
      this.last = now - ((now - this.last) % interval);
      this.draw(now / 1000);
    }
    this.raf = requestAnimationFrame(this.frame);
  }

  private draw(t: number) {
    const { ctx, cols, rows, seeds, o } = this;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.fillStyle = `rgb(${o.color})`;

    const lenis = (window as unknown as { lenis?: Lenis }).lenis;
    const v = o.reactToScroll && lenis?.velocity ? Math.abs(lenis.velocity) : 0;
    const boost = Math.min(v / 24, 3.2);
    const speed = o.speed * (1 + boost * 0.8);
    const rippleR = 5;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const seed = seeds[i];
        const m = this.maskAt(col, row);

        let a: number;
        if (m > 0.03) {
          a = o.baseAlpha + (o.maskAlpha - o.baseAlpha) * m;
          // shimmer + leading-edge sparkle keep the logo "alive"
          a *= 0.7 + 0.3 * Math.sin(t * 1.6 * speed + seed * 6.283 + col * 0.18);
        } else {
          // sparse ambient cells, stably chosen via the seed
          const lit = ((seed * 41.27) % 1) < o.density;
          if (!lit) continue;
          a =
            o.baseAlpha *
            (0.35 + 0.65 * Math.sin(t * 0.9 * speed + seed * 30 + row * 0.12));
          if (a <= 0.012) continue;
        }

        if (boost > 0) {
          // Brighten slightly and let a few cells twinkle while scrolling.
          a *= 1 + boost * 0.3;
          const sparkle = Math.sin(t * 9 + seed * 220);
          if (sparkle > 0.8) a += boost * 0.5 * ((sparkle - 0.8) / 0.2);
        }

        if (o.interactive && this.mouse.on) {
          const dx = col - this.mouse.x / o.cell;
          const dy = row - this.mouse.y / o.cell;
          const d = Math.hypot(dx, dy);
          if (d < rippleR) a += (1 - d / rippleR) * 0.5;
        }

        if (a <= 0.012) continue;
        ctx.globalAlpha = Math.min(1, a);
        // 0/1 flips per cell over time (and snap to '1' inside the dense logo)
        const flip = Math.sin(t * speed * (0.6 + seed) + seed * 100) > 0 ? 1 : 0;
        const ch = m > 0.6 ? "1" : o.chars[flip % o.chars.length];
        ctx.fillText(ch, col * o.cell, row * o.cell);
      }
    }
    ctx.globalAlpha = 1;
  }
}
