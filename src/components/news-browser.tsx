"use client";

import { useMemo, useState } from "react";
import { Newspaper, Search } from "lucide-react";
import { NewsCard } from "@/components/news-card";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/types";

export function NewsBrowser({ items }: { items: NewsItem[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("ALL");

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (source !== "ALL" && item.source !== source) return false;
      if (!q) return true;
      return `${item.title} ${item.summary}`.toLowerCase().includes(q);
    });
  }, [items, query, source]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
          AROUND THE <span className="text-volt">LEAGUE</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Live NFL headlines from ESPN, CBS Sports, Yahoo Sports, and
          ProFootballTalk — the same feed the trade analyzer reads.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2.5 focus-within:border-volt/50 sm:max-w-sm">
          <Search className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search headlines..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSource("ALL")}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              source === "ALL"
                ? "border-volt/40 bg-volt/10 text-volt"
                : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
            )}
          >
            All sources
          </button>
          {sources.map(([name, count]) => (
            <button
              key={name}
              type="button"
              onClick={() => setSource(name)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                source === name
                  ? "border-volt/40 bg-volt/10 text-volt"
                  : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
              )}
            >
              {name} <span className="text-slate-600">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-slate-900/60 px-6 py-16 text-center">
          <Newspaper className="mx-auto h-8 w-8 text-slate-700" />
          <p className="mt-3 text-sm text-slate-500">No headlines match that filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
