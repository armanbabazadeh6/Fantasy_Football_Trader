"use client";

import { useState } from "react";
import { cn, playerImageUrl, positionBadgeClass, teamLogoUrl } from "@/lib/utils";

interface PlayerAvatarProps {
  playerId: string;
  name: string;
  position: string;
  team: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<PlayerAvatarProps["size"]>, string> = {
  sm: "h-9 w-9 text-[10px]",
  md: "h-12 w-12 text-xs",
  lg: "h-16 w-16 text-sm",
};

export function PlayerAvatar({
  playerId,
  name,
  position,
  team,
  size = "md",
  className,
}: PlayerAvatarProps) {
  const [stage, setStage] = useState<"player" | "team" | "initials">(
    position === "DEF" ? "team" : "player"
  );
  const logo = teamLogoUrl(team);

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (stage === "player") {
    return (
      <img
        src={playerImageUrl(playerId)}
        alt={name}
        loading="lazy"
        className={cn(
          "shrink-0 rounded-full border border-white/10 bg-slate-800 object-cover",
          SIZE_CLASS[size],
          className
        )}
        onError={() => setStage(logo ? "team" : "initials")}
      />
    );
  }

  if (stage === "team" && logo) {
    return (
      <img
        src={logo}
        alt={name}
        loading="lazy"
        className={cn(
          "shrink-0 rounded-full border border-white/10 bg-slate-800 object-contain p-1.5",
          SIZE_CLASS[size],
          className
        )}
        onError={() => setStage("initials")}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border font-semibold text-slate-300",
        SIZE_CLASS[size],
        positionBadgeClass(position),
        className
      )}
    >
      {initials || "?"}
    </div>
  );
}
