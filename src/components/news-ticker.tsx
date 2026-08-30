import { relativeTime } from "@/lib/utils";
import type { NewsItem } from "@/types";

export function NewsTicker({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  const loop = items.slice(0, 14);
  return (
    <div className="ticker-paused group relative z-10 border-y border-white/5 bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-stretch">
        <span className="hud-blink z-10 flex shrink-0 items-center gap-2 border-r border-volt/20 bg-volt/10 px-4 font-display text-base tracking-[0.2em] text-volt">
          <span className="h-2 w-2 rounded-full bg-volt" />
          LIVE
        </span>
        <div className="ticker-mask relative flex-1 overflow-hidden">
          <div className="ticker-track py-2.5">
            {[...loop, ...loop].map((item, index) => (
              <a
                key={`${item.id}-${index}`}
                href={item.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-2.5 text-xs text-slate-400 transition-colors hover:text-slate-100"
              >
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {item.source}
                </span>
                <span className="whitespace-nowrap">{item.title}</span>
                <span className="text-[10px] text-slate-600">
                  {relativeTime(item.publishedAt)}
                </span>
                <span className="text-slate-800">•</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
