"use client";

import clsx from "clsx";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { formatPct } from "@/lib/format";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  onClick,
  ariaLabel,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "default" | "positive" | "negative";
  /** When provided, the whole card becomes a button — used for the home-page
   *  "This week" / "vs Last week" cards so tapping them opens a per-exercise
   *  breakdown modal. */
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const toneText =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
      ? "text-rose-400"
      : "text-zinc-50";
  const body = (
    <>
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className={clsx("mt-1 text-2xl font-semibold tabular-nums", toneText)}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-400">{hint}</div>}
    </>
  );
  if (!onClick) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `Open ${label.toLowerCase()} details`}
      className="block w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition active:scale-[0.98] hover:border-zinc-700 hover:bg-zinc-900"
    >
      {body}
    </button>
  );
}

export function DeltaPill({ pct }: { pct: number }) {
  if (!isFinite(pct) || pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
        <Minus className="h-3 w-3" />
        flat
      </span>
    );
  }
  const positive = pct > 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        positive ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
      )}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {formatPct(pct)}
    </span>
  );
}
