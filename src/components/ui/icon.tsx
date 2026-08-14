import { motion } from "framer-motion";
import * as React from "react";
import { cn } from "@/lib/utils";

export type IconSize = "xs" | "sm" | "md" | "lg";

export type IconGlyph = React.ReactElement<{ strokeWidth?: number; className?: string }>;

/**
 * Weight-matched stroke by scale — 2.2 for small icons, 1.5 for large —
 * so glyphs stay optically balanced across the interface.
 */
export const strokeForSize: Record<IconSize, number> = {
  xs: 2.2,
  sm: 2.2,
  md: 1.75,
  lg: 1.5,
};

const sizeClass = (size: IconSize) =>
  ({
    xs: "h-4 w-4",
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  })[size];

const withStroke = (icon: IconGlyph, strokeWidth: number) =>
  React.cloneElement(icon, {
    strokeWidth,
    className: cn(icon.props.className, "h-full w-full"),
  });

export interface IconProps {
  /** Lucide glyph. */
  icon: IconGlyph;
  size?: IconSize;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

/**
 * Icon normalization — every glyph in the app renders through this wrapper
 * so stroke weight and sizing stay consistent (SVG-only, Lucide React).
 */
export const Icon = React.forwardRef<HTMLSpanElement, IconProps>(
  ({ icon, size = "sm", className, style, strokeWidth }, ref) => (
    <span ref={ref} className={cn("inline-flex shrink-0", sizeClass(size), className)} style={style}>
      {withStroke(icon, strokeWidth ?? strokeForSize[size])}
    </span>
  ),
);
Icon.displayName = "Icon";

export interface AnimatedIconProps extends IconProps {
  /** Micro-animation to apply. */
  animation: "pulse" | "rotate" | "shake";
  /** Drives the animated state (e.g. search active, menu open). */
  active?: boolean;
}

/**
 * Micro-animated icons — glyphs react to state:
 *  - pulse:  search magnifier breathes while active
 *  - rotate: Plus rotates 45° into a Close glyph on open (spring)
 *  - shake:  destructive actions (trash) get a quick lid-lift tilt
 */
export const AnimatedIcon = React.forwardRef<HTMLSpanElement, AnimatedIconProps>(
  ({ icon, animation, active = false, size = "sm", className, strokeWidth, style }, ref) => {
    const sw = strokeWidth ?? strokeForSize[size];
    const glyph = withStroke(icon, sw);
    const common = cn("inline-flex shrink-0", sizeClass(size), className);

    if (animation === "rotate") {
      return (
        <motion.span
          ref={ref}
          className={common}
          style={style}
          animate={{ rotate: active ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
        >
          {glyph}
        </motion.span>
      );
    }

    if (animation === "shake") {
      return (
        <motion.span
          ref={ref}
          className={common}
          style={style}
          animate={active ? { rotate: [0, -4, 4, -4, 4, 0] } : { rotate: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        >
          {glyph}
        </motion.span>
      );
    }

    return (
      <motion.span
        ref={ref}
        className={common}
        style={style}
        animate={active ? { scale: [1, 1.08, 1], opacity: [1, 0.82, 1] } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, repeat: active ? Number.POSITIVE_INFINITY : 0, ease: "easeInOut" }}
      >
        {glyph}
      </motion.span>
    );
  },
);
AnimatedIcon.displayName = "AnimatedIcon";
