"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Trophy, Activity } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { StatCard, DeltaPill } from "@/components/StatCard";
import { WorkoutCard, type WorkoutTrend } from "@/components/WorkoutCard";
import { WorkoutDetailModal } from "@/components/WorkoutDetailModal";
import { useExercises, useWorkouts } from "@/lib/hooks";
import {
  lastNWeeksVolume,
  personalRecord,
  progressByExercise,
  thisWeekVsLastWeek,
  totalVolume,
} from "@/lib/stats";
import { formatPct, formatVolume, formatWeekLabel, pluralize } from "@/lib/format";

export default function HomePage() {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const summary = useMemo(() => thisWeekVsLastWeek(workouts), [workouts]);
  const weekly = useMemo(() => lastNWeeksVolume(workouts, 6), [workouts]);
  const maxWeekVolume = Math.max(1, ...weekly.map((w) => w.volume));

  const recent = workouts.slice(0, 3);

  // Find the most-improved exercise this week vs last week (by total volume)
  const topImprovement = useMemo(() => {
    const ids = Array.from(
      new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))
    );
    let best: { id: string; pct: number; delta: number } | null = null;
    for (const id of ids) {
      const points = progressByExercise(workouts, id);
      if (points.length < 2) continue;
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      if (prev.totalVolume === 0 && last.totalVolume === 0) continue;
      const delta = last.totalVolume - prev.totalVolume;
      const pct = prev.totalVolume > 0 ? (delta / prev.totalVolume) * 100 : 100;
      if (!best || pct > best.pct) best = { id, pct, delta };
    }
    return best;
  }, [workouts]);

  const lastWorkout = workouts[0];
  const totalAllTime = useMemo(
    () => workouts.reduce((s, w) => s + totalVolume(w), 0),
    [workouts]
  );

  // Trend map shared by "Last workout" and "Recent" cards. Computed from the
  // full workout list so the comparison is stable.
  const trendById = useMemo(() => {
    const map = new Map<string, WorkoutTrend>();
    for (let i = 0; i < workouts.length; i++) {
      const cur = workouts[i];
      const prev = workouts[i + 1];
      if (!prev) continue;
      const dv = totalVolume(cur) - totalVolume(prev);
      if (Math.abs(dv) < 0.5) map.set(cur.id, "flat");
      else if (dv > 0) map.set(cur.id, "up");
      else map.set(cur.id, "down");
    }
    return map;
  }, [workouts]);

  return (
    <PageShell>
      <PageHeader
        title="Gym Tracker"
        subtitle={
          workouts.length === 0
            ? "No workouts yet"
            : `${pluralize(workouts.length, "workout")} logged`
        }
        right={
          <Link
            href="/log"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-zinc-950"
            aria-label="Log workout"
          >
            <Plus className="h-5 w-5" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        {/* This week vs last week */}
        {summary && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              This week vs last
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="This week"
                value={formatVolume(summary.thisWeek.volume)}
                hint={pluralize(summary.thisWeek.totalSets, "set")}
              />
              <StatCard
                label="vs Last week"
                value={formatVolume(summary.lastWeek.volume)}
                hint={
                  <span className="inline-flex items-center gap-1">
                    <DeltaPill pct={summary.volumeDeltaPct} />
                  </span>
                }
                tone={
                  summary.volumeDelta > 0
                    ? "positive"
                    : summary.volumeDelta < 0
                    ? "negative"
                    : "default"
                }
              />
            </div>
          </section>
        )}

        {/* Weekly volume bars — always render the section (with empty-state
            inside if there's no data yet) so the user can see what's
            expected. Previously hidden entirely, which made it look broken
            when no workouts were in the last 6 weeks. */}
        {weekly.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Weekly volume
            </h2>
            {weekly.some((w) => w.volume > 0) ? (
              <>
                <div className="flex h-32 items-end gap-2">
                  {weekly.map((w) => {
                    const heightPct = (w.volume / maxWeekVolume) * 100;
                    return (
                      <div
                        key={w.weekStart}
                        className="flex flex-1 flex-col items-center gap-1"
                      >
                        {/* Numeric volume above the bar so the user can see
                            the actual computed value, not just the bar shape.
                            Helpful when bars look short and you want to know
                            if it's a real low number or a render bug. */}
                        <div className="text-[10px] tabular-nums text-zinc-400 h-4">
                          {w.volume > 0 ? formatVolume(w.volume) : ""}
                        </div>
                        <div
                          className="w-full rounded-t-md bg-emerald-500/80"
                          style={{ height: `${Math.max(2, heightPct)}%` }}
                          title={`${formatVolume(w.volume)}`}
                        />
                        <div className="text-[10px] text-zinc-500">
                          {formatWeekLabel(w.weekStart)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 text-center text-xs text-zinc-500">
                  Last 6 weeks
                </div>
              </>
            ) : (
              <div className="py-6 text-center text-sm text-zinc-500">
                Log a weight-reps workout to see your weekly volume trend.
              </div>
            )}
          </section>
        )}

        {/* Highlights */}
        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/exercises"
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                Exercises
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="mt-1 text-xl font-semibold">{exercises.length}</div>
            <div className="text-xs text-zinc-400">in your library</div>
          </Link>
          <Link
            href="/history"
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                All time
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="mt-1 text-xl font-semibold">
              {formatVolume(totalAllTime)}
            </div>
            <div className="text-xs text-zinc-400">total volume lifted</div>
          </Link>
        </section>

        {/* Most improved */}
        {topImprovement && exercises.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Most improved
              </h2>
              <Trophy className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {exercises.find((e) => e.id === topImprovement.id)?.name ?? "—"}
            </div>
            <div className="mt-1 text-sm text-zinc-300">
              <span
                className={
                  topImprovement.delta > 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                {formatPct(topImprovement.pct)}
              </span>{" "}
              on volume vs previous session
            </div>
          </section>
        )}

        {/* Last workout */}
        {lastWorkout && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Last workout
              </h2>
              <Link
                href="/history"
                className="text-xs text-emerald-400 hover:underline"
              >
                See all
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(lastWorkout.id)}
              className="block w-full text-left active:scale-[0.99] transition-transform"
              aria-label={`Open ${lastWorkout.name || "workout"} from ${lastWorkout.date}`}
            >
              <WorkoutCard
                workout={lastWorkout}
                exercises={exercises}
                trend={trendById.get(lastWorkout.id)}
              />
            </button>
          </section>
        )}

        {/* Recent */}
        {recent.length > 1 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Recent
            </h2>
            <div className="space-y-2">
              {recent.slice(1).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedId(w.id)}
                  className="block w-full text-left active:scale-[0.99] transition-transform"
                  aria-label={`Open ${w.name || "workout"} from ${w.date}`}
                >
                  <WorkoutCard
                    workout={w}
                    exercises={exercises}
                    trend={trendById.get(w.id)}
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {workouts.length === 0 && (
          <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-zinc-500" />
            <div className="mt-3 text-base font-medium text-zinc-200">
              Log your first workout
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Tap the <span className="font-semibold text-emerald-400">+</span> button to
              start. We&apos;ll handle the analytics from there.
            </p>
            <Link
              href="/log"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950"
            >
              Start logging
            </Link>
          </section>
        )}
      </div>

      {selectedId && (
        <WorkoutDetailModal
          workoutId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </PageShell>
  );
}
