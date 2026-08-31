"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.15c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.15c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: "/analyzer", label: "Analyzer" },
  { href: "/lineup", label: "Lineup" },
  { href: "/players", label: "Players" },
  { href: "/waiver", label: "Waiver" },
  { href: "/news", label: "News" },
  { href: "/league", label: "League" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    try {
      const previous = localStorage.getItem("fft.sessionVisit");
      if (previous) {
        localStorage.setItem("fft.lastVisit", previous);
      }
      localStorage.setItem("fft.sessionVisit", new Date().toISOString());
    } catch {
    }
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <svg
            viewBox="0 0 64 64"
            className="h-8 w-8 transition-transform group-hover:rotate-[-12deg]"
            aria-hidden="true"
          >
            <rect width="64" height="64" rx="14" fill="#0b1220" stroke="rgba(163,230,53,0.4)" />
            <ellipse
              cx="32"
              cy="32"
              rx="17"
              ry="11"
              transform="rotate(-45 32 32)"
              fill="#a3e635"
            />
            <path
              d="M27 27 L31 31 M31 27 L27 31 M33 33 L37 37 M37 33 L33 37"
              stroke="#020617"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path d="M29 29 L35 35" stroke="#020617" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="font-display text-xl tracking-wide text-slate-100">
              FANTASY FOOTBALL TRADER
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
              AI Trade Analyzer
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-volt/15 text-volt"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-volt/30 bg-volt/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-volt md:inline-block">
            12-Team PPR
          </span>
          <a
            href="https://github.com/armanbabazadeh6/Fantasy_Football_Trader"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg p-2.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100 sm:block"
            aria-label="GitHub repository"
          >
            <GithubMark className="h-5 w-5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/5 hover:text-slate-100 sm:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          "overflow-hidden border-white/5 bg-slate-950/95 backdrop-blur-md transition-[max-height] duration-200 ease-out sm:hidden",
          open ? "max-h-96 border-t" : "max-h-0"
        )}
      >
        <nav className="mx-auto max-w-7xl px-4 py-3" aria-label="Mobile">
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "block rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-volt/15 text-volt"
                        : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-white/5 px-3 pt-3">
            <span className="rounded-full border border-volt/30 bg-volt/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-volt">
              12-Team PPR
            </span>
            <a
              href="https://github.com/armanbabazadeh6/Fantasy_Football_Trader"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-100"
              aria-label="GitHub repository"
            >
              <GithubMark className="h-5 w-5" />
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
