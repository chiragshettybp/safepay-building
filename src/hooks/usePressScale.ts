import { animate, useMotionValue } from "framer-motion";
import { useCallback, useMemo } from "react";
import { impact } from "@/lib/feedback";
import { getCompress, getPressDuration, getSpringDamping, getSpringStiffness } from "@/lib/motion";

interface UsePressScaleOptions {
  /** Emit an impact haptic on pointer-down. Default true. */
  hapticOnPress?: boolean;
}

/**
 * The Asymmetric Press Model.
 *
 * Compression:  → scale(0.96) over 70ms, cubic-bezier(0.4, 0, 0.6, 1)
 * Recovery:     → scale(1) over ~340ms via a spring (stiffness 300,
 *                 damping 30) that overshoots ~2% and settles — the
 *                 "glass and rubber" elastic feel.
 *
 * Interruptible by design: `animate()` runs on the MotionValue, so a new
 * gesture takes over from the current position without resetting.
 *
 * Usage:
 *   const { scale, onPointerDown, onPointerUp, onPointerLeave, onPointerCancel } = usePressScale();
 *   <motion.button style={{ scale }} ...handlers />
 */
export function usePressScale({ hapticOnPress = true }: UsePressScaleOptions = {}) {
  const scale = useMotionValue(1);

  const compress = useCallback(() => {
    animate(scale, getCompress(), {
      duration: getPressDuration() / 1000,
      ease: [0.4, 0, 0.6, 1],
    });
    if (hapticOnPress) impact("light");
  }, [scale, hapticOnPress]);

  const recover = useCallback(() => {
    animate(scale, 1, {
      type: "spring",
      stiffness: getSpringStiffness(),
      damping: getSpringDamping(),
    });
  }, [scale]);

  const handlers = useMemo(
    () => ({
      onPointerDown: compress,
      onPointerUp: recover,
      onPointerLeave: recover,
      onPointerCancel: recover,
    }),
    [compress, recover],
  );

  return { scale, ...handlers };
}
