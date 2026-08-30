export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleMentionsPlayer(playerName: string, title: string, summary = ""): boolean {
  const player = normalizeForMatch(playerName);
  if (!player) return false;
  const haystack = normalizeForMatch(`${title} ${summary}`);
  return haystack.includes(player);
}
