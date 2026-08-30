import Link from "next/link";
import { PlayerAvatar } from "@/components/player-avatar";
import { PositionBadge } from "@/components/position-badge";
import { ValueMeter } from "@/components/value-meter";
import { cn } from "@/lib/utils";
import { teamDisplayName } from "@/lib/teams";
import type { PlayerSummary } from "@/types";

interface PlayerCardProps {
  player: PlayerSummary;
  rank?: number;
  className?: string;
}

export function PlayerCard({ player, rank, className }: PlayerCardProps) {
  return (
    <Link
      href={`/player/${player.id}`}
      className={cn(
        "card-hover group flex flex-col gap-3 rounded-xl border border-white/5 bg-slate-900/60 p-4",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {typeof rank === "number" && (
          <span className="w-5 shrink-0 text-center font-display text-lg text-slate-600 group-hover:text-volt">
            {rank}
          </span>
        )}
        <PlayerAvatar
          playerId={player.id}
          name={player.name}
          position={player.position}
          team={player.team}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100 group-hover:text-white">
            {player.name}
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <PositionBadge position={player.position} />
            <span className="truncate text-xs text-slate-500">
              {teamDisplayName(player.team)}
            </span>
          </div>
        </div>
      </div>
      <ValueMeter value={player.value} />
    </Link>
  );
}
