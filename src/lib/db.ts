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
    `);
    globalForDb.__fftDb = db;
  }
  return globalForDb.__fftDb;
}
