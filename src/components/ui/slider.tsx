import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { AnimatePresence, motion } from "framer-motion";
import { selection } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/**
 * The iOS Slider.
 *  - Track: an inset trench (1px inner shadow) with a brand-blue fill.
 *  - Thumb: a 44px hit area around an easy-to-grab knob.
 *  - Feedback: the value appears in a tooltip bubble that follows the
 *    thumb, scaling up 0 → 1 on a spring; a selection haptic fires for
 *    each discrete notch crossed.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => {
  const isControlled = value !== undefined;
  const initialValue = value?.[0] ?? defaultValue?.[0] ?? min;
  const [liveValue, setLiveValue] = React.useState(initialValue);
  const [dragging, setDragging] = React.useState(false);
  const display = isControlled ? (value?.[0] ?? min) : liveValue;

  const percent = max === min ? 0 : ((display - min) / (max - min)) * 100;

  const handleValueChange = (next: number[]) => {
    if (!isControlled) setLiveValue(next[0]);
    const previous = display;
    const delta = Math.abs(next[0] - previous);
    if (delta >= Math.max(step, 1)) selection();
    onValueChange?.(next);
  };

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      min={min}
      max={max}
      step={step}
      value={isControlled ? value : undefined}
      defaultValue={defaultValue}
      onValueChange={handleValueChange}
      onPointerDown={() => setDragging(true)}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]">
        <SliderPrimitive.Range className="absolute h-full sw-track-on" />
      </SliderPrimitive.Track>

      <SliderPrimitive.Thumb className="relative block h-11 w-11 shrink-0 cursor-grab rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50">
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-7 w-7 rounded-full border border-border bg-card sw-thumb"
          style={{ transform: `translate(-50%, -50%) scale(${dragging ? 1.15 : 1})` }}
        />
      </SliderPrimitive.Thumb>

      <AnimatePresence>
        {dragging && (
          <motion.div
            className="pointer-events-none absolute -top-10 z-10 -translate-x-1/2 rounded-lg bg-foreground px-2.5 py-1 text-xs font-semibold tabular-nums text-background shadow-subtle"
            style={{ left: `${percent}%` }}
            initial={{ opacity: 0, scale: 0, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {display}
          </motion.div>
        )}
      </AnimatePresence>
    </SliderPrimitive.Root>
  );
});
Slider.displayName = "Slider";

export { Slider };
