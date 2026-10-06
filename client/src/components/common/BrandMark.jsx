import { cn } from "@/lib/utils";
import { PLATFORM_MARK_LETTER } from "@/constants/branding";

const sizes = {
  xs: { box: "size-7 rounded-md", text: "text-xs" },
  sm: { box: "size-8 rounded-md", text: "text-sm" },
  md: { box: "size-14 rounded-xl", text: "text-xl" },
  lg: { box: "size-16 rounded-xl", text: "text-2xl" },
};

export default function BrandMark({ size = "sm", className }) {
  const s = sizes[size] ?? sizes.sm;
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center shrink-0 bg-primary border border-primary/80 shadow-sm",
        s.box,
        className
      )}
    >
      <span className={cn("font-display font-bold text-primary-foreground leading-none", s.text)}>
        {PLATFORM_MARK_LETTER}
      </span>
    </div>
  );
}
