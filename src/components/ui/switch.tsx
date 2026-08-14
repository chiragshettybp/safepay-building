import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { motion } from "framer-motion";
import { selection } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const TRACK_WIDTH = 51;
const THUMB_SIZE = 30;
const PADDING = 2;
const TRAVEL = TRACK_WIDTH - PADDING * 2 - THUMB_SIZE;

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  /** Disable the selection haptic (e.g. during form sync). */
  silent?: boolean;
}

/**
 * The iOS Switch — a physical toggle.
 *  - Track: brand blue (oklch) when on, soft gray when off.
 *  - Thumb: solid white disc with a soft drop shadow.
 *  - Interaction: the thumb visibly stretches under pressure before
 *    sliding, and snaps with a selection haptic on release.
 */
const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitives.Root>, SwitchProps>(
  ({ className, checked: checkedProp, defaultChecked, onCheckedChange, silent = false, ...props }, ref) => {
    const isControlled = checkedProp !== undefined;
    const [localChecked, setLocalChecked] = React.useState<boolean>(defaultChecked ?? false);
    const [pressed, setPressed] = React.useState(false);
    const checked = isControlled ? checkedProp : localChecked;

    const handleCheckedChange = (next: boolean) => {
      if (!silent) selection();
      if (!isControlled) setLocalChecked(next);
      onCheckedChange?.(next);
    };

    return (
      <SwitchPrimitives.Root
        ref={ref}
        className={cn(
          "hit-44 relative inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "sw-track-on" : "sw-track-off",
          className,
        )}
        style={{ width: TRACK_WIDTH, height: THUMB_SIZE + PADDING * 2 }}
        checked={isControlled ? checkedProp : undefined}
        defaultChecked={defaultChecked}
        onCheckedChange={handleCheckedChange}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        {...props}
      >
        <SwitchPrimitives.Thumb asChild>
          <motion.span
            className="sw-thumb pointer-events-none absolute rounded-full"
            style={{ width: THUMB_SIZE, height: THUMB_SIZE, top: PADDING, left: PADDING }}
            animate={{
              x: checked ? TRAVEL : 0,
              scaleX: pressed ? 1.18 : 1,
            }}
            transition={
              pressed
                ? { type: "spring", stiffness: 600, damping: 38 }
                : { type: "spring", stiffness: 500, damping: 32 }
            }
          />
        </SwitchPrimitives.Thumb>
      </SwitchPrimitives.Root>
    );
  },
);
Switch.displayName = "Switch";

export { Switch };
