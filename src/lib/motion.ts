/**
 * Tactile & Kinetic Layer — motion/physics constants.
 *
 * Values mirror the CSS custom properties in `src/index.css` (`--phys-*`)
 * so the whole app can be tuned from a single token file. JS reads the
 * CSS variables lazily (with fallbacks) to keep one source of truth.
 */

/** Compression easing — cubic-bezier(0.4, 0, 0.6, 1) over `--phys-dur-press`. */
export const EASE_PRESS = [0.4, 0, 0.6, 1] as const;

/**
 * Recovery easing — the iOS "glass & rubber" settle curve (linear() keyframe
 * points with ~2% overshoot at 38.7–47%). Used by CSS-based motion; the
 * Framer-Motion hooks use a true spring instead.
 */
export const EASE_RELEASE =
  "linear(0, 0.402 7.4%, 0.711 15.3%, 0.898 23%, 0.985 30.8%, 1.02 38.7%, 1.024 47%, 1.01 60.3%, 1 100%)";

/** Swipe-to-dismiss thresholds (velocity in px/s, displacement as % of height). */
export const SWIPE = {
  velocity: 500,
  displacement: 0.25,
} as const;

const readCssNumber = (name: string, fallback: number): number => {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getPressDuration = () => readCssNumber("--phys-dur-press", 70);
export const getReleaseDuration = () => readCssNumber("--phys-dur-release", 340);
export const getSpringStiffness = () => readCssNumber("--phys-spring-stiffness", 300);
export const getSpringDamping = () => readCssNumber("--phys-spring-damping", 30);
export const getCompress = () => readCssNumber("--phys-compress", 0.96);

/** Spring presets (Framer Motion) tuned from the token file. */
export const springRelease = () =>
  ({
    type: "spring",
    stiffness: getSpringStiffness(),
    damping: getSpringDamping(),
  }) as const;

export const springSnap = () =>
  ({
    type: "spring",
    stiffness: 420,
    damping: 32,
  }) as const;

export const springSoft = () =>
  ({
    type: "spring",
    stiffness: 200,
    damping: 26,
  }) as const;

export const springOverlay = () =>
  ({
    type: "spring",
    stiffness: 500,
    damping: 34,
  }) as const;
