"use client";

import { useState } from "react";
import { Check, Download } from "lucide-react";
import { buildCardSvg, CARD_HEIGHT, CARD_WIDTH } from "@/lib/share-card";
import type { AnalyzeResponse } from "@/types";

export function ShareVerdictButton({ result }: { result: AnalyzeResponse }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  async function download() {
    setState("busy");
    try {
      const verdict = result.ai?.verdict ?? result.engine.verdict;
      const svg = buildCardSvg(result, verdict);
      const img = new Image();
      img.crossOrigin = "anonymous";
      const blob = await new Promise<Blob | null>((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = CARD_WIDTH;
          canvas.height = CARD_HEIGHT;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((png) => resolve(png), "image/png");
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
      if (blob) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "fft-trade-verdict.png";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        setState("done");
        setTimeout(() => setState("idle"), 2500);
        return;
      }
    } catch {
    }
    setState("idle");
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={state === "busy"}
      className="flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-40"
    >
      {state === "done" ? (
        <Check className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {state === "done" ? "Downloaded" : state === "busy" ? "Rendering..." : "Share verdict"}
    </button>
  );
}
