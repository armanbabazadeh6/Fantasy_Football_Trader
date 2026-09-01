export async function runPrewarm(): Promise<void> {
  const { startBackgroundRefresh } = await import("./nfl-data");
  startBackgroundRefresh();

  const { computeAllPlayers, getPlayerSummaries, getTrendingSummaries } = await import(
    "./nfl-data"
  );
  const { fetchTeamByeWeeks, getCurrentWeek, fetchWeekMatchups } = await import(
    "./schedule"
  );
  const { getArchivedNews } = await import("./news-archive");
  const { getEspnProjections } = await import("./projections");

  const currentWeek = await getCurrentWeek();
  await Promise.allSettled([
    computeAllPlayers(),
    getPlayerSummaries(),
    getTrendingSummaries(30),
    fetchTeamByeWeeks(),
    fetchWeekMatchups(Math.max(1, currentWeek + 1)),
    getArchivedNews({ limit: 60 }),
    Promise.resolve(getEspnProjections()),
  ]);
  console.log("[fft] boot prewarm complete");

  const port = process.env.PORT || "3000";
  setTimeout(() => {
    void (async () => {
      try {
        await Promise.allSettled([
          fetch(`http://127.0.0.1:${port}/`, { cache: "no-store" }),
          fetch(`http://127.0.0.1:${port}/players`, { cache: "no-store" }),
        ]);
        console.log("[fft] route warmup complete");
      } catch {
      }
    })();
  }, 3000);
}

void runPrewarm().catch((err) => {
  console.error("[fft] boot prewarm failed:", err);
});
