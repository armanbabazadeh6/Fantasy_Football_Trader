import { NextResponse } from "next/server";
import { getPlayerSummaries } from "@/lib/nfl-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await getPlayerSummaries();
    const header = "rank,name,position,team,age,value,tier,ppg,games,pos_rank,bye_week,injury";
    const lines = players.map((player, index) => {
      const cells = [
        index + 1,
        `"${player.name.replace(/"/g, '""')}"`,
        player.position,
        player.team ?? "FA",
        player.age ?? "",
        player.value.score ?? "",
        `"${player.value.tier ?? ""}"`,
        player.value.ppg ?? "",
        player.value.games ?? "",
        player.posRank ?? "",
        player.byeWeek ?? "",
        player.injuryStatus ?? "",
      ];
      return cells.join(",");
    });
    const csv = [header, ...lines].join("\n");
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="fft-value-board-${date}.csv"`,
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Export failed." }, { status: 500 });
  }
}
