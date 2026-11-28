/**
 * Motion engine — Lenis smooth scroll + scroll reveals.
 *
 * Components stay declarative via data-attributes:
 *   data-reveal              → rise + fade + de-blur into view
 *   data-reveal="fade"       → fade + de-blur only (no translate)
 *   data-reveal-stagger      → stagger direct children into view
 *   data-reveal-eager        → same look, but a pure-CSS animation on load for
 *                              above-the-fold copy (nothing to do here)
 *   data-parallax="0.15"     → gentle scroll drift (value = strength)
 *
 * The reveals themselves are CSS transitions (see SCROLL-REVEAL in global.css);
 * this file only decides *when*, with one IntersectionObserver, and cleans up
 * afterwards so revealed elements don't keep a filter or their own compositor
 * layer for the rest of the session.
 *
 * Fail-safe: the `.motion` class is added to <html> before paint (BaseLayout)
 * only when motion is allowed. The hidden base states live in global.css gated
 * on that class, so with JS off / reduced-motion everything renders visible.
 * Any error here strips `.motion` to guarantee content is shown.
 */
import Lenis from "lenis";
import { motionOn, onMotionChange } from "./motion-pref";

const REVEAL = "[data-reveal], [data-reveal-stagger]";
const MAX_STAGGER = 10;

let lenis: Lenis | null = null;
let rafId = 0;
let revealObserver: IntersectionObserver | null = null;
let teardownParallax: (() => void) | null = null;

/** Drop the reveal hooks once an element has finished arriving. */
function settle(el: HTMLElement) {
  el.removeAttribute("data-reveal");
  el.removeAttribute("data-reveal-stagger");
  el.classList.remove("is-in");
  for (const kid of Array.from(el.children) as HTMLElement[]) {
    kid.style.removeProperty("--i");
  }
}

function reveals() {
  revealObserver = new IntersectionObserver(
    (entries, io) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        io.unobserve(el);

        const staggered = el.hasAttribute("data-reveal-stagger");
        let wait = 800;
        if (staggered) {
          // Cap the cascade: in a long list (the member grid) the tail would
          // otherwise wait several seconds for its turn.
          const kids = Array.from(el.children) as HTMLElement[];
          const last = Math.min(kids.length, MAX_STAGGER);
          kids.forEach((kid, i) =>
            kid.style.setProperty("--i", String(Math.min(i, last))),
          );
          wait = 700 + last * 70;
        }
        el.classList.add("is-in");
        // A timer rather than `transitionend`: that event never fires if the
        // transition is interrupted or the tab is hidden, and a missed cleanup
        // would leave the element's own hover transitions overridden.
        window.setTimeout(() => settle(el), wait);
      }
    },
    // Any pixel visible counts (threshold 0), not a fraction: a fixed fraction
    // can never be reached by elements taller than the viewport (e.g. the
    // member grid stacked to one column on a phone), leaving them permanently
    // hidden.
    { threshold: 0, rootMargin: "0px 0px -8% 0px" },
  );
  document
    .querySelectorAll<HTMLElement>(REVEAL)
    .forEach((el) => revealObserver!.observe(el));
}

/** Show everything that was still waiting to be revealed. */
function revealAllNow() {
  revealObserver?.disconnect();
  revealObserver = null;
  document.querySelectorAll<HTMLElement>(REVEAL).forEach(settle);
}

function parallax(l: Lenis) {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>("[data-parallax]"),
  );
  if (!els.length) return;
  const items = els.map((el) => ({
    el,
    strength: parseFloat(el.dataset.parallax || "0.15"),
    visible: false,
  }));
  // Only elements on screen need their transform kept up to date.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const item = items.find((it) => it.el === entry.target);
        if (item) item.visible = entry.isIntersecting;
      }
      update();
    },
    { rootMargin: "20% 0px 20% 0px" },
  );
  const update = () => {
    const vh = window.innerHeight || 1;
    // Read every rect first, then write, so one scroll tick is one layout.
    const rects = items.map((it) =>
      it.visible ? it.el.getBoundingClientRect() : null,
    );
    items.forEach((it, i) => {
      const r = rects[i];
      if (!r) return;
      const rel = (r.top + r.height / 2 - vh / 2) / vh; // -0.5..0.5 through view
      it.el.style.transform = `translate3d(0, ${-rel * it.strength * 130}px, 0)`;
    });
  };
  items.forEach((it) => io.observe(it.el));
  const off = l.on("scroll", update);
  window.addEventListener("resize", update);
  teardownParallax = () => {
    io.disconnect();
    off();
    window.removeEventListener("resize", update);
    items.forEach((it) => it.el.style.removeProperty("transform"));
  };
}

/**
 * Same-page anchor links. With Lenis running we scroll smoothly ourselves, and
 * in every case we move keyboard focus to the destination — otherwise "Skip to
 * content" would scroll the page but leave the next Tab back in the header.
 */
function anchorScroll() {
  document.querySelectorAll<HTMLAnchorElement>('a[href*="#"]').forEach((a) => {
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    a.addEventListener("click", (e) => {
      let target: HTMLElement | null = null;
      try {
        target = document.querySelector<HTMLElement>(url.hash);
      } catch {
        return; // not a valid selector — let the browser handle it
      }
      if (!target) return;
      if (!target.hasAttribute("tabindex"))
        target.setAttribute("tabindex", "-1");
      if (lenis) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -88 });
        history.pushState(null, "", url.hash);
        target.focus({ preventScroll: true });
      } else {
        // Native jump; focus afterwards so the browser's own scroll wins.
        requestAnimationFrame(() => target!.focus({ preventScroll: true }));
      }
    });
  });
}

function startSmoothScroll() {
  const l = new Lenis({
    lerp: 0.12,
    wheelMultiplier: 0.9,
    smoothWheel: true,
  });
  lenis = l;
  (window as unknown as { lenis?: Lenis }).lenis = l;

  const raf = (time: number) => {
    l.raf(time);
    rafId = requestAnimationFrame(raf);
  };
  rafId = requestAnimationFrame(raf);

  // Hold scroll while the boot loader is running, then hand it back.
  if (document.documentElement.classList.contains("booting")) {
    l.stop();
    let resumed = false;
    const resume = () => {
      // The fallback timer can fire after boot:done already resumed —
      // guard so the top-scroll can't yank a user who has started scrolling.
      if (resumed || lenis !== l) return;
      resumed = true;
      window.clearTimeout(fallback);
      l.start();
      l.scrollTo(0, { immediate: true });
    };
    window.addEventListener("boot:done", resume, { once: true });
    const fallback = window.setTimeout(resume, 6500);
  }

  parallax(l);
}

function stopSmoothScroll() {
  cancelAnimationFrame(rafId);
  teardownParallax?.();
  teardownParallax = null;
  lenis?.destroy();
  lenis = null;
  delete (window as unknown as { lenis?: Lenis }).lenis;
}

function start() {
  try {
    startSmoothScroll();
    reveals();
  } catch (err) {
    document.documentElement.classList.remove("motion");
    console.error("[motion] disabled:", err);
  }
}

export function initMotion() {
  const root = document.documentElement;
  // Handshake with the inline failsafe in BaseLayout: proves this module
  // loaded, so the timer there won't strip `.motion` out from under us.
  root.setAttribute("data-motion-ready", "");

  anchorScroll();
  if (motionOn()) start();

  // The footer's pause / play control.
  onMotionChange((on) => {
    if (on) {
      start();
    } else {
      stopSmoothScroll();
      revealAllNow();
    }
  });
}
