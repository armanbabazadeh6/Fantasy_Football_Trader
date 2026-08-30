import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatPts(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(1);
}

export function formatNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

export function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function positionBadgeClass(position: string): string {
  switch (position) {
    case "QB":
      return "border-rose-500/40 bg-rose-500/10 text-rose-300";
    case "RB":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "WR":
      return "border-sky-500/40 bg-sky-500/10 text-sky-300";
    case "TE":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "K":
      return "border-violet-500/40 bg-violet-500/10 text-violet-300";
    default:
      return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  }
}

export function verdictStyle(verdict: string | null | undefined): {
  text: string;
  bg: string;
  border: string;
  bar: string;
  label: string;
} {
  switch (verdict) {
    case "ACCEPT":
      return {
        text: "text-emerald-300",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/40",
        bar: "bg-emerald-400",
        label: "Accept",
      };
    case "LEAN_ACCEPT":
      return {
        text: "text-lime-300",
        bg: "bg-lime-500/10",
        border: "border-lime-500/40",
        bar: "bg-lime-400",
        label: "Lean Accept",
      };
    case "FAIR":
      return {
        text: "text-sky-300",
        bg: "bg-sky-500/10",
        border: "border-sky-500/40",
        bar: "bg-sky-400",
        label: "Fair Deal",
      };
    case "COUNTER":
      return {
        text: "text-amber-300",
        bg: "bg-amber-500/10",
        border: "border-amber-500/40",
        bar: "bg-amber-400",
        label: "Counter",
      };
    case "LEAN_DECLINE":
      return {
        text: "text-orange-300",
        bg: "bg-orange-500/10",
        border: "border-orange-500/40",
        bar: "bg-orange-400",
        label: "Lean Decline",
      };
    case "DECLINE":
      return {
        text: "text-rose-300",
        bg: "bg-rose-500/10",
        border: "border-rose-500/40",
        bar: "bg-rose-400",
        label: "Decline",
      };
    default:
      return {
        text: "text-slate-300",
        bg: "bg-slate-500/10",
        border: "border-slate-500/40",
        bar: "bg-slate-400",
        label: "Unknown",
      };
  }
}

export function playerImageUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`;
}

export function teamLogoUrl(abbr: string | null): string | null {
  if (!abbr) return null;
  return `https://sleepercdn.com/images/nfl/logos/${abbr.toLowerCase()}.png`;
}

export function scoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 78) return "text-emerald-300";
  if (score >= 68) return "text-lime-300";
  if (score >= 55) return "text-sky-300";
  if (score >= 42) return "text-amber-300";
  return "text-slate-400";
}

export function scoreBarColor(score: number | null): string {
  if (score === null) return "bg-slate-600";
  if (score >= 78) return "bg-emerald-400";
  if (score >= 68) return "bg-lime-400";
  if (score >= 55) return "bg-sky-400";
  if (score >= 42) return "bg-amber-400";
  return "bg-slate-500";
}
