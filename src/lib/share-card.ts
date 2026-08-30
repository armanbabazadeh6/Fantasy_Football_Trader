import type { AnalyzeResponse } from "@/types";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 675;

const VERDICT_COLORS: Record<string, string> = {
  ACCEPT: "#34d399",
  LEAN_ACCEPT: "#a3e635",
  FAIR: "#38bdf8",
  COUNTER: "#fbbf24",
  LEAN_DECLINE: "#fb923c",
  DECLINE: "#fb7185",
};

const VERDICT_LABELS: Record<string, string> = {
  ACCEPT: "ACCEPT",
  LEAN_ACCEPT: "LEAN ACCEPT",
  FAIR: "FAIR DEAL",
  COUNTER: "COUNTER",
  LEAN_DECLINE: "LEAN DECLINE",
  DECLINE: "DECLINE",
};

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function wrapText(text: string, maxLength: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length === 0) {
      line = word;
    } else if (`${line} ${word}`.length <= maxLength) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (lines.length < maxLines && line.length > 0) lines.push(line);
  return lines;
}

function playerLines(players: AnalyzeResponse["give"]): string[] {
  const shown = players.slice(0, 5);
  const extra = players.length - shown.length;
  const lines = shown.map(
    (player) => `${player.name} (${player.position}) — ${player.value.score ?? "no data"}`
  );
  if (extra > 0) lines.push(`+ ${extra} more`);
  return lines;
}

export function buildCardSvg(result: AnalyzeResponse, verdict: string): string {
  const color = VERDICT_COLORS[verdict] ?? "#94a3b8";
  const label = VERDICT_LABELS[verdict] ?? escapeXml(verdict);
  const giveValue = result.engine.giveValue;
  const getValue = result.engine.getValue;
  const diff = result.engine.diff;
  const headline =
    result.ai?.headline ?? `${diff >= 0 ? "+" : ""}${diff} value differential`;

  const yardLines: string[] = [];
  for (let x = 100; x < CARD_WIDTH; x += 100) {
    yardLines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${CARD_HEIGHT}" stroke="#1e293b" stroke-width="1"/>`
    );
  }

  const giveLines = playerLines(result.give);
  const getLines = playerLines(result.get);

  const giveText = giveLines
    .map(
      (line, index) =>
        `<text x="70" y="${418 + index * 34}" font-size="24" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`
    )
    .join("");
  const getText = getLines
    .map(
      (line, index) =>
        `<text x="640" y="${418 + index * 34}" font-size="24" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`
    )
    .join("");

  const headlineLines = wrapText(headline, 62, 2);
  const headlineText = headlineLines
    .map(
      (line, index) =>
        `<text x="600" y="${566 + index * 34}" font-size="26" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${escapeXml(line)}</text>`
    )
    .join("");

  const confidence = result.ai?.confidence;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">
  <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#020617"/>
  ${yardLines.join("")}
  <g>
    <ellipse cx="66" cy="62" rx="30" ry="19" transform="rotate(-42 66 62)" fill="#a3e635"/>
    <path d="M60 57 L66 63 M66 57 L60 63 M70 67 L76 73 M76 67 L70 73" stroke="#020617" stroke-width="3" stroke-linecap="round"/>
  </g>
  <text x="110" y="74" font-size="34" font-weight="900" fill="#f1f5f9" font-family="Arial, Helvetica, sans-serif">FANTASY FOOTBALL TRADER</text>
  <text x="${CARD_WIDTH - 40}" y="74" font-size="22" fill="#475569" font-family="Arial, Helvetica, sans-serif" text-anchor="end">TRADE VERDICT</text>
  <line x1="40" y1="100" x2="${CARD_WIDTH - 40}" y2="100" stroke="#1e293b" stroke-width="1"/>
  <text x="600" y="220" font-size="120" font-weight="900" fill="${color}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${label}</text>
  <text x="600" y="268" font-size="24" fill="#64748b" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">Send ${giveValue}  &#8596;  Receive ${getValue}   (${diff >= 0 ? "+" : ""}${diff} to you)${typeof confidence === "number" ? `   ·   ${confidence}% confidence` : ""}</text>
  <rect x="40" y="320" width="530" height="40" rx="8" fill="#fb7185" opacity="0.12"/>
  <text x="60" y="348" font-size="24" font-weight="bold" fill="#fb7185" font-family="Arial, Helvetica, sans-serif">YOU SEND</text>
  <rect x="630" y="320" width="530" height="40" rx="8" fill="#34d399" opacity="0.12"/>
  <text x="650" y="348" font-size="24" font-weight="bold" fill="#34d399" font-family="Arial, Helvetica, sans-serif">YOU RECEIVE</text>
  ${giveText}
  ${getText}
  ${headlineText}
  <line x1="40" y1="620" x2="${CARD_WIDTH - 40}" y2="620" stroke="#1e293b" stroke-width="1"/>
  <text x="40" y="650" font-size="18" fill="#475569" font-family="Arial, Helvetica, sans-serif">Analyzed with real NFL stats, news, and injuries — 12-team PPR</text>
  <text x="${CARD_WIDTH - 40}" y="650" font-size="18" fill="#475569" font-family="Arial, Helvetica, sans-serif" text-anchor="end">${escapeXml(
    new Date(result.generatedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  )}${result.ai ? " · AI analyst" : " · rule engine"}</text>
</svg>`;
}
