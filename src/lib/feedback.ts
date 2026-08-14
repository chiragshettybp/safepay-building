/**
 * Haptic synthesis — centralized feedback engine.
 *
 * Controls emit vibrations based on intent:
 *   - impact (light):  every discrete button tap
 *   - selection:       slider notches, switches, tabs, thresholds
 *   - notification:    triple-pulse for errors, double-pulse for success
 *
 * Degrades gracefully on platforms without `navigator.vibrate`
 * (e.g. iOS Safari) and can be tuned per-device by `UIProvider`.
 */

export type HapticIntensity = "light" | "medium" | "heavy";

const supportsVibration = () =>
  typeof navigator !== "undefined" && "vibrate" in navigator;

let intensity: HapticIntensity = "medium";
let enabled = true;

export const setHapticIntensity = (next: HapticIntensity) => {
  intensity = next;
};

export const setHapticsEnabled = (next: boolean) => {
  enabled = next;
};

const gain = (ms: number) => {
  const g = intensity === "heavy" ? 1.6 : intensity === "light" ? 0.6 : 1;
  return Math.max(1, Math.round(ms * g));
};

const pulse = (pattern: number | number[]) => {
  if (!enabled || !supportsVibration()) return;
  const seq = Array.isArray(pattern) ? pattern : [pattern];
  navigator.vibrate(seq.map(gain));
};

/** Single, short impact — a discrete tap or press. */
export const impact = (level: HapticIntensity = "light") =>
  pulse(level === "heavy" ? 20 : level === "medium" ? 14 : 10);

/** The user landed on a discrete value / notch / toggle position. */
export const selection = () => pulse(18);

/** Two quick pulses — an action succeeded. */
export const success = () => pulse([10, 40, 10]);

/** Three sharp pulses — an action failed. */
export const error = () => pulse([30, 30, 30, 30, 30]);

export const haptic = {
  impact,
  selection,
  success,
  error,
};
