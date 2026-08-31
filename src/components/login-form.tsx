"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign in failed.");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("Sign in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8"
      >
        <h1 className="font-display text-4xl tracking-wide text-slate-100">
          GAME <span className="text-volt">DAY</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          This league is password protected.
        </p>
        <label className="mt-6 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Password
          </span>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2.5 focus-within:border-volt/50">
            <Lock className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
              required
              className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              placeholder="Enter the password"
            />
          </div>
        </label>
        {error ? (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending || password.length === 0}
          className="mt-6 w-full rounded-lg bg-volt px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-slate-950 transition-opacity enabled:hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
