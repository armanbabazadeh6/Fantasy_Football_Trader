import { getDb } from "./db";
import { fetchNews } from "./news";
import type { NewsItem } from "@/types";

export type NewsCategory =
  | "injury"
  | "suspension"
  | "transaction"
  | "depth"
  | "performance"
  | "general";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "for", "of", "in", "on", "to", "is", "are",
  "was", "were", "be", "been", "at", "by", "with", "as", "it", "its",
  "this", "that", "from", "after", "before", "how", "why", "what", "when",
  "vs", "week", "nfl", "report", "news", "update", "amid",
]);

const CATEGORY_RULES: { category: NewsCategory; patterns: RegExp[] }[] = [
  {
    category: "injury",
    patterns: [
      /knee|ankle|hamstring|shoulder|toe|groin|quad|hip|back|concussion|acl|achilles/i,
      /\bir\b|injur|out for|out week|questionable|doubtful|did not practice|dnr|surgery|sore|limited in practice/i,
    ],
  },
  {
    category: "suspension",
    patterns: [/suspend|ped|banned|arrest|charged|dv case|disciplinary/i],
  },
  {
    category: "transaction",
    patterns: [/traded|trade\b|signs?\b|signing|release[ds]?\b|waive[ds]?\b|claimed|acquire[ds]?\b|free agent|cut\b/i],
  },
  {
    category: "depth",
    patterns: [/depth chart|named (?:the )?starter|will start|starting|benched|backup|takes over|behind\b|no\. ?2\b|wr2|rb2/i],
  },
  {
    category: "performance",
    patterns: [/breakout|sleeper|riser|faller|bust|stud|league winner|buy low|sell high|bounce.?back|regress|upside/i],
  },
];

export function classifyNews(title: string, summary = ""): NewsCategory {
  const text = `${title} ${summary}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.category;
    }
  }
  return "general";
}

export function dedupeKeyFor(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 6);
  return words.sort().join(" ");
}

export interface ArchivedNewsItem extends NewsItem {
  firstSeen: string;
  category: NewsCategory;
}

export async function ingestNews(): Promise<{ inserted: number; skipped: number }> {
  const live = await fetchNews();
  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
  const existing = new Set(
    (
      db
        .prepare("SELECT DISTINCT dedupe_key FROM news_items WHERE first_seen > ?")
        .all(cutoff) as { dedupe_key: string }[]
    ).map((row) => row.dedupe_key)
  );

  let inserted = 0;
  let skipped = 0;
  const nowIso = now.toISOString();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO news_items (id, title, link, source, published_at, first_seen, summary, category, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const run = db.transaction(() => {
    for (const item of live) {
      const key = dedupeKeyFor(item.title);
      if (key.length > 0 && existing.has(key)) {
        skipped += 1;
        continue;
      }
      const category = classifyNews(item.title, item.summary);
      const result = insert.run(
        item.id,
        item.title,
        item.link,
        item.source,
        item.publishedAt,
        nowIso,
        item.summary,
        category,
        key
      );
      if (result.changes > 0) {
        inserted += 1;
        if (key.length > 0) existing.add(key);
      }
    }
  });
  run();
  return { inserted, skipped };
}

export interface ArchiveQuery {
  q?: string;
  category?: string;
  since?: string;
  limit?: number;
}

export async function getArchivedNews(query: ArchiveQuery = {}): Promise<ArchivedNewsItem[]> {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) AS n FROM news_items").get() as { n: number }).n;
  if (count === 0) {
    await ingestNews();
  }
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (query.q) {
    conditions.push("(title LIKE ? OR summary LIKE ?)");
    params.push(`%${query.q}%`, `%${query.q}%`);
  }
  if (query.category && query.category !== "all") {
    conditions.push("category = ?");
    params.push(query.category);
  }
  if (query.since) {
    conditions.push("first_seen > ?");
    params.push(query.since);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(Math.max(query.limit ?? 200, 1), 500);
  params.push(limit);
  const rows = db
    .prepare(
      `SELECT id, title, link, source, published_at, first_seen, summary, category FROM news_items ${where} ORDER BY first_seen DESC LIMIT ?`
    )
    .all(...params) as {
    id: string;
    title: string;
    link: string;
    source: string;
    published_at: string;
    first_seen: string;
    summary: string;
    category: string;
  }[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    link: row.link,
    source: row.source,
    publishedAt: row.published_at,
    summary: row.summary,
    firstSeen: row.first_seen,
    category: row.category as NewsCategory,
  }));
}
