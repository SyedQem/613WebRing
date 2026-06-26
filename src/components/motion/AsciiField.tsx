import { useEffect, useRef } from "react";
import { AsciiEngine } from "./asciiEngine";
import { getLogoMask } from "../../lib/ascii-mask";

/**
 * Ambient full-viewport ASCII field — a faint, slow shimmer of `0`/`1` with the
 * BCO mark just barely present in the middle. Sits behind everything.
 */
export default function AsciiField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const small = window.matchMedia("(max-width: 640px)").matches;

    const engine = new AsciiEngine({
      canvas,
      cell: small ? 22 : 18,
      chars: "01",
      color: "160,166,180",
      baseAlpha: 0.085,
      maskAlpha: 0.22,
      density: 0.46,
      maskCover: 0.46,
      verticalBias: -0.05,
      getMask: (size) => getLogoMask(size, size),
      reactToScroll: true,
      fps: 24,
      speed: 0.8,
      reducedMotion: reduced,
    });
    engine.start();
    return () => engine.destroy();
  }, []);

  return <canvas ref={ref} className="ascii-field" aria-hidden="true" />;
}
