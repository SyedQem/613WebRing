/**
 * Motion engine — Lenis smooth scroll + GSAP ScrollTrigger.
 *
 * This is the single, attribute-driven animation layer for the site. Components
 * stay declarative: they only add data-attributes, no per-component motion JS.
 *
 *   data-reveal              → rise + fade into view on enter (bigger move)
 *   data-reveal="fade"       → fade only (no translate)
 *   data-reveal-stagger      → container whose direct children stagger in
 *   data-mask                → clip-path wipe reveal (dramatic, frame-safe)
 *   data-parallax="0.4"      → drift on scroll (value = strength)
 *   data-skew                → skew/stretch driven by scroll velocity
 *   data-manifesto           → pinned, scrubbed word-by-word statement
 *   data-reel + data-reel-track → pinned horizontal scroll section
 *
 * Fail-safe by design: the `.motion` class is added to <html> before paint by
 * a tiny inline script in BaseLayout, and ONLY when motion is allowed. The
 * CSS reveal base states (opacity:0 / clip) are gated on that class, so with JS
 * off or `prefers-reduced-motion`, everything renders visible. If anything below
 * throws, we strip `.motion` to guarantee content is shown.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

function reveal() {
  // Single-element reveals, batched so they share one observer and stagger
  // nicely when several enter together. Bigger rise than before for weight.
  ScrollTrigger.batch("[data-reveal]", {
    start: "top 90%",
    onEnter: (els) =>
      gsap.to(els, {
        opacity: 1,
        y: 0,
        duration: 1.0,
        ease: "power3.out",
        stagger: 0.1,
        overwrite: true,
      }),
  });

  // Clip-path wipe reveals — the dramatic "big change" entrance. Because the
  // wipe is a clip-path on the element's own box (not a text-shadow), nothing
  // bleeds outside its frame.
  ScrollTrigger.batch("[data-mask]", {
    start: "top 88%",
    onEnter: (els) =>
      gsap.to(els, {
        opacity: 1,
        y: 0,
        clipPath: "inset(0% 0% 0% 0%)",
        duration: 1.1,
        ease: "power4.out",
        stagger: 0.12,
        overwrite: true,
      }),
  });

  // Container-level staggered reveals (cards, lists, step grids…).
  gsap.utils.toArray<HTMLElement>("[data-reveal-stagger]").forEach((box) => {
    ScrollTrigger.create({
      trigger: box,
      start: "top 88%",
      once: true,
      onEnter: () =>
        gsap.to(Array.from(box.children), {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: true,
        }),
    });
  });
}

function parallax() {
  gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((el) => {
    const strength = parseFloat(el.dataset.parallax || "0.3");
    const amp = strength * 160;
    gsap.fromTo(
      el,
      { y: amp },
      {
        y: -amp,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
  });
}

/**
 * Scroll-velocity skew. Big, physical motion: type and cards lean into the
 * direction of travel and snap back at rest. Driven by Lenis velocity, applied
 * through quickTo setters so it stays buttery under rapid input.
 */
function velocitySkew(lenis: Lenis) {
  const els = gsap.utils.toArray<HTMLElement>("[data-skew]");
  if (!els.length) return;

  const setters = els.map((el) =>
    gsap.quickTo(el, "skewY", { duration: 0.5, ease: "power3" }),
  );
  const clamp = gsap.utils.clamp(-7, 7);

  lenis.on("scroll", () => {
    // Lenis exposes a signed px/frame velocity; scale to a gentle skew.
    const skew = clamp(lenis.velocity * 0.35);
    for (const set of setters) set(skew);
  });
}

/**
 * Pinned word-by-word statement, scrubbed. Each word lifts and brightens from
 * a dim ghost to full white as you scrub past — a long, deliberate beat.
 */
function manifesto() {
  const block = document.querySelector<HTMLElement>("[data-manifesto]");
  if (!block) return;
  const words = block.querySelectorAll<HTMLElement>(".m-word");
  if (!words.length) return;

  gsap.to(words, {
    opacity: 1,
    y: 0,
    ease: "none",
    stagger: 0.5,
    scrollTrigger: {
      trigger: block,
      start: "top top",
      end: "+=180%",
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
    },
  });
}

/**
 * Pinned horizontal scroll. The section pins and its track translates sideways
 * as you scroll vertically — a big directional change. Desktop + motion only;
 * on narrow screens (or reduced motion, where initMotion never runs) the track
 * is a native horizontal swipe strip via CSS `overflow-x:auto`.
 */
function reel() {
  const section = document.querySelector<HTMLElement>("[data-reel]");
  const track = section?.querySelector<HTMLElement>("[data-reel-track]");
  const viewport = section?.querySelector<HTMLElement>("[data-reel-viewport]");
  if (!section || !track || !viewport) return;

  const mm = gsap.matchMedia();
  mm.add("(min-width: 901px)", () => {
    // Take over scrolling from the native overflow so GSAP fully owns the x.
    viewport.style.overflow = "hidden";

    const distance = () =>
      Math.max(0, track.scrollWidth - viewport.clientWidth);

    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => "+=" + distance(),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    // Restore native scroll if the viewport shrinks back to mobile.
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(track, { x: 0 });
      viewport.style.overflow = "";
    };
  });
}

function anchorScroll(lenis: Lenis) {
  document.querySelectorAll<HTMLAnchorElement>('a[href*="#"]').forEach((a) => {
    const url = new URL(a.href, location.href);
    // Only intercept in-page anchors on the current document.
    if (url.pathname !== location.pathname || !url.hash) return;
    a.addEventListener("click", (e) => {
      const target = document.querySelector(url.hash);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -88 });
      history.pushState(null, "", url.hash);
    });
  });
}

export function initMotion() {
  // Absent class ⇒ reduced-motion or JS-gated off ⇒ leave everything visible.
  if (!document.documentElement.classList.contains("motion")) return;

  try {
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      smoothWheel: true,
    });
    // Expose for any component that wants programmatic scrolling or velocity
    // (the matrix-rain backdrop reads lenis.velocity each frame).
    (window as unknown as { lenis?: Lenis }).lenis = lenis;

    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    reveal();
    parallax();
    velocitySkew(lenis);
    manifesto();
    reel();
    anchorScroll(lenis);

    // Re-measure once fonts/images settle.
    ScrollTrigger.refresh();
    window.addEventListener("load", () => ScrollTrigger.refresh());
  } catch (err) {
    // Any failure: reveal all content and fall back to native scrolling.
    document.documentElement.classList.remove("motion");
    console.error("[motion] disabled:", err);
  }
}
