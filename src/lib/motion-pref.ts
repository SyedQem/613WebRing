/**
 * The single switch for "is this page allowed to move?".
 *
 * Motion is on only when all three agree: the page opted in (`data-motion="on"`
 * on <html>), the OS isn't asking for reduced motion, and the visitor hasn't
 * pressed "Pause animations" in the footer. The inline script in BaseLayout
 * resolves that before first paint and records the answer as the `motion` class
 * on <html>; everything that animates (CSS and JS) keys off that class.
 *
 * This module is the runtime half: it flips the switch when the footer control
 * is used and tells the running animations about it, so pausing takes effect
 * immediately instead of on the next page load.
 */

/** localStorage key holding the visitor's explicit choice ("off" | "on"). */
export const MOTION_KEY = "613:motion";
const EVENT = "613:motionchange";

const root = () => document.documentElement;

/** Whether animations may run right now. */
export function motionOn(): boolean {
  return root().classList.contains("motion");
}

/** True when the OS-level "reduce motion" setting is active. */
export function osReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Whether this page has any motion to control at all. */
export function pageHasMotion(): boolean {
  return root().getAttribute("data-motion") === "on";
}

/**
 * Persist the visitor's choice and apply it live. Turning motion on is refused
 * while the OS asks for reduced motion — that setting always wins.
 */
export function setMotion(on: boolean): boolean {
  const allowed = on && pageHasMotion() && !osReducedMotion();
  try {
    localStorage.setItem(MOTION_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked — the choice still applies for this page view */
  }
  if (on) root().removeAttribute("data-motion-user");
  else root().setAttribute("data-motion-user", "off");
  if (allowed !== motionOn()) {
    root().classList.toggle("motion", allowed);
    // A boot sequence in flight is motion too.
    if (!allowed) root().classList.remove("booting");
    window.dispatchEvent(new CustomEvent(EVENT, { detail: allowed }));
  }
  return allowed;
}

/** Run `cb` whenever motion is switched on or off. Returns an unsubscribe. */
export function onMotionChange(cb: (on: boolean) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
