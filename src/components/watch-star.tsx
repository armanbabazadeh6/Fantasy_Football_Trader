"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { isWatched, toggleWatched } from "@/lib/watchlist";

interface WatchStarProps {
  playerId: string;
  playerName: string;
  className?: string;
}

export function WatchStar({ playerId, playerName, className }: WatchStarProps) {
  const [watched, setWatched] = useState<boolean | null>(null);

  useEffect(() => {
    setWatched(isWatched(playerId));
  }, [playerId]);

  if (watched === null) {
    return <span className={cn("inline-block h-4 w-4", className)} aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setWatched(toggleWatched(playerId));
      }}
      aria-label={watched ? `Remove ${playerName} from watchlist` : `Add ${playerName} to watchlist`}
      className={cn(
        "rounded-md p-1 transition-colors",
        watched ? "text-amber-300" : "text-slate-600 hover:text-slate-300",
        className
      )}
    >
      <Star className={cn("h-4 w-4", watched && "fill-amber-300")} />
    </button>
  );
}
