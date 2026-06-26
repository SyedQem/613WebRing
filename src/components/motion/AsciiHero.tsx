import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AsciiEngine } from "./asciiEngine";
import { getLogoMask } from "../../lib/ascii-mask";

/**
 * The hero centerpiece — the BCO mark rendered as a living field of `0`/`1`
 * that reacts to the pointer. Fades/scales in on mount via Motion.
 */
export default function AsciiHero() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const engine = new AsciiEngine({
      canvas,
      cell: 9,
      chars: "01",
      color: "224,226,235",
      baseAlpha: 0.07,
      maskAlpha: 0.95,
      density: 0.32,
      maskCover: 0.98,
      getMask: (size) => getLogoMask(size, size),
      interactive: true,
      reactToScroll: true,
      fps: 30,
      speed: 1,
      reducedMotion: !!reduced,
    });
    engine.start();
    return () => engine.destroy();
  }, [reduced]);

  return (
    <motion.div
      className="ascii-hero"
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
    >
      <div className="ascii-hero-glow" aria-hidden="true" />
      <canvas ref={ref} className="ascii-hero-canvas" aria-hidden="true" />
    </motion.div>
  );
}
