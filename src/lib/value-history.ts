import { getDb } from "./db";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const globalForDaily = globalThis as unknown as {
  __fftDailyRecordedDate?: string;
};

export function recordDailyScores(scores: Map<string, number>): number {
  const db = getDb();
  const date = today();
  if (globalForDaily.__fftDailyRecordedDate === date) {
    let count = 0;
    for (const score of scores.values()) {
      if (Number.isFinite(score)) count += 1;
    }
    return count;
  }
  const insert = db.prepare(
    "INSERT OR IGNORE INTO value_history (player_id, date, score) VALUES (?, ?, ?)"
  );
  const run = db.transaction((entries: [string, number][]) => {
    for (const [playerId, score] of entries) {
      insert.run(playerId, date, Math.round(score));
    }
  });
  const entries = [...scores.entries()].filter(([, score]) => Number.isFinite(score));
  run(entries);
  globalForDaily.__fftDailyRecordedDate = date;
  return entries.length;
}

export function computeValueTrends(current: Map<string, number>): Map<string, number> {
  const db = getDb();
  const trends = new Map<string, number>();
  const priorDate = db
    .prepare("SELECT MAX(date) AS d FROM value_history WHERE date < ?")
    .get(today()) as { d: string | null } | undefined;
  const date = priorDate?.d;
  if (!date) return trends;
  const rows = db
    .prepare("SELECT player_id, score FROM value_history WHERE date = ?")
    .all(date) as { player_id: string; score: number }[];
  const prior = new Map(rows.map((row) => [row.player_id, row.score]));
  for (const [playerId, score] of current) {
    const before = prior.get(playerId);
    if (typeof before === "number") {
      const delta = Math.round(score - before);
      if (delta !== 0) trends.set(playerId, delta);
    }
  }
  return trends;
}

export function getPlayerValueHistory(
  playerId: string,
  limit = 30
): { date: string; score: number }[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT date, score FROM value_history WHERE player_id = ? ORDER BY date DESC LIMIT ?"
    )
    .all(playerId, limit) as { date: string; score: number }[];
  return rows.reverse();
}
