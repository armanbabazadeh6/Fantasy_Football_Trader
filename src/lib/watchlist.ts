"use client";

const KEY = "fft.watchlist";

export function readWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeWatchlist(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
  }
}

export function toggleWatched(id: string): boolean {
  const ids = readWatchlist();
  const next = ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];
  writeWatchlist(next);
  return next.includes(id);
}

export function isWatched(id: string): boolean {
  return readWatchlist().includes(id);
}
