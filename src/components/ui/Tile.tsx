import * as React from "react";
import { cn } from "@/lib/utils";

const tileTones = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

const tileSizes = {
  xs: "h-7 w-7",
  sm: "h-8 w-8",
  md: "h-11 w-11",
} as const;

export interface TileProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof tileTones;
  size?: keyof typeof tileSizes;
}

/**
 * Icon Tile — icons should rarely float alone. Houses a glyph in a
 * continuous-corner (squircle) container with a semantic background tint
 * so the function is readable at a glance, iOS-style.
 */
export const Tile = React.forwardRef<HTMLDivElement, TileProps>(
  ({ className, tone = "neutral", size = "sm", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[10px]",
        tileSizes[size],
        tileTones[tone],
        className,
      )}
      {...props}
    />
  ),
);
Tile.displayName = "Tile";
