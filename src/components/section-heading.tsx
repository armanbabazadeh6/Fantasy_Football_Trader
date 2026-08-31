import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface SectionHeadingProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl tracking-wide text-slate-100">
          {Icon && <Icon className="h-5 w-5 text-volt" />}
          {title}
        </h2>
        <div className="heading-underline mt-1.5" />
        {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
