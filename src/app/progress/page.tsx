"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { Trophy, TrendingUp, TrendingDown, Info, X, Search } from "lucide-react";
import clsx from "clsx";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { useExercises, useWorkouts } from "@/lib/hooks";
import { personalRecord, progressByExercise } from "@/lib/stats";
import { formatDate, formatPct, formatVolume, formatWeight } from "@/lib/format";

type Metric = "maxWeight" | "totalVolume" | "estimated1RM" | "totalReps";

const METRICS: { value: Metric; label: string; unit: string; help: string }[] = [
  {
    value: "maxWeight",
    label: "Max weight",
    unit: "kg",
    help: "Heaviest single set on a given day",
  },
  {
    value: "totalVolume",
    label: "Total volume",
    unit: "kg",
    help: "Sum of weight × reps for that day",
  },
  {
    value: "estimated1RM",
    label: "Est. 1RM",
    unit: "kg",
    help: "Epley formula: weight × (1 + reps/30) of your top set",
  },
  {
    value: "totalReps",
    label: "Total reps",
    unit: "reps",
    help: "Sum of reps across all sets",
  },
];

export default function ProgressPage() {
  const workouts = useWorkouts();
  const exercises = useExercises();

  const used = useMemo(() => {
    const ids = new Set<string>();
    for (const w of workouts) for (const e of w.exercises) ids.add(e.exerciseId);
    return Array.from(ids)
      .map((id) => exercises.find((e) => e.id === id))
      .filter(Boolean) as typeof exercises;
  }, [workouts, exercises]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("maxWeight");
  const [showGlossary, setShowGlossary] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (used.length > 0 && !selectedId) setSelectedId(used[0].id);
  }, [used, selectedId]);

  // Case-insensitive substring match on exercise name. Empty query shows all
  // used exercises (sorted alphabetically) so first-time visitors still see
  // something scrollable instead of an empty box.
  const filteredExercises = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...used].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return sorted;
    return sorted.filter((ex) => ex.name.toLowerCase().includes(needle));
  }, [used, query]);

  // Highlight the matching substring in each result so the user can see
  // *why* a result matched (or that a near-miss is "close but not it").
  function highlightMatch(name: string, needle: string) {
    if (!needle) return name;
    const lower = name.toLowerCase();
    const idx = lower.indexOf(needle.toLowerCase());
    if (idx < 0) return name;
    return (
      <>
        {name.slice(0, idx)}
        <span className="bg-emerald-500/20 text-emerald-300 rounded-sm">
          {name.slice(idx, idx + needle.length)}
        </span>
        {name.slice(idx + needle.length)}
      </>
    );
  }

  const points = useMemo(
    () => (selectedId ? progressByExercise(workouts, selectedId) : []),
    [workouts, selectedId]
  );
  const pr = useMemo(
    () => (selectedId ? personalRecord(workouts, selectedId) : null),
    [workouts, selectedId]
  );

  // Headline change: latest point vs previous
  const headline = useMemo(() => {
    if (points.length < 2) return null;
    const last = points[points.length - 1][metric];
    const prev = points[points.length - 2][metric];
    const delta = last - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : last > 0 ? 100 : 0;
    return { last, prev, delta, pct };
  }, [points, metric]);

  // format helpers
  const formatVal = (v: number) => {
    if (metric === "totalReps") return v.toString();
    return formatWeight(v);
  };

  // 8-week window
  const window = points.slice(-12);
  const chartData = window.map((p) => ({
    date: p.date,
    label: formatDate(p.date),
    value: Math.round(p[metric] * 10) / 10,
  }));

  const isEmpty = points.length === 0;

  return (
    <PageShell>
      <PageHeader
        title="Progress"
        subtitle="Track improvements over time"
        right={
          <button
            onClick={() => setShowGlossary(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800"
            aria-label="Glossary"
          >
            <Info className="h-5 w-5" />
          </button>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        {/* Exercise search */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises…"
              className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-900/60 pl-9 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
            />
          </div>

          {used.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-center text-sm text-zinc-400">
              Log a workout first to see progress.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/40">
              {filteredExercises.length === 0 ? (
                <div className="p-4 text-center text-sm text-zinc-500">
                  No exercises match &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <ul className="divide-y divide-zinc-800/60">
                  {filteredExercises.map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(ex.id);
                          setQuery("");
                          searchRef.current?.blur();
                        }}
                        className={clsx(
                          "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors",
                          selectedId === ex.id
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "text-zinc-200 hover:bg-zinc-800/60"
                        )}
                      >
                        <span className="truncate">
                          {highlightMatch(ex.name, query.trim())}
                        </span>
                        <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                          {ex.muscleGroup}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {used.length > 0 && (
            <div className="flex items-center justify-between px-1 text-[10px] uppercase tracking-wide text-zinc-500">
              <span>
                {filteredExercises.length} of {used.length} exercises
              </span>
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  className="text-emerald-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Metric selector */}
        <div className="grid grid-cols-4 gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMetric(m.value)}
              className={clsx(
                "rounded-xl border px-2 py-2 text-[11px] font-medium",
                metric === m.value
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-800 bg-zinc-900/60 text-zinc-300"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* PR */}
        {pr && (
          <section className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-zinc-400">
                Personal record
              </div>
              <div className="text-base font-semibold text-zinc-100">
                {formatWeight(pr.weight)} × {pr.reps} reps
              </div>
              <div className="text-xs text-zinc-500">
                {formatDate(pr.date)} · est. 1RM {formatWeight(Math.round(pr.estimated1RM * 2) / 2)}
              </div>
            </div>
          </section>
        )}

        {/* Headline */}
        {headline && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-400">
              Latest vs previous
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-zinc-50">
                {formatVal(headline.last)}
              </span>
              <span
                className={clsx(
                  "inline-flex items-center gap-1 text-sm font-medium",
                  headline.delta > 0
                    ? "text-emerald-400"
                    : headline.delta < 0
                    ? "text-rose-400"
                    : "text-zinc-400"
                )}
              >
                {headline.delta > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                {headline.delta < 0 && <TrendingDown className="h-3.5 w-3.5" />}
                {formatPct(headline.pct)}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Previous: {formatVal(headline.prev)}
            </div>
          </section>
        )}

        {/* Chart */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="mb-1 px-1 text-xs text-zinc-400">
            {METRICS.find((m) => m.value === metric)?.help}
          </div>
          {isEmpty ? (
            <div className="flex h-56 items-center justify-center text-sm text-zinc-500">
              No data for this exercise yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    axisLine={{ stroke: "#27272a" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#71717a" }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#a1a1aa" }}
                    formatter={(v) => [formatVal(Number(v)), METRICS.find((m) => m.value === metric)?.label ?? ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#lineFill)"
                    dot={{ r: 3, fill: "#10b981", stroke: "#0a0a0a", strokeWidth: 2 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Session-by-session table */}
        {points.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              All sessions
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Max</th>
                    <th className="px-3 py-2 text-right">Volume</th>
                    <th className="px-3 py-2 text-right">e1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map((p, i, arr) => {
                    const prev = arr[i + 1];
                    const pr = p.maxWeight === Math.max(...arr.map((x) => x.maxWeight));
                    return (
                      <tr key={p.date} className="border-t border-zinc-800/80">
                        <td className="px-3 py-2 text-zinc-200">
                          {formatDate(p.date)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-100">
                          {formatWeight(p.maxWeight)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                          {formatVolume(p.totalVolume)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                          {formatWeight(Math.round(p.estimated1RM * 2) / 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {showGlossary && <GlossaryDialog onClose={() => setShowGlossary(false)} />}
    </PageShell>
  );
}

function GlossaryDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-100">Glossary</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-zinc-100">Max weight</dt>
            <dd className="mt-0.5 text-zinc-400">
              The heaviest single set you did on a given day. Good for tracking
              pure strength.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-zinc-100">Total volume</dt>
            <dd className="mt-0.5 text-zinc-400">
              Sum of <code className="text-zinc-300">weight × reps</code> across
              all sets that day. The standard measure of workout intensity.
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-zinc-100">
              Estimated 1RM (e1RM)
            </dt>
            <dd className="mt-0.5 text-zinc-400">
              The heaviest weight you could lift for a single rep, estimated
              from a heavier multi-rep set using the Epley formula:
              <code className="mt-1 block text-zinc-300">
                e1RM = weight × (1 + reps / 30)
              </code>
              <span className="mt-1 block">
                Example: 80kg × 5 reps → e1RM ≈ 93.3kg. Useful for tracking
                strength gains even when you don&apos;t test a true 1RM.
              </span>
            </dd>
          </div>

          <div>
            <dt className="font-semibold text-zinc-100">Total reps</dt>
            <dd className="mt-0.5 text-zinc-400">
              All reps across all sets that day. Useful for endurance / volume
              programs.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
