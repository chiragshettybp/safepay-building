import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { selection } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** Automatically enlarge hit targets on touch devices. */
  adaptiveHitTargets?: boolean;
  /** Stretch options to fill the container width. */
  fullWidth?: boolean;
}

/**
 * Segmented Control — the active indicator is a physical pill: it slides
 * from the old position to the new one (`layoutId` magic-motion), slightly
 * stretching during the transition to read as fluid, not faded.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  adaptiveHitTargets = true,
  fullWidth = false,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = React.useState<{ left: number; width: number } | null>(null);

  React.useLayoutEffect(() => {
    const el = refs.current[value];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);

  return (
    <div
      role="tablist"
      aria-label="Segmented control"
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full bg-muted p-1",
        fullWidth && "flex w-full",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {pill && (
          <motion.span
            key={value}
            layoutId="segmented-pill"
            className="absolute inset-y-1 rounded-full bg-card shadow-sm"
            initial={false}
            style={{ left: pill.left, width: pill.width }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          />
        )}
      </AnimatePresence>

      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[option.value] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) {
                selection();
                onChange(option.value);
              }
            }}
            className={cn(
              "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors press-scale",
              fullWidth && "flex-1",
              adaptiveHitTargets && "min-h-[44px]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
