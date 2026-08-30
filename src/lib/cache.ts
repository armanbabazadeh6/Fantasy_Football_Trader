import { promises as fs } from "fs";
import path from "path";

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const memory = new Map<string, CacheEntry<unknown>>();
const CACHE_DIR = path.join(process.cwd(), ".cache");

function fileForKey(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function getCached<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.expires > now) {
    return hit.value as T;
  }
  try {
    const raw = await fs.readFile(fileForKey(key), "utf8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (entry.expires > now) {
      memory.set(key, entry);
      return entry.value;
    }
  } catch {
  }
  const value = await loader();
  const entry: CacheEntry<T> = { value, expires: Date.now() + ttlMs };
  memory.set(key, entry);
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(fileForKey(key), JSON.stringify(entry), "utf8");
  } catch {
  }
  return value;
}

export function clearMemoryCache(): void {
  memory.clear();
}
