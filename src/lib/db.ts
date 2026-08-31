import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const globalForDb = globalThis as unknown as { __fftDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__fftDb) {
    mkdirSync(DATA_DIR, { recursive: true });
    const db = new Database(path.join(DATA_DIR, "app.db"));
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS value_history (
        player_id TEXT NOT NULL,
        date TEXT NOT NULL,
        score INTEGER NOT NULL,
        PRIMARY KEY (player_id, date)
      );
      CREATE TABLE IF NOT EXISTS saved_analyses (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        verdict TEXT NOT NULL,
        headline TEXT NOT NULL,
        give_json TEXT NOT NULL,
        get_json TEXT NOT NULL,
        give_value INTEGER,
        get_value INTEGER,
        ai_used INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS watchlist (
        player_id TEXT PRIMARY KEY,
        added_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS refresh_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        players INTEGER,
        news INTEGER,
        ok INTEGER
      );
      CREATE TABLE IF NOT EXISTS projections (
        player_id TEXT NOT NULL,
        season INTEGER NOT NULL,
        projected_total REAL NOT NULL,
        projected_ppg REAL NOT NULL,
        fetched_at TEXT NOT NULL,
        PRIMARY KEY (player_id, season)
      );
      CREATE TABLE IF NOT EXISTS weekly_projections (
        player_id TEXT NOT NULL,
        season INTEGER NOT NULL,
        week INTEGER NOT NULL,
        points REAL NOT NULL,
        fetched_at TEXT NOT NULL,
        PRIMARY KEY (player_id, season, week)
      );
      CREATE TABLE IF NOT EXISTS news_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        link TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        published_at TEXT NOT NULL,
        first_seen TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'general',
        dedupe_key TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_news_first_seen ON news_items (first_seen);
      CREATE INDEX IF NOT EXISTS idx_news_category ON news_items (category);
      CREATE INDEX IF NOT EXISTS idx_news_dedupe ON news_items (dedupe_key);
    `);
    try {
      db.exec("ALTER TABLE refresh_log ADD COLUMN error TEXT");
    } catch {
    }
    globalForDb.__fftDb = db;
  }
  return globalForDb.__fftDb;
}
