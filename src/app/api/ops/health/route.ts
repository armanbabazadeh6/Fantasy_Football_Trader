import { NextResponse } from "next/server";
import { getOpsReport } from "@/lib/ops";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getOpsReport();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed to build ops report.",
      },
      { status: 500 }
    );
  }
}
