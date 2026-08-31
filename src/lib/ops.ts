import { promises as fs } from "fs";
import path from "path";
import { getDb } from "./db";

export interface RefreshLogRow {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  players: number | null;
  news: number | null;
  ok: number | null;
  error: string | null;
}

export type FeedStatus = "healthy" | "quiet" | "dead";

export interface FeedHealth {
  source: string;
  last24h: number;
  last7d: number;
  total: number;
  newest: string;
  status: FeedStatus;
}

export interface NewsDayCount {
  day: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface CacheFamilyStat {
  family: string;
  files: number;
  bytes: number;
  oldestMs: number | null;
  newestMs: number | null;
}

export interface OpsReport {
  generatedAt: string;
  refreshHistory: RefreshLogRow[];
  feeds: FeedHealth[];
  newsByDay: NewsDayCount[];
  archive: {
    total: number;
    categories: CategoryCount[];
  };
  snapshots: {
    snapshots: number;
    players: number;
    dates: number;
    latest: string | null;
  };
  storage: {
    dbBytes: number;
    cacheFiles: number;
    cacheBytes: number;
  };
  cacheFamilies: CacheFamilyStat[];
  espnSession: {
    status: "ok" | "expired" | "untested";
    hasSession: boolean;
    leagueId: string | null;
    updatedAt: string | null;
    lastOkAt: string | null;
    lastFailAt: string | null;
  };
}

function cacheFamily(fileName: string): string {
  const base = fileName.replace(/\.json$/, "");
  const statsMatch = base.match(/^sleeper_stats_(\d{4})_w\d+$/);
  if (statsMatch) return `sleeper_stats_${statsMatch[1]}`;
  if (/^sleeper_league_\d+/.test(base)) return "sleeper_league";
  return base.replace(/_v\d+$/, "");
}

async function readCacheStats(): Promise<{
  files: number;
  bytes: number;
  families: Map<string, CacheFamilyStat>;
}> {
  const dir = path.join(process.cwd(), ".cache");
  const families = new Map<string, CacheFamilyStat>();
  let files = 0;
  let bytes = 0;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return { files, bytes, families };
  }
  for (const name of entries) {
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      files += 1;
      bytes += stat.size;
      const family = cacheFamily(name);
      const current = families.get(family) ?? {
        family,
        files: 0,
        bytes: 0,
        oldestMs: null,
        newestMs: null,
      };
      current.files += 1;
      current.bytes += stat.size;
      current.oldestMs =
        current.oldestMs === null || stat.mtimeMs < current.oldestMs
          ? stat.mtimeMs
          : current.oldestMs;
      current.newestMs =
        current.newestMs === null || stat.mtimeMs > current.newestMs
          ? stat.mtimeMs
          : current.newestMs;
      families.set(family, current);
    } catch {
    }
  }
  return { files, bytes, families };
}

export async function getOpsReport(): Promise<OpsReport> {
  const db = getDb();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  const refreshRows = db
    .prepare(
      "SELECT id, started_at, finished_at, players, news, ok, error FROM refresh_log ORDER BY id DESC LIMIT 10"
    )
    .all() as {
    id: number;
    started_at: string;
    finished_at: string | null;
    players: number | null;
    news: number | null;
    ok: number | null;
    error: string | null;
  }[];

  const feedRows = db
    .prepare(
      `SELECT source,
        SUM(CASE WHEN first_seen > ? THEN 1 ELSE 0 END) AS last24h,
        SUM(CASE WHEN first_seen > ? THEN 1 ELSE 0 END) AS last7d,
        COUNT(*) AS total,
        MAX(first_seen) AS newest
      FROM news_items GROUP BY source ORDER BY last24h DESC, last7d DESC, total DESC`
    )
    .all(dayAgo, weekAgo) as {
    source: string;
    last24h: number;
    last7d: number;
    total: number;
    newest: string;
  }[];

  const dayRows = db
    .prepare(
      "SELECT date(first_seen) AS day, COUNT(*) AS count FROM news_items GROUP BY day ORDER BY day DESC LIMIT 14"
    )
    .all() as { day: string; count: number }[];

  const categoryRows = db
    .prepare(
      "SELECT category, COUNT(*) AS count FROM news_items GROUP BY category ORDER BY count DESC"
    )
    .all() as { category: string; count: number }[];

  const archiveTotal = (
    db.prepare("SELECT COUNT(*) AS n FROM news_items").get() as { n: number }
  ).n;

  const snapshotRow = db
    .prepare(
      "SELECT COUNT(*) AS snapshots, COUNT(DISTINCT player_id) AS players, COUNT(DISTINCT date) AS dates, MAX(date) AS latest FROM value_history"
    )
    .get() as {
    snapshots: number;
    players: number;
    dates: number;
    latest: string | null;
  };

  const cache = await readCacheStats();
  let dbBytes = 0;
  try {
    const stat = await fs.stat(path.join(process.cwd(), "data", "app.db"));
    dbBytes = stat.size;
  } catch {
  }

  const { getEspnSessionState } = await import("./espn-session");
  const espnSessionState = getEspnSessionState();

  return {
    generatedAt: new Date().toISOString(),
    refreshHistory: refreshRows.map((row) => ({
      id: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      players: row.players,
      news: row.news,
      ok: row.ok,
      error: row.error,
    })),
    feeds: feedRows.map((row) => ({
      source: row.source,
      last24h: row.last24h,
      last7d: row.last7d,
      total: row.total,
      newest: row.newest,
      status:
        row.last24h > 0 ? "healthy" : row.last7d > 0 ? "quiet" : "dead",
    })),
    newsByDay: dayRows.map((row) => ({ day: row.day, count: row.count })),
    archive: {
      total: archiveTotal,
      categories: categoryRows.map((row) => ({
        category: row.category,
        count: row.count,
      })),
    },
    snapshots: {
      snapshots: snapshotRow.snapshots,
      players: snapshotRow.players,
      dates: snapshotRow.dates,
      latest: snapshotRow.latest,
    },
    storage: {
      dbBytes,
      cacheFiles: cache.files,
      cacheBytes: cache.bytes,
    },
    cacheFamilies: [...cache.families.values()].sort((a, b) =>
      a.family.localeCompare(b.family)
    ),
    espnSession: {
      status: espnSessionState.status,
      hasSession: espnSessionState.updatedAt !== null,
      leagueId: espnSessionState.leagueId,
      updatedAt: espnSessionState.updatedAt,
      lastOkAt: espnSessionState.lastOkAt,
      lastFailAt: espnSessionState.lastFailAt,
    },
  };
}
