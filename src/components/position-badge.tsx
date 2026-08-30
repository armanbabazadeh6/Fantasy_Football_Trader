import { cn, positionBadgeClass } from "@/lib/utils";

interface PositionBadgeProps {
  position: string;
  className?: string;
}

export function PositionBadge({ position, className }: PositionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 text-[11px] font-bold uppercase leading-none",
        positionBadgeClass(position),
        className
      )}
    >
      {position}
    </span>
  );
}
