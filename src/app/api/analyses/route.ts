import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { PlayerSummary } from "@/types";

export const dynamic = "force-dynamic";

interface SavedAnalysisRow {
  id: string;
  created_at: string;
  verdict: string;
  headline: string;
  give_json: string;
  get_json: string;
  give_value: number | null;
  get_value: number | null;
  ai_used: number;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM saved_analyses ORDER BY created_at DESC LIMIT 25")
      .all() as SavedAnalysisRow[];
    return NextResponse.json({
      ok: true,
      analyses: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        verdict: row.verdict,
        headline: row.headline,
        give: JSON.parse(row.give_json) as PlayerSummary[],
        get: JSON.parse(row.get_json) as PlayerSummary[],
        giveValue: row.give_value ?? 0,
        getValue: row.get_value ?? 0,
        aiUsed: row.ai_used === 1,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to load analyses." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as {
      give?: PlayerSummary[];
      get?: PlayerSummary[];
      verdict?: string;
      headline?: string;
      giveValue?: number;
      getValue?: number;
      aiUsed?: boolean;
    } | null;
    if (
      !Array.isArray(body?.give) ||
      !Array.isArray(body?.get) ||
      body!.give!.length === 0 ||
      body!.get!.length === 0 ||
      !body?.verdict
    ) {
      return NextResponse.json(
        { ok: false, error: "give, get, and verdict are required." },
        { status: 400 }
      );
    }
    const db = getDb();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    db.prepare(
      "INSERT INTO saved_analyses (id, created_at, verdict, headline, give_json, get_json, give_value, get_value, ai_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      new Date().toISOString(),
      body!.verdict!,
      body!.headline ?? "Trade analysis",
      JSON.stringify(body!.give),
      JSON.stringify(body!.get),
      Math.round(body?.giveValue ?? 0),
      Math.round(body?.getValue ?? 0),
      body?.aiUsed ? 1 : 0
    );
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to save analysis." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id required." }, { status: 400 });
    }
    const db = getDb();
    db.prepare("DELETE FROM saved_analyses WHERE id = ?").run(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to delete." }, { status: 500 });
  }
}
