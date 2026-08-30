import type { AITradeAnalysis, Verdict } from "@/types";

const VERDICTS: Verdict[] = [
  "ACCEPT",
  "LEAN_ACCEPT",
  "FAIR",
  "COUNTER",
  "LEAN_DECLINE",
  "DECLINE",
];

export function aiConfigured(): boolean {
  return Boolean(process.env.AI_BASE_URL && process.env.AI_API_KEY);
}

export function aiModel(): string {
  return process.env.AI_MODEL || "openference/GLM-5.3";
}

const SYSTEM_PROMPT = `You are FFT Analyst, an elite fantasy football trade evaluator for a 12-team PPR league.
You receive a JSON payload describing a proposed trade: the players the user would send away, the players the user would receive, real NFL stats, consistency metrics, injury status, trending data, recent news headlines, computed trade values, and optional roster context.

Evaluate the trade strictly from the perspective of the SENDING team (the user). Weigh total value, positional scarcity, roster needs, age, injury risk, and recent news. Be decisive and concrete. Cite the numbers provided in the payload. Never invent statistics that are not in the payload.

Respond with ONLY a valid JSON object, no markdown fences, matching exactly this schema:
{
  "verdict": "ACCEPT" | "LEAN_ACCEPT" | "FAIR" | "COUNTER" | "LEAN_DECLINE" | "DECLINE",
  "confidence": <integer 0-100>,
  "headline": "<short punchy headline, max 90 chars>",
  "summary": "<2-4 sentence executive summary of who wins the trade and why>",
  "key_factors": ["<3-6 data-driven factors>"],
  "risks": ["<2-4 risks or red flags>"],
  "news_impact": ["<recent news takeaways affecting this trade>"],
  "counter_ideas": ["<if verdict is COUNTER: concrete counter proposals; otherwise optional suggestions>"],
  "final_word": "<one sentence bottom line>"
}
Guidelines: use ACCEPT or DECLINE for clear calls, LEAN_ACCEPT / LEAN_DECLINE / FAIR for close calls, and COUNTER when the framework of the deal is right but the terms are off. Confidence reflects how certain you are of the call, not how good the trade is. If a player has no stats because they are a rookie, factor in upside and news instead.`;

export async function aiAnalyzeTrade(dataJson: string): Promise<AITradeAnalysis | null> {
  const base = (process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const apiKey = process.env.AI_API_KEY;
  if (!base || !apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: aiModel(),
        temperature: 0.3,
        max_tokens: 2400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: dataJson },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return parseAnalysis(content);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseAnalysis(content: string): AITradeAnalysis | null {
  let text = content.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const verdict = String(parsed.verdict ?? "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!VERDICTS.includes(verdict as Verdict)) return null;
  return {
    verdict: verdict as Verdict,
    confidence: clampNum(Number(parsed.confidence), 0, 100, 70),
    headline: String(parsed.headline ?? "").slice(0, 200) || "Trade analysis complete",
    summary: String(parsed.summary ?? ""),
    key_factors: toStringArray(parsed.key_factors, 6),
    risks: toStringArray(parsed.risks, 5),
    news_impact: toStringArray(parsed.news_impact, 5),
    counter_ideas: toStringArray(parsed.counter_ideas, 4),
    final_word: String(parsed.final_word ?? ""),
  };
}

function toStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim().slice(0, 400))
    .slice(0, max);
}

function clampNum(value: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(value)));
}
