import * as React from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { selection } from "@/lib/feedback";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  /** Distance (px) that locks the refresh in. Default 80. */
  threshold?: number;
}

const REFRESH_ANIM = { type: "spring", stiffness: 420, damping: 30 } as const;
const SPIN_ANIM = { repeat: Number.POSITIVE_INFINITY, duration: 0.8, ease: "linear" } as const;

/**
 * Pull-to-Refresh with kinetic feedback:
 *  - the indicator scales and rotates with pull distance (1:1 tracking)
 *  - crossing the threshold fires a selection haptic + a spring "pop" that
 *    signals the refresh has locked in
 *  - releasing past the threshold springs into the spin state.
 */
const PullToRefresh = React.forwardRef<HTMLDivElement, PullToRefreshProps>(
  ({ onRefresh, children, threshold = 80 }, ref) => {
    const [pullDistance, setPullDistance] = React.useState(0);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [armed, setArmed] = React.useState(false);
    const startY = React.useRef(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
      if (containerRef.current?.scrollTop === 0) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (isRefreshing || containerRef.current?.scrollTop !== 0) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0 && startY.current > 0) {
        const distance = Math.min(diff * 0.5, threshold * 1.5);
        setPullDistance(distance);
        if (distance >= threshold && !armed) {
          selection();
          setArmed(true);
        }
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
      startY.current = 0;
      setArmed(false);
    };

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = progress * 360;
    const scale = 0.5 + progress * 0.5;

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className="h-full overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ height: pullDistance }}
        >
          <motion.div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              progress >= 1 ? "bg-primary" : "bg-primary/10",
            )}
            animate={isRefreshing ? { rotate: 360 } : { scale, rotate: rotation }}
            transition={isRefreshing ? SPIN_ANIM : REFRESH_ANIM}
          >
            <RefreshCw
              className={cn("h-5 w-5", progress >= 1 ? "text-white" : "text-muted-foreground")}
            />
          </motion.div>
        </div>
        {children}
      </div>
    );
  },
);

PullToRefresh.displayName = "PullToRefresh";

export { PullToRefresh };
