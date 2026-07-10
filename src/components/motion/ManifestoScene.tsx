import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from "motion/react";
import AsciiRing from "./AsciiRing";

const PHRASES = [
  "Start anywhere.",
  "Keep clicking.",
  "Tour every builder in the 613",
  "and land right back where you began.",
];

// Each phrase ("beat") owns a slice of scroll. Its words cascade in within that
// slice, then the whole beat fades out as the next one arrives — so beats reveal
// one at a time and the screen never shows all of them at once. The final beat
// stays. Timings are precomputed since the phrases are static.
const N = PHRASES.length;
const SLOT = 1 / N;
const WORDS_IN = SLOT * 0.55;

// static: SSR / pre-mount / reduced-motion — all lines fully visible.
// inview: small screens — each line fades up once as it enters the viewport.
// scrub:  desktop — scroll-linked beats inside the sticky pin.
type Mode = "static" | "inview" | "scrub";

type WordMeta = { w: string; wStart: number; wEnd: number };
type LineMeta = {
  start: number;
  inMark: number;
  outStart: number;
  outEnd: number;
  isLast: boolean;
  words: WordMeta[];
};

const LINES: LineMeta[] = PHRASES.map((phrase, k) => {
  const words = phrase.split(" ");
  const L = words.length;
  const start = k * SLOT;
  const inMark = start + 0.03;
  const outStart = (k + 1) * SLOT - 0.04;
  const outEnd = (k + 1) * SLOT + 0.02;
  return {
    start,
    inMark,
    outStart,
    outEnd,
    isLast: k === N - 1,
    words: words.map((w, j) => {
      const wStart = start + (j / L) * WORDS_IN;
      return { w, wStart, wEnd: Math.min(wStart + 0.05, outStart - 0.005) };
    }),
  };
});

function Word({
  meta,
  progress,
  mode,
}: {
  meta: WordMeta;
  progress: MotionValue<number>;
  mode: Mode;
}) {
  const opacity = useTransform(progress, [meta.wStart, meta.wEnd], [0, 1]);
  const y = useTransform(progress, [meta.wStart, meta.wEnd], [14, 0]);
  const className = meta.w.includes("613") ? "m-word m-word-hl" : "m-word";

  if (mode !== "scrub") return <span className={className}>{meta.w} </span>;
  return (
    <motion.span className={className} style={{ opacity, y }}>
      {meta.w}{" "}
    </motion.span>
  );
}

function Line({
  line,
  index,
  progress,
  mode,
}: {
  line: LineMeta;
  index: number;
  progress: MotionValue<number>;
  mode: Mode;
}) {
  // Envelope: hidden before the beat, present during it, gone once the next
  // beat takes over (the last beat holds at full opacity to the end).
  const xs = line.isLast
    ? [line.start, line.inMark]
    : [line.start, line.inMark, line.outStart, line.outEnd];
  const ys = line.isLast ? [0, 1] : [0, 1, 1, 0];
  const scrubOpacity = useTransform(progress, xs, ys);

  const inner = line.words.map((meta, j) => (
    <Word key={j} meta={meta} progress={progress} mode={mode} />
  ));

  if (mode === "scrub") {
    return (
      <motion.span className="m-line" style={{ opacity: scrubOpacity }}>
        {inner}
      </motion.span>
    );
  }
  if (mode === "inview") {
    return (
      <motion.span
        className="m-line"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{
          duration: 0.6,
          ease: [0.22, 0.61, 0.36, 1],
          delay: index * 0.08,
        }}
      >
        {inner}
      </motion.span>
    );
  }
  return <span className="m-line">{inner}</span>;
}

/**
 * "How the ring works" — a pinned scene (CSS sticky) that reveals the statement
 * one beat at a time as you scroll (each fades out as the next arrives), beside a
 * rotating ASCII ring. On small screens it unpins: every line sits in normal flow
 * and fades up once as it scrolls into view, then stays visible. Reduced-motion
 * users get the whole statement fully visible with no animation.
 */
export default function ManifestoScene() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [compact, setCompact] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Pin progress (0 → section top hits viewport top, 1 → section bottom hits
  // viewport bottom), computed from live geometry on every scroll/resize.
  // Deliberately not useScroll({ target }): its cached offset resolution goes
  // non-monotonic over a sticky-pinned target in Chromium, which made the last
  // beat fade back out before the pin released.
  const scrollYProgress = useMotionValue(0);
  useEffect(() => {
    if (!mounted) return;
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      const p = range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 1;
      scrollYProgress.set(p);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mounted, scrollYProgress]);

  // Render plain (full-opacity) until mounted so SSR / no-JS stays readable.
  const mode: Mode =
    !mounted || reduced ? "static" : compact ? "inview" : "scrub";

  return (
    <section ref={ref} id="manifesto" className="manifesto" data-section-glow>
      <div className="manifesto-sticky">
        <div className="container manifesto-grid">
          <div className="manifesto-visual">
            <AsciiRing label="613" />
          </div>
          <div className="manifesto-copy">
            <p className="eyebrow">How the ring works</p>
            <h2 className="manifesto-statement">
              {LINES.map((line, li) => (
                <Line
                  key={li}
                  line={line}
                  index={li}
                  progress={scrollYProgress}
                  mode={mode}
                />
              ))}
            </h2>
          </div>
        </div>
      </div>
    </section>
  );
}
