import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5 bg-slate-950">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
        <p className="text-sm text-slate-500">
          Built with Next.js, Sleeper, and GLM. For personal league use. Not
          affiliated with the NFL.
        </p>
        <div className="flex items-center gap-5 text-sm text-slate-500">
          <Link href="/analyzer" className="transition-colors hover:text-volt">
            Analyzer
          </Link>
          <Link href="/players" className="transition-colors hover:text-volt">
            Players
          </Link>
          <Link href="/news" className="transition-colors hover:text-volt">
            News
          </Link>
          <a
            href="https://github.com/armanbabazadeh6/Fantasy_Football_Trader"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-volt"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
