"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function NewBadge({ firstSeen, className }: { firstSeen?: string; className?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!firstSeen) return;
    try {
      const last = localStorage.getItem("fft.lastVisit");
      if (!last || firstSeen > last) {
        setShow(true);
      }
    } catch {
    }
  }, [firstSeen]);

  if (!show) return null;

  return (
    <span
      className={cn(
        "rounded bg-volt px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-950",
        className
      )}
    >
      New
    </span>
  );
}
