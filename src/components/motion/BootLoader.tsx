import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { getLogoMask } from "../../lib/ascii-mask";

const KEY = "613:booted";
const DURATION = 1900;
const HOLD = 500;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * First-load boot sequence: a screen of random `0`/`1` that decodes into the
 * BCO mark, with staggered boot lines. Shows once per session (gated by the
 * inline head script via the `booting` class), then fades out and hands scroll
 * back to Lenis through a `boot:done` event.
 */
export default function BootLoader() {
  const [show, setShow] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progress = useMotionValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (document.documentElement.classList.contains("booting")) setShow(true);
  }, []);

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* private mode — boot will simply replay next load */
    }
    document.documentElement.classList.remove("booting");
    window.dispatchEvent(new Event("boot:done"));
    setShow(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    if (reduced) {
      const t = window.setTimeout(finish, 300);
      return () => window.clearTimeout(t);
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      const t = window.setTimeout(finish, 600);
      return () => window.clearTimeout(t);
    }

    let raf = 0;
    let disposed = false;
    const cell = 13;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let cols = 0;
    let rows = 0;
    let seeds = new Float32Array(0);
    let thresholds = new Float32Array(0);
    let mask: Awaited<ReturnType<typeof getLogoMask>> | null = null;
    let maskSize = 0;
    let offX = 0;
    let offY = 0;
    let w = 0;
    let h = 0;

    const layout = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      cols = Math.ceil(w / cell);
      rows = Math.ceil(h / cell);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${cell * 0.92}px ui-monospace, "JetBrains Mono", monospace`;
      ctx.textBaseline = "top";
      seeds = new Float32Array(cols * rows);
      thresholds = new Float32Array(cols * rows);
      const cx = cols / 2;
      const cy = rows / 2;
      const maxd = Math.hypot(cx, cy) || 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          seeds[i] = Math.random();
          const d = Math.hypot(c - cx, r - cy) / maxd;
          thresholds[i] = d * 0.7 + Math.random() * 0.3;
        }
      }
      maskSize = Math.round(Math.min(cols, rows) * 0.5);
      offX = Math.floor((cols - maskSize) / 2);
      // Bias the decoded mark up so the boot lines get a clear band below it.
      offY = Math.floor((rows - maskSize) / 2 - rows * 0.1);
    };

    const maskAt = (c: number, r: number) => {
      if (!mask) return 0;
      const mx = c - offX;
      const my = r - offY;
      if (mx < 0 || my < 0 || mx >= maskSize || my >= maskSize) return 0;
      return mask.data[my * maskSize + mx];
    };

    const start = performance.now();
    const draw = (now: number) => {
      if (disposed) return;
      const p = Math.min((now - start) / DURATION, 1);
      const ep = easeOutCubic(p);
      progress.set(ep);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgb(226,228,236)";

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const seed = seeds[i];
          const m = maskAt(c, r);
          const resolved = ep >= thresholds[i];
          let a: number;
          let ch: string;
          if (!resolved) {
            a = 0.14 * (0.5 + 0.5 * Math.sin(now / 110 + seed * 30));
            ch = Math.sin(now / 90 + seed * 50) > 0 ? "1" : "0";
          } else if (m > 0.04) {
            a = 0.25 + 0.75 * m;
            ch = m > 0.6 ? "1" : seed > 0.5 ? "1" : "0";
          } else {
            a = 0.13 * (1 - ep) * ((seed * 53.3) % 1 < 0.5 ? 1 : 0);
            if (a <= 0.01) continue;
            ch = seed > 0.5 ? "1" : "0";
          }
          ctx.globalAlpha = Math.min(1, a);
          ctx.fillText(ch, c * cell, r * cell);
        }
      }
      ctx.globalAlpha = 1;

      if (now - start < DURATION + HOLD) raf = requestAnimationFrame(draw);
      else finish();
    };

    layout();
    const onResize = () => layout();
    window.addEventListener("resize", onResize);

    getLogoMask(maskSize, maskSize)
      .then((m) => {
        mask = m;
      })
      .catch(() => {
        /* fall through — sequence still completes on the timer */
      })
      .finally(() => {
        if (!disposed) raf = requestAnimationFrame(draw);
      });

    const skipTimer = window.setTimeout(() => setCanSkip(true), 650);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(skipTimer);
    };
  }, [show, reduced, finish, progress]);

  const onOverlayClick = () => {
    if (canSkip) finish();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="boot"
          onClick={onOverlayClick}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(12px)" }}
          transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
          role="presentation"
        >
          <canvas ref={canvasRef} className="boot-canvas" aria-hidden="true" />
          <motion.div
            className="boot-meta"
            initial="hidden"
            animate="show"
            variants={{
              show: {
                transition: { staggerChildren: 0.12, delayChildren: 0.25 },
              },
            }}
          >
            <motion.p
              className="boot-title"
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
            >
              613&nbsp;/&nbsp;WEBRING
            </motion.p>
            <motion.p
              className="boot-sub"
              variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 },
              }}
            >
              Builders Collective Ottawa
            </motion.p>
            <div className="boot-bar" aria-hidden="true">
              <motion.span
                className="boot-bar-fill"
                style={{ scaleX: progress }}
              />
            </div>
            <p className="boot-hint">
              {canSkip ? "Click anywhere to enter" : "Initializing ring…"}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
