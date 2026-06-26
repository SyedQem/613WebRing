/**
 * Motion engine — Lenis smooth scroll + Motion (Framer) scroll reveals.
 *
 * Components stay declarative via data-attributes:
 *   data-reveal              → rise + fade + de-blur into view
 *   data-reveal="fade"       → fade + de-blur only (no translate)
 *   data-reveal-stagger      → stagger direct children into view
 *   data-parallax="0.15"     → gentle scroll drift (value = strength)
 *
 * Fail-safe: the `.motion` class is added to <html> before paint (BaseLayout)
 * only when motion is allowed. The hidden base states live in global.css gated
 * on that class, so with JS off / reduced-motion everything renders visible.
 * Any error here strips `.motion` to guarantee content is shown.
 */
import { animate, inView, stagger } from "motion";
import Lenis from "lenis";

const EASE = [0.22, 0.61, 0.36, 1] as const;

function reveals() {
  inView(
    "[data-reveal]",
    (el) => {
      const fade = el.getAttribute("data-reveal") === "fade";
      animate(
        el,
        fade
          ? { opacity: [0, 1], filter: ["blur(6px)", "blur(0px)"] }
          : {
              opacity: [0, 1],
              y: [26, 0],
              filter: ["blur(6px)", "blur(0px)"],
            },
        { duration: 0.75, ease: EASE },
      );
    },
    { amount: 0.2, margin: "0px 0px -8% 0px" },
  );

  document
    .querySelectorAll<HTMLElement>("[data-reveal-stagger]")
    .forEach((box) => {
      inView(
        box,
        () => {
          const kids = box.querySelectorAll(":scope > *");
          animate(
            kids,
            { opacity: [0, 1], y: [26, 0], filter: ["blur(6px)", "blur(0px)"] },
            { duration: 0.65, ease: EASE, delay: stagger(0.07) },
          );
        },
        { amount: 0.15 },
      );
    });
}

function parallax(lenis: Lenis) {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>("[data-parallax]"),
  );
  if (!els.length) return;
  const update = () => {
    const vh = window.innerHeight || 1;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const rel = (r.top + r.height / 2 - vh / 2) / vh; // -0.5..0.5 through view
      const strength = parseFloat(el.dataset.parallax || "0.15");
      el.style.transform = `translate3d(0, ${-rel * strength * 130}px, 0)`;
    }
  };
  lenis.on("scroll", update);
  window.addEventListener("resize", update);
  update();
}

function anchorScroll(lenis: Lenis) {
  document.querySelectorAll<HTMLAnchorElement>('a[href*="#"]').forEach((a) => {
    const url = new URL(a.href, location.href);
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
  if (!document.documentElement.classList.contains("motion")) return;

  try {
    const lenis = new Lenis({ lerp: 0.12, wheelMultiplier: 0.9, smoothWheel: true });
    (window as unknown as { lenis?: Lenis }).lenis = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    // Hold scroll while the boot loader is running, then hand it back.
    if (document.documentElement.classList.contains("booting")) {
      lenis.stop();
      const resume = () => {
        lenis.start();
        lenis.scrollTo(0, { immediate: true });
      };
      window.addEventListener("boot:done", resume, { once: true });
      window.setTimeout(resume, 6500);
    }

    reveals();
    parallax(lenis);
    anchorScroll(lenis);
  } catch (err) {
    document.documentElement.classList.remove("motion");
    console.error("[motion] disabled:", err);
  }
}
