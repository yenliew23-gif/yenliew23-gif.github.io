"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import {
  WorkoutCard,
  type WorkoutDelta,
  type WorkoutTrend,
} from "@/components/WorkoutCard";
import { WorkoutDetailModal } from "@/components/WorkoutDetailModal";
import { useExercises, useWorkouts } from "@/lib/hooks";
import { formatWeekLabel } from "@/lib/format";
import {
  isWeightRepsSet,
  totalReps,
  totalVolume,
  weekStartOf,
} from "@/lib/stats";
import type { Workout } from "@/lib/types";

export default function HistoryPage() {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) return workouts;
    const needle = q.toLowerCase();
    return workouts.filter((w) => {
      if (w.name?.toLowerCase().includes(needle)) return true;
      return w.exercises.some((e) => {
        const ex = exercises.find((x) => x.id === e.exerciseId);
        return ex?.name.toLowerCase().includes(needle);
      });
    });
  }, [workouts, exercises, q]);

  // Map every workout id to its volume trend against the previous workout
  // (by time). We compute this from the unfiltered, un-grouped list so the
  // comparison stays stable even when the user is filtering by name.
  const trendById = useMemo(() => buildTrendMap(workouts), [workouts]);
  // Numeric deltas (volume / max weight / reps) vs the previous workout, so
  // each card can show concrete "+5kg, +12 reps" instead of just a trend icon.
  const deltaById = useMemo(() => buildDeltaMap(workouts), [workouts]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const w of filtered) {
      const k = weekStartOf(w.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(w);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <PageShell>
      <PageHeader title="History" subtitle={`${workouts.length} workouts total`} />

      <div className="space-y-5 px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search exercise or workout…"
            className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-900/60 pl-9 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
          />
        </div>

        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
            <div className="text-sm text-zinc-300">No workouts found</div>
            <p className="mt-1 text-xs text-zinc-500">
              {q ? "Try a different search." : "Log your first workout to see it here."}
            </p>
          </div>
        )}

        {grouped.map(([week, ws]) => (
          <section key={week}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Week of {formatWeekLabel(week)}
            </h2>
            <div className="space-y-2">
              {ws.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedId(w.id)}
                  className="block w-full text-left"
                >
                  <WorkoutCard
                    workout={w}
                    exercises={exercises}
                    trend={trendById.get(w.id)}
                    delta={deltaById.get(w.id)?.delta}
                  />
                </button>
              ))}
            </div>
          </section>
        ))}
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

/**
 * For each workout in the list, compare its total volume against the next-most-
 * recent workout. The list is expected to be sorted newest-first
 * (which `getWorkouts()` already does), so a workout at index i is compared to
 * the workout at index i+1 (the one that came before it in time).
 *
 * Returns `undefined` for the very first workout ever logged (no prior).
 */
function buildTrendMap(workouts: Workout[]): Map<string, WorkoutTrend> {
  const map = new Map<string, WorkoutTrend>();
  for (let i = 0; i < workouts.length; i++) {
    const cur = workouts[i];
    const prev = workouts[i + 1];
    if (!prev) {
      // Oldest workout — nothing to compare against.
      continue;
    }
    const dv = totalVolume(cur) - totalVolume(prev);
    // Use a small absolute threshold so a 1-2kg noise doesn't count as a trend.
    if (Math.abs(dv) < 0.5) {
      map.set(cur.id, "flat");
    } else if (dv > 0) {
      map.set(cur.id, "up");
    } else {
      map.set(cur.id, "down");
    }
  }
  return map;
}

/**
 * Compute per-workout delta numbers vs the previous workout in time, for
 * inline display on each History card: volume (kg), max weight (kg), and
 * total reps. Weight deltas only count weight-reps sets; reps deltas count
 * any set that tracks reps (weight-reps + reps-only).
 */
function buildDeltaMap(
  workouts: Workout[]
): Map<string, { trend: WorkoutTrend; delta: WorkoutDelta }> {
  const map = new Map<string, { trend: WorkoutTrend; delta: WorkoutDelta }>();
  for (let i = 0; i < workouts.length; i++) {
    const cur = workouts[i];
    const prev = workouts[i + 1];
    if (!prev) continue;
    const dVolume = totalVolume(cur) - totalVolume(prev);
    const dReps = totalReps(cur) - totalReps(prev);
    const dMaxWeight =
      maxWeight(cur) - maxWeight(prev);
    const trend: WorkoutTrend =
      Math.abs(dVolume) < 0.5 ? "flat" : dVolume > 0 ? "up" : "down";
    map.set(cur.id, {
      trend,
      delta: { dVolume, dMaxWeight, dReps },
    });
  }
  return map;
}

/** Heaviest weight (kg) across all weight-reps sets in a workout, or 0. */
function maxWeight(workout: Workout): number {
  let m = 0;
  for (const block of workout.exercises) {
    for (const s of block.sets) {
      if (isWeightRepsSet(s)) m = Math.max(m, s.weight ?? 0);
    }
  }
  return m;
}
