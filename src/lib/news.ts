import { XMLParser } from "fast-xml-parser";
import { getCached } from "./cache";
import type { NewsItem, NFLPlayer } from "@/types";

const NEWS_TTL = 15 * 60 * 1000;

const SOURCES = [
  { name: "ESPN", url: "https://www.espn.com/espn/rss/nfl/news" },
  { name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/nfl/" },
  { name: "Yahoo Sports", url: "https://sports.yahoo.com/nfl/rss/" },
  { name: "ProFootballTalk", url: "https://profootballtalk.nbcsports.com/feed/" },
];

const parser = new XMLParser({ ignoreAttributes: true });

function stripHtml(input: string): string {
  let text = input.replace(/<[^>]*>/g, " ");
  for (let pass = 0; pass < 2; pass++) {
    text = text
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
        try {
          return String.fromCodePoint(parseInt(code, 16));
        } catch {
          return " ";
        }
      })
      .replace(/&#(\d+);/g, (_, code) => {
        try {
          return String.fromCodePoint(Number(code));
        } catch {
          return " ";
        }
      })
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  return text.replace(/\s+/g, " ").trim();
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface FeedItemShape {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  summary?: string;
}

function toItems(parsed: unknown, source: string): NewsItem[] {
  const channel = (parsed as { rss?: { channel?: { item?: unknown } } })?.rss?.channel;
  const rawItems = channel?.item;
  if (!rawItems) return [];
  const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
  const items: NewsItem[] = [];
  for (const entry of arr) {
    const item = entry as FeedItemShape;
    const title = stripHtml(item.title ?? "");
    if (!title) continue;
    const summary = stripHtml(item.description ?? item.summary ?? "").slice(0, 280);
    const link = typeof item.link === "string" ? item.link : "";
    items.push({
      id: `${source}:${title}`.toLowerCase().replace(/\s+/g, "-"),
      title,
      link,
      source,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date(0).toISOString(),
      summary,
    });
  }
  return items;
}

async function loadSource(source: { name: string; url: string }): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; FFTBot/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return toItems(parser.parse(xml), source.name);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchNews(): Promise<NewsItem[]> {
  return getCached<NewsItem[]>("nfl_news_v2", NEWS_TTL, async () => {
    const settled = await Promise.allSettled(SOURCES.map(loadSource));
    const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    return deduped.slice(0, 200);
  });
}

export function matchNewsForPlayer(
  items: NewsItem[],
  player: NFLPlayer,
  limit = 4,
  maxAgeDays = 45
): NewsItem[] {
  const normalized = normalizeName(player.name);
  if (!normalized) return [];
  const parts = normalized.split(" ");
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  if (!first || !last) return [];
  const team = player.team?.toLowerCase() ?? "";
  const teamName = TEAM_NICKNAMES[team] ?? "";
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const matched: NewsItem[] = [];
  for (const item of items) {
    const hay = normalizeName(`${item.title} ${item.summary}`);
    if (!hay) continue;
    const ts = Date.parse(item.publishedAt);
    if (ts < cutoff) continue;
    const fullNameHit = hay.includes(normalized);
    const initialHit = hay.includes(`${first} ${last}`) && hay.includes(`${first[0]} ${last}`);
    const teamHit =
      hay.includes(last) && (teamName ? hay.includes(teamName) : false);
    if (fullNameHit || initialHit || (teamHit && hay.includes(first[0]))) {
      matched.push(item);
      if (matched.length >= limit) break;
    }
  }
  return matched;
}

const TEAM_NICKNAMES: Record<string, string> = {
  ari: "cardinals",
  atl: "falcons",
  bal: "ravens",
  buf: "bills",
  car: "panthers",
  chi: "bears",
  cin: "bengals",
  cle: "browns",
  dal: "cowboys",
  den: "broncos",
  det: "lions",
  gb: "packers",
  hou: "texans",
  ind: "colts",
  jax: "jaguars",
  kc: "chiefs",
  lv: "raiders",
  lac: "chargers",
  lar: "rams",
  mia: "dolphins",
  min: "vikings",
  ne: "patriots",
  no: "saints",
  nyg: "giants",
  nyj: "jets",
  phi: "eagles",
  pit: "steelers",
  sf: "49ers",
  sea: "seahawks",
  tb: "buccaneers",
  ten: "titans",
  was: "commanders",
};
