import { cn, formatPts, scoreBarColor, scoreColor } from "@/lib/utils";
import type { PlayerValue } from "@/types";

interface ValueMeterProps {
  value: PlayerValue;
  showLabel?: boolean;
  className?: string;
}

export function ValueMeter({ value, showLabel = true, className }: ValueMeterProps) {
  const score = value.score;

  if (score === null) {
    return (
      <div className={cn("text-xs text-slate-400", className)}>
        {showLabel ? "No recent data" : "—"}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        {showLabel && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {value.tier}
          </span>
        )}
        <span className={cn("font-display text-lg leading-none", scoreColor(score))}>
          {score}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn("h-full rounded-full transition-all duration-500", scoreBarColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      {value.ppg !== null && (
        <p className="mt-1 text-[11px] text-slate-400">
          {formatPts(value.ppg)} pts/game
          {value.games > 0 ? ` · ${value.games} games` : ""}
        </p>
      )}
    </div>
  );
}
