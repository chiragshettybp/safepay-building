import { useEffect, useState } from "react";

/**
 * Coarse pointer = touch device. Re-evaluated on media-query change so
 * switching between a trackpad/touch screen re-detects correctly.
 */
export function useIsTouch() {
  const [isTouch, setIsTouch] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(pointer: coarse)").matches),
  );

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isTouch;
}
