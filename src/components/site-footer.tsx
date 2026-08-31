import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/analyzer", label: "Analyzer" },
  { href: "/players", label: "Players" },
  { href: "/news", label: "News" },
  { href: "/ops", label: "Ops" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <p className="text-sm text-slate-400">
          Built with Next.js, Sleeper, and GLM. For personal league use. Not
          affiliated with the NFL.
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-slate-400"
          aria-label="Footer"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center py-2 transition-colors hover:text-volt"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/armanbabazadeh6/Fantasy_Football_Trader"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center py-2 transition-colors hover:text-volt"
          >
            GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
