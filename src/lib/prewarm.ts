export async function runPrewarm(): Promise<void> {
  const { startBackgroundRefresh } = await import("./nfl-data");
  startBackgroundRefresh();

  const { getPlayerSummaries } = await import("./nfl-data");
  const { fetchTeamByeWeeks, getCurrentWeek } = await import("./schedule");

  await Promise.allSettled([
    getPlayerSummaries(),
    fetchTeamByeWeeks(),
    getCurrentWeek(),
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
