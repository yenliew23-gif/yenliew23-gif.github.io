"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { Trophy, X } from "lucide-react";
import clsx from "clsx";
import { useWorkouts } from "@/lib/hooks";
import { estimated1RM } from "@/lib/stats";
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatSetSummary,
  formatVolume,
  formatWeight,
} from "@/lib/format";
import type { SetEntry, SetType } from "@/lib/types";

type Metric = {
  key: string;
  label: string;
  /** Value for one session's sets (already filtered to the chart's type). */
  value: (sets: SetEntry[]) => number;
  format: (v: number) => string;
};

const max = (sets: SetEntry[], f: (s: SetEntry) => number) =>
  sets.reduce((m, s) => Math.max(m, f(s)), 0);
const sum = (sets: SetEntry[], f: (s: SetEntry) => number) =>
  sets.reduce((t, s) => t + f(s), 0);
const reps = (v: number) => `${v} reps`;

/** The metrics worth charting for each set type, first one shown by default. */
const METRICS: Record<SetType, Metric[]> = {
  "weight-reps": [
    { key: "top", label: "Top set", value: (s) => max(s, (x) => x.weight ?? 0), format: formatWeight },
    {
      key: "e1rm",
      label: "Est. 1RM",
      value: (s) => max(s, (x) => Math.round(estimated1RM(x.weight ?? 0, x.reps ?? 0) * 2) / 2),
      format: formatWeight,
    },
    { key: "volume", label: "Volume", value: (s) => sum(s, (x) => (x.weight ?? 0) * (x.reps ?? 0)), format: formatVolume },
  ],
  reps: [
    { key: "best", label: "Best set", value: (s) => max(s, (x) => x.reps ?? 0), format: reps },
    { key: "total", label: "Total reps", value: (s) => sum(s, (x) => x.reps ?? 0), format: reps },
  ],
  "weight-time": [
    { key: "weight", label: "Weight", value: (s) => max(s, (x) => x.weight ?? 0), format: formatWeight },
    { key: "time", label: "Best time", value: (s) => max(s, (x) => x.duration ?? 0), format: formatDuration },
  ],
  time: [
    { key: "time", label: "Best time", value: (s) => max(s, (x) => x.duration ?? 0), format: formatDuration },
  ],
  "distance-time": [
    { key: "dist", label: "Distance", value: (s) => max(s, (x) => x.distance ?? 0), format: formatDistance },
  ],
  "weight-distance": [
    { key: "dist", label: "Distance", value: (s) => max(s, (x) => x.distance ?? 0), format: formatDistance },
    { key: "weight", label: "Weight", value: (s) => max(s, (x) => x.weight ?? 0), format: formatWeight },
  ],
};

const typeOf = (s: SetEntry): SetType => s.type ?? "weight-reps";

/**
 * Bottom sheet with a chart and the full session history of one exercise,
 * opened from the exercise card in the workout editor.
 */
export function ExerciseHistoryModal({
  exerciseId,
  exerciseName,
  onClose,
}: {
  exerciseId: string;
  exerciseName: string;
  onClose: () => void;
}) {
  const workouts = useWorkouts();

  // Every saved session of this exercise, oldest first.
  const sessions = useMemo(
    () =>
      workouts
        .flatMap((w) => {
          const block = w.exercises.find((b) => b.exerciseId === exerciseId);
          return block && block.sets.length > 0
            ? [{ id: w.id, date: w.date, createdAt: w.createdAt, name: w.name, sets: block.sets }]
            : [];
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt),
    [workouts, exerciseId]
  );

  // Chart the type used in the most recent session; older sessions logged
  // in another UOM still appear in the list below.
  const chartType: SetType =
    sessions.length > 0 ? typeOf(sessions[sessions.length - 1].sets[0]) : "weight-reps";
  const metrics = METRICS[chartType];
  const [metricKey, setMetricKey] = useState(metrics[0].key);
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];

  const points = useMemo(
    () =>
      sessions.flatMap((s) => {
        const sets = s.sets.filter((x) => typeOf(x) === chartType);
        return sets.length > 0
          ? [{ id: s.id, label: formatDate(s.date), value: metric.value(sets) }]
          : [];
      }),
    [sessions, chartType, metric]
  );
  const best = points.reduce<(typeof points)[number] | null>(
    (b, p) => (!b || p.value > b.value ? p : b),
    null
  );

  // Lock body scroll while open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-100">{exerciseName}</h2>
            <p className="text-xs text-zinc-400">
              {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
              No history yet — this will fill in once you save a workout with this exercise.
            </div>
          ) : (
            <>
              {metrics.length > 1 && (
                <div className="flex gap-1.5">
                  {metrics.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => setMetricKey(m.key)}
                      className={clsx(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        m.key === metric.key
                          ? "bg-emerald-500 text-zinc-950"
                          : "border border-zinc-800 text-zinc-300"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="mb-1 flex items-baseline justify-between px-1 text-xs">
                  <span className="text-zinc-400">{metric.label}</span>
                  {best && (
                    <span className="text-zinc-400">
                      Best <span className="font-medium text-zinc-100">{metric.format(best.value)}</span>
                    </span>
                  )}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="exerciseHistoryFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
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
                        minTickGap={24}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                        domain={["auto", "auto"]}
                        tickFormatter={(v) => metric.format(Number(v))}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0a0a0a",
                          border: "1px solid #27272a",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#a1a1aa" }}
                        itemStyle={{ color: "#f4f4f5" }}
                        formatter={(v) => [metric.format(Number(v)), metric.label]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#exerciseHistoryFill)"
                        dot={{ r: 4, fill: "#10b981", stroke: "#0a0a0a", strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  History
                </h3>
                <ul className="space-y-1.5">
                  {[...sessions].reverse().map((s) => (
                    <li key={s.id} className="rounded-xl bg-zinc-900/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-zinc-200">{formatDate(s.date)}</span>
                        <span className="flex min-w-0 items-center gap-1 text-zinc-500">
                          {best?.id === s.id && (
                            <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-label="Best" />
                          )}
                          <span className="truncate">{s.name}</span>
                        </span>
                      </div>
                      <div className="mt-0.5 text-sm tabular-nums text-zinc-100">
                        {s.sets.map(formatSetSummary).join(", ")}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
