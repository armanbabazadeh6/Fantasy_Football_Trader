import { XMLParser } from "fast-xml-parser";
import { getCached } from "./cache";
import type { NewsItem, NFLPlayer } from "@/types";

const NEWS_TTL = 8 * 60 * 1000;

const SOURCES = [
  { name: "ESPN", url: "https://www.espn.com/espn/rss/nfl/news" },
  { name: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/nfl/" },
  { name: "Yahoo Sports", url: "https://sports.yahoo.com/nfl/rss/" },
  { name: "ProFootballTalk", url: "https://profootballtalk.nbcsports.com/feed/" },
  { name: "Rotoballer", url: "https://www.rotoballer.com/rss" },
  { name: "Yahoo Fantasy", url: "https://sports.yahoo.com/fantasy/rss/" },
  { name: "Sleeper Blog", url: "https://blog.sleeper.com/feed/" },
];

const GOOGLE_NEWS_QUERIES = [
  "NFL+fantasy+football",
  "NFL+injury",
  "NFL+when:1d",
];

const parser = new XMLParser({ ignoreAttributes: true });

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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

async function loadEspnApiNews(): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50",
      {
        headers: { "user-agent": BROWSER_UA, accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      articles?: {
        headline?: string;
        description?: string;
        published?: string;
        links?: { web?: { href?: string } };
      }[];
    };
    const items: NewsItem[] = [];
    for (const article of json.articles ?? []) {
      const title = stripHtml(article.headline ?? "");
      if (!title) continue;
      items.push({
        id: `espn-api:${title.toLowerCase().replace(/\s+/g, "-")}`,
        title,
        link: article.links?.web?.href ?? "",
        source: "ESPN",
        publishedAt: article.published
          ? new Date(article.published).toISOString()
          : new Date(0).toISOString(),
        summary: stripHtml(article.description ?? "").slice(0, 280),
      });
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function splitGoogleNewsTitle(title: string): { title: string; publisher: string } {
  const separator = title.lastIndexOf(" - ");
  if (separator > 20 && separator < title.length - 3) {
    return {
      title: title.slice(0, separator).trim(),
      publisher: title.slice(separator + 3).trim(),
    };
  }
  return { title, publisher: "Google News" };
}

async function loadGoogleNews(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": BROWSER_UA },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = toItems(parser.parse(xml), "Google News");
    return items.map((item) => {
      const split = splitGoogleNewsTitle(item.title);
      return {
        ...item,
        title: split.title,
        source: split.publisher,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchNews(): Promise<NewsItem[]> {
  return getCached<NewsItem[]>("nfl_news_v4", NEWS_TTL, async () => {
    const loaders: Promise<NewsItem[]>[] = SOURCES.map((source) => loadSource(source));
    loaders.push(loadEspnApiNews());
    for (const query of GOOGLE_NEWS_QUERIES) {
      loaders.push(loadGoogleNews(query));
    }
    const settled = await Promise.allSettled(loaders);
    const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
    return deduped.slice(0, 300);
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
