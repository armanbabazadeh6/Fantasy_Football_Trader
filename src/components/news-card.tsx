import { ExternalLink } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import type { NewsItem } from "@/types";

const SOURCE_CLASS: Record<string, string> = {
  ESPN: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  "CBS Sports": "border-sky-500/40 bg-sky-500/10 text-sky-300",
  "Yahoo Sports": "border-violet-500/40 bg-violet-500/10 text-violet-300",
  ProFootballTalk: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

interface NewsCardProps {
  item: NewsItem;
  className?: string;
}

export function NewsCard({ item, className }: NewsCardProps) {
  return (
    <a
      href={item.link || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "card-hover flex h-full flex-col gap-2 rounded-xl border border-white/5 bg-slate-900/60 p-4",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            SOURCE_CLASS[item.source] ?? "border-slate-500/40 bg-slate-500/10 text-slate-300"
          )}
        >
          {item.source}
        </span>
        <span className="shrink-0 text-[11px] text-slate-500">
          {relativeTime(item.publishedAt)}
        </span>
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100">
        {item.title}
      </p>
      {item.summary && (
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{item.summary}</p>
      )}
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-volt/80">
        Read more
        <ExternalLink className="h-3 w-3" />
      </span>
    </a>
  );
}
