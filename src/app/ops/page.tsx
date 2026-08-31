import { getOpsReport } from "@/lib/ops";
import type { OpsReport } from "@/lib/ops";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data Ops",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ageOfMs(ms: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function ageOfIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "unknown";
  return ageOfMs(ms);
}

function durationBetween(startIso: string, endIso: string | null): string {
  if (!endIso) return "running...";
  const seconds = Math.max(
    0,
    Math.round((Date.parse(endIso) - Date.parse(startIso)) / 1000)
  );
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function StatCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-display text-3xl tracking-wide",
          tone === "good" && "text-volt",
          tone === "warn" && "text-amber-400",
          tone === "bad" && "text-red-400",
          tone === "default" && "text-slate-100"
        )}
      >
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function FeedBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    healthy: "border-volt/40 bg-volt/10 text-volt",
    quiet: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    dead: "border-red-400/40 bg-red-400/10 text-red-400",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        styles[status] ?? "border-white/10 text-slate-400"
      )}
    >
      {status}
    </span>
  );
}

function schedulerSummary(report: OpsReport): {
  value: string;
  detail: string;
  tone: "default" | "good" | "warn" | "bad";
} {
  const last = report.refreshHistory[0];
  if (!last) {
    return {
      value: "STARTING",
      detail: "first cycle runs ~30s after boot",
      tone: "warn",
    };
  }
  if (last.ok === null) {
    return {
      value: "RUNNING",
      detail: `started ${ageOfIso(last.startedAt)} ago`,
      tone: "warn",
    };
  }
  if (last.ok === 1) {
    return {
      value: "ALIVE",
      detail: `last cycle ok ${ageOfIso(last.finishedAt ?? last.startedAt)} ago, every 2h`,
      tone: "good",
    };
  }
  return {
    value: "FAILING",
    detail: last.error ?? "last cycle failed",
    tone: "bad",
  };
}

export default async function OpsPage() {
  const report = await getOpsReport();
  const scheduler = schedulerSummary(report);
  const maxDay = Math.max(1, ...report.newsByDay.map((d) => d.count));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-4xl tracking-wide text-slate-100 sm:text-5xl">
          DATA <span className="text-volt">OPS</span>
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Pipeline health for the value engine: refresh history, news feed
          freshness, cache ages and storage. Generated{" "}
          {ageOfIso(report.generatedAt)} ago.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Scheduler"
          value={scheduler.value}
          detail={scheduler.detail}
          tone={scheduler.tone}
        />
        <StatCard
          label="News archive"
          value={report.archive.total.toLocaleString()}
          detail={report.archive.categories
            .map((c) => `${c.category} ${c.count}`)
            .join(" · ")}
        />
        <StatCard
          label="Value snapshots"
          value={report.snapshots.snapshots.toLocaleString()}
          detail={`${report.snapshots.players} players · ${report.snapshots.dates} days${
            report.snapshots.latest ? ` · latest ${report.snapshots.latest}` : ""
          }`}
        />
        <StatCard
          label="Storage"
          value={formatBytes(report.storage.dbBytes)}
          detail={`cache ${report.storage.cacheFiles} files · ${formatBytes(
            report.storage.cacheBytes
          )}`}
        />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Refresh history
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Players</th>
                  <th className="px-4 py-3">News</th>
                  <th className="px-4 py-3">Result</th>
                </tr>
              </thead>
              <tbody>
                {report.refreshHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No refresh cycles logged yet.
                    </td>
                  </tr>
                ) : (
                  report.refreshHistory.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-slate-300">
                        {ageOfIso(row.startedAt)} ago
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {durationBetween(row.startedAt, row.finishedAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{row.players ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{row.news ?? "—"}</td>
                      <td className="px-4 py-3">
                        {row.ok === 1 ? (
                          <span className="rounded-full border border-volt/40 bg-volt/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-volt">
                            ok
                          </span>
                        ) : row.ok === 0 ? (
                          <span
                            title={row.error ?? undefined}
                            className="max-w-[240px] truncate rounded-full border border-red-400/40 bg-red-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-400"
                          >
                            fail{row.error ? ` · ${row.error}` : ""}
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                            running
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Cache ages
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.03] text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Family</th>
                  <th className="px-4 py-3">Files</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Oldest</th>
                  <th className="px-4 py-3">Newest</th>
                </tr>
              </thead>
              <tbody>
                {report.cacheFamilies.map((fam) => {
                  const newestAge =
                    fam.newestMs !== null ? ageOfMs(fam.newestMs) : "—";
                  const stale = fam.newestMs !== null && Date.now() - fam.newestMs >= 24 * 3600 * 1000;
                  return (
                    <tr key={fam.family} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        {fam.family}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{fam.files}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {formatBytes(fam.bytes)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {fam.oldestMs !== null ? ageOfMs(fam.oldestMs) : "—"}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3",
                          stale ? "text-amber-400" : "text-slate-300"
                        )}
                      >
                        {stale ? `stale ${newestAge}` : newestAge}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Ingest by day
          </h2>
          <div className="rounded-2xl border border-white/10 p-4">
            {report.newsByDay.length === 0 ? (
              <p className="text-sm text-slate-500">Archive is empty.</p>
            ) : (
              <ul className="space-y-2">
                {report.newsByDay.map((d) => (
                  <li key={d.day} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 font-mono text-slate-500">{d.day}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                      <span
                        className="block h-full rounded-full bg-volt/70"
                        style={{ width: `${(d.count / maxDay) * 100}%` }}
                      />
                    </span>
                    <span className="w-8 shrink-0 text-right font-mono text-slate-300">
                      {d.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Feed health
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <tbody>
                {report.feeds.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500">
                      No sources archived yet.
                    </td>
                  </tr>
                ) : (
                  report.feeds.map((feed) => (
                    <tr key={feed.source} className="border-b border-white/5 last:border-0">
                      <td className="px-3 py-2.5">
                        <p className="max-w-[180px] truncate text-xs text-slate-300">
                          {feed.source}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          24h {feed.last24h} · 7d {feed.last7d} · total {feed.total}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <FeedBadge status={feed.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
