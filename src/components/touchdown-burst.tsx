"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TouchdownBurstProps {
  active: boolean;
  className?: string;
}

export function TouchdownBurst({ active, className }: TouchdownBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
    };
    resize();

    const colors = ["#a3e635", "#34d399", "#f8fafc", "#fbbf24"];
    const parts = Array.from({ length: 90 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 5) * dpr;
      return {
        x: canvas.width / 2,
        y: canvas.height * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3 * dpr,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        w: (4 + Math.random() * 5) * dpr,
        h: (8 + Math.random() * 8) * dpr,
        color: colors[i % colors.length],
      };
    });

    const ball = { x: -40 * dpr, y: canvas.height * 0.2, vx: 7 * dpr, vy: -2.2 * dpr };
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const part of parts) {
        part.vy += 0.05 * dpr;
        part.x += part.vx;
        part.y += part.vy;
        part.rot += part.vr;
        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate(part.rot);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 2600);
        ctx.fillStyle = part.color;
        ctx.fillRect(-part.w / 2, -part.h / 2, part.w, part.h);
        ctx.restore();
      }

      if (elapsed < 1300) {
        ball.vy += 0.08 * dpr;
        ball.x += ball.vx;
        ball.y += ball.vy;
        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(elapsed / 70);
        ctx.fillStyle = "#a3e635";
        ctx.beginPath();
        ctx.ellipse(0, 0, 15 * dpr, 9 * dpr, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#020617";
        ctx.lineWidth = 1.8 * dpr;
        ctx.beginPath();
        ctx.moveTo(-14 * dpr, 0);
        ctx.lineTo(14 * dpr, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-5 * dpr, -4 * dpr);
        ctx.lineTo(-5 * dpr, 4 * dpr);
        ctx.moveTo(0, -5 * dpr);
        ctx.lineTo(0, 5 * dpr);
        ctx.moveTo(5 * dpr, -4 * dpr);
        ctx.lineTo(5 * dpr, 4 * dpr);
        ctx.stroke();
        ctx.restore();
      }

      if (elapsed < 2800) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      aria-hidden="true"
    />
  );
}
