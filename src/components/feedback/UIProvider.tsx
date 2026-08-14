import * as React from "react";
import { useIsTouch } from "@/hooks/useIsTouch";
import { haptic, setHapticIntensity, type HapticIntensity } from "@/lib/feedback";

interface UIContextValue {
  /** True on coarse-pointer (touch) devices. */
  isTouch: boolean;
  /** True when the user prefers reduced motion. */
  reducedMotion: boolean;
  /** Centralized haptic emitter (no-ops where unsupported). */
  haptics: typeof haptic;
  /** Class that enlarges hit targets on touch devices. */
  hitTarget: string;
  /** Set global haptic intensity. */
  setIntensity: (level: HapticIntensity) => void;
}

const UIContext = React.createContext<UIContextValue | null>(null);

/**
 * Context-aware feedback provider.
 *
 * Tracks the input modality and motion preference, and adapts the feel of
 * the whole app: touch devices get heavier haptics and automatically
 * enlarged hit targets; pointer devices stay subtle.
 */
export function UIProvider({ children }: { children: React.ReactNode }) {
  const isTouch = useIsTouch();

  const [reducedMotion, setReducedMotion] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  React.useEffect(() => {
    setHapticIntensity(isTouch ? "medium" : "light");
  }, [isTouch]);

  const value = React.useMemo<UIContextValue>(
    () => ({
      isTouch,
      reducedMotion,
      haptics: haptic,
      hitTarget: isTouch ? "touch-target" : "",
      setIntensity: setHapticIntensity,
    }),
    [isTouch, reducedMotion],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used within <UIProvider>");
  return ctx;
}
