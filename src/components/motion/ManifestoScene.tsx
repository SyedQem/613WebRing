import { useEffect, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import AsciiRing from "./AsciiRing";

const PHRASES = [
  "Start anywhere.",
  "Keep clicking.",
  "Tour every builder in the 613 —",
  "and land right back where you began.",
];

// Each phrase ("beat") owns a slice of scroll. Its words cascade in within that
// slice, then the whole beat fades out as the next one arrives — so beats reveal
// one at a time and the screen never shows all of them at once. The final beat
// stays. Timings are precomputed since the phrases are static.
const N = PHRASES.length;
const SLOT = 1 / N;
const WORDS_IN = SLOT * 0.55;

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
  scrub,
}: {
  meta: WordMeta;
  progress: MotionValue<number>;
  scrub: boolean;
}) {
  const opacity = useTransform(progress, [meta.wStart, meta.wEnd], [0, 1]);
  const y = useTransform(progress, [meta.wStart, meta.wEnd], [14, 0]);
  const className = meta.w.includes("613") ? "m-word m-word-hl" : "m-word";

  if (!scrub) return <span className={className}>{meta.w} </span>;
  return (
    <motion.span className={className} style={{ opacity, y }}>
      {meta.w}{" "}
    </motion.span>
  );
}

function Line({
  line,
  progress,
  scrub,
}: {
  line: LineMeta;
  progress: MotionValue<number>;
  scrub: boolean;
}) {
  // Envelope: hidden before the beat, present during it, gone once the next
  // beat takes over (the last beat holds at full opacity to the end).
  const xs = line.isLast
    ? [line.start, line.inMark]
    : [line.start, line.inMark, line.outStart, line.outEnd];
  const ys = line.isLast ? [0, 1] : [0, 1, 1, 0];
  const opacity = useTransform(progress, xs, ys);

  const inner = line.words.map((meta, j) => (
    <Word key={j} meta={meta} progress={progress} scrub={scrub} />
  ));

  if (!scrub) return <span className="m-line">{inner}</span>;
  return (
    <motion.span className="m-line" style={{ opacity }}>
      {inner}
    </motion.span>
  );
}

function WidgetStep({
  label,
  range,
  progress,
  scrub,
}: {
  label: string;
  range: [number, number, number, number];
  progress: MotionValue<number>;
  scrub: boolean;
}) {
  const opacity = useTransform(progress, range, [0.4, 1, 1, 0.4]);
  if (!scrub) return <span>{label}</span>;
  return <motion.span style={{ opacity }}>{label}</motion.span>;
}

/**
 * "How the ring works" — a pinned scene (CSS sticky) that reveals the statement
 * one beat at a time as you scroll (each fades out as the next arrives), beside a
 * rotating ASCII ring. On small screens it unpins and reads as a normal section.
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

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  // Render plain (full-opacity) until mounted so SSR / no-JS stays readable.
  const scrub = mounted && !reduced && !compact;

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
                  progress={scrollYProgress}
                  scrub={scrub}
                />
              ))}
            </h2>
            <div className="manifesto-widget" aria-hidden="true">
              <WidgetStep
                label="← prev"
                range={[0.18, 0.28, 0.46, 0.56]}
                progress={scrollYProgress}
                scrub={scrub}
              />
              <WidgetStep
                label="613"
                range={[0.42, 0.52, 0.7, 0.8]}
                progress={scrollYProgress}
                scrub={scrub}
              />
              <WidgetStep
                label="next →"
                range={[0.66, 0.76, 0.94, 1]}
                progress={scrollYProgress}
                scrub={scrub}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
