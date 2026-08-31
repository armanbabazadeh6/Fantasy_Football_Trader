import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { getDb } from "./db";

export type EspnSessionStatus = "ok" | "expired" | "untested";

export interface EspnSessionState {
  status: EspnSessionStatus;
  leagueId: string | null;
  updatedAt: string | null;
  lastOkAt: string | null;
  lastFailAt: string | null;
}

const globalForTable = globalThis as unknown as { __fftEspnSessionReady?: boolean };

function ensureTable(db: Database.Database): void {
  if (globalForTable.__fftEspnSessionReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS espn_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      cookie TEXT NOT NULL,
      league_id TEXT,
      updated_at TEXT NOT NULL,
      last_ok_at TEXT,
      last_fail_at TEXT,
      status TEXT NOT NULL DEFAULT 'untested'
    )
  `);
  globalForTable.__fftEspnSessionReady = true;
}

function sessionKeyPath(): string {
  return path.join(process.cwd(), "data", "session.key");
}

function loadSessionKey(): Buffer {
  const keyPath = sessionKeyPath();
  if (existsSync(keyPath)) {
    const key = readFileSync(keyPath);
    if (key.length === 32) return key;
  }
  mkdirSync(path.dirname(keyPath), { recursive: true });
  const key = randomBytes(32);
  writeFileSync(keyPath, key, { mode: 0o600 });
  return key;
}

const globalForKey = globalThis as unknown as { __fftSessionKey?: Buffer };

function sessionKey(): Buffer {
  if (!globalForKey.__fftSessionKey) {
    globalForKey.__fftSessionKey = loadSessionKey();
  }
  return globalForKey.__fftSessionKey;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string | null {
  try {
    const [ivPart, tagPart, dataPart] = payload.split(".");
    if (!ivPart || !tagPart || !dataPart) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      sessionKey(),
      Buffer.from(ivPart, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataPart, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

export function saveEspnSessionCookie(cookie: string): void {
  const clean = cookie.replace(/^cookie\s*:\s*/i, "").replace(/[\r\n]+/g, " ").trim();
  if (clean.length === 0) return;
  const db = getDb();
  ensureTable(db);
  db.prepare(
    `INSERT INTO espn_session (id, cookie, updated_at, status)
     VALUES (1, ?, ?, 'untested')
     ON CONFLICT(id) DO UPDATE SET cookie = excluded.cookie, updated_at = excluded.updated_at, status = 'untested'`
  ).run(encryptSecret(clean), new Date().toISOString());
}

export function getEspnSessionCookie(): string | null {
  const db = getDb();
  ensureTable(db);
  const row = db
    .prepare("SELECT cookie FROM espn_session WHERE id = 1")
    .get() as { cookie: string } | undefined;
  if (!row) return null;
  return decryptSecret(row.cookie);
}

export function rememberEspnLeagueId(leagueId: string): void {
  const db = getDb();
  ensureTable(db);
  db.prepare("UPDATE espn_session SET league_id = ? WHERE id = 1").run(leagueId);
}

export function recordEspnSessionResult(ok: boolean): void {
  const db = getDb();
  ensureTable(db);
  const now = new Date().toISOString();
  const has = db.prepare("SELECT 1 AS x FROM espn_session WHERE id = 1").get();
  if (!has) return;
  if (ok) {
    db.prepare(
      "UPDATE espn_session SET last_ok_at = ?, status = 'ok' WHERE id = 1"
    ).run(now);
  } else {
    db.prepare(
      "UPDATE espn_session SET last_fail_at = ?, status = 'expired' WHERE id = 1"
    ).run(now);
  }
}

export function getEspnSessionState(): EspnSessionState {
  const db = getDb();
  ensureTable(db);
  const row = db
    .prepare(
      "SELECT league_id, updated_at, last_ok_at, last_fail_at, status FROM espn_session WHERE id = 1"
    )
    .get() as {
    league_id: string | null;
    updated_at: string;
    last_ok_at: string | null;
    last_fail_at: string | null;
    status: string;
  } | undefined;
  if (!row) {
    return {
      status: "untested",
      leagueId: null,
      updatedAt: null,
      lastOkAt: null,
      lastFailAt: null,
    };
  }
  return {
    status: row.status === "ok" || row.status === "expired" ? row.status : "untested",
    leagueId: row.league_id,
    updatedAt: row.updated_at,
    lastOkAt: row.last_ok_at,
    lastFailAt: row.last_fail_at,
  };
}

export function clearEspnSession(): void {
  const db = getDb();
  db.prepare("DELETE FROM espn_session WHERE id = 1").run();
}

export function mergeSetCookies(
  existingCookie: string,
  setCookieHeaders: string[]
): string | null {
  if (setCookieHeaders.length === 0) return null;
  const pairs = new Map<string, string>();
  for (const pair of existingCookie.split(";")) {
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name.length > 0) pairs.set(name, value);
  }
  let changed = false;
  for (const header of setCookieHeaders) {
    const main = header.split(";")[0];
    const eq = main.indexOf("=");
    if (eq <= 0) continue;
    const name = main.slice(0, eq).trim();
    const value = main.slice(eq + 1).trim();
    if (name.length === 0) continue;
    if (pairs.get(name) !== value) {
      pairs.set(name, value);
      changed = true;
    }
  }
  if (!changed) return null;
  return [...pairs.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}
