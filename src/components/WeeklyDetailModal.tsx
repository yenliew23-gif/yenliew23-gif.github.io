"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Activity, Dumbbell } from "lucide-react";
import { useExercises, useWorkouts } from "@/lib/hooks";
import {
  addDaysISO,
  blockVolume,
  isWeightRepsSet,
  weekStartOf,
} from "@/lib/stats";
import {
  formatDate,
  formatSetSummary,
  formatVolume,
  pluralize,
} from "@/lib/format";
import type { Exercise, SetEntry, WorkoutExercise } from "@/lib/types";

/**
 * Modal showing the per-exercise set breakdown for a single week (this week
 * or last week from the home page). Groups every set logged inside the
 * window [weekStart, weekStart + 7 days) by exercise, sorted by total
 * weight-reps volume desc (so the heaviest lift leads).
 *
 * Each exercise section shows: exercise name + muscle group, totals
 * (sets / reps / volume), and the full set list with the date that workout
 * happened on (one row per set).
 *
 * Read-only. The user goes to a workout detail modal (or history page) to
 * edit a session.
 */
export function WeeklyDetailModal({
  weekStart,
  onClose,
  /** Optional override for the window's Monday — defaults to `weekStartOf`
   *  of `weekStart` so callers can pass a date that already happens to be a
   *  Monday without surprises. We also clamp the window to exactly 7 days
   *  so two adjacent weeks never overlap. */
}: {
  weekStart: string;
  onClose: () => void;
}) {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Lock body scroll while open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const window = useMemo(() => {
    const start = weekStartOf(weekStart);
    const end = addDaysISO(start, 7); // exclusive
    return { start, end };
  }, [weekStart]);

  // Filter workouts to the week window, then flatten into
  // "per-exercise per-set" rows with the workout date attached.
  const rows = useMemo(() => {
    const out: {
      exerciseId: string;
      workoutId: string;
      workoutDate: string;
      workoutName?: string;
      sets: SetEntry[];
    }[] = [];
    for (const w of workouts) {
      if (w.date < window.start || w.date >= window.end) continue;
      for (const block of w.exercises) {
        if (block.sets.length === 0) continue;
        out.push({
          exerciseId: block.exerciseId,
          workoutId: w.id,
          workoutDate: w.date,
          workoutName: w.name,
          sets: block.sets,
        });
      }
    }
    return out;
  }, [workouts, window]);

  // Aggregate per-exercise summary + a flat set list with dates.
  const exerciseGroups = useMemo(() => {
    type Group = {
      exerciseId: string;
      sets: number;
      reps: number;
      volume: number;
      /** One entry per set (preserves the per-workout order) so we can
       *  render "20kg × 8 · Sep 22" lines. */
      setRows: { set: SetEntry; date: string; workoutName?: string }[];
    };
    const m = new Map<string, Group>();
    for (const row of rows) {
      const g =
        m.get(row.exerciseId) ??
        {
          exerciseId: row.exerciseId,
          sets: 0,
          reps: 0,
          volume: 0,
          setRows: [],
        };
      // Build a synthetic WorkoutExercise-like shape so we can reuse the
      // existing blockVolume() helper without re-deriving the logic.
      const synthetic: WorkoutExercise = {
        id: "tmp",
        exerciseId: row.exerciseId,
        order: 0,
        sets: row.sets,
      };
      g.volume += blockVolume(synthetic);
      for (const s of row.sets) {
        g.sets += 1;
        if ((s.type ?? "weight-reps") === "weight-reps" || (s.type ?? "weight-reps") === "reps") {
          g.reps += s.reps ?? 0;
        }
        g.setRows.push({ set: s, date: row.workoutDate, workoutName: row.workoutName });
      }
      m.set(row.exerciseId, g);
    }
    return Array.from(m.values()).sort((a, b) => {
      // Heaviest lift first; tie-break by reps desc; stable on order of
      // first appearance so ties within the week don't reshuffle.
      if (b.volume !== a.volume) return b.volume - a.volume;
      if (b.reps !== a.reps) return b.reps - a.reps;
      return 0;
    });
  }, [rows]);

  // Find the heaviest single weight-reps set across the whole week — useful
  // as a one-line highlight at the top.
  const heaviestSet = useMemo(() => {
    let best: { set: SetEntry; date: string; exerciseName: string } | null = null;
    for (const row of rows) {
      for (const s of row.sets) {
        if (!isWeightRepsSet(s)) continue;
        const w0 = s.weight ?? 0;
        const r0 = s.reps ?? 0;
        const score = w0 * 1000 + r0; // matches scoreSet() in WorkoutDetailModal
        if (
          !best ||
          score >
            (best.set.weight ?? 0) * 1000 + (best.set.reps ?? 0)
        ) {
          const ex = exercises.find((e) => e.id === row.exerciseId);
          best = { set: s, date: row.workoutDate, exerciseName: ex?.name ?? "?" };
        }
      }
    }
    return best;
  }, [rows, exercises]);

  const totalSets = exerciseGroups.reduce((s, g) => s + g.sets, 0);
  const totalReps = exerciseGroups.reduce((s, g) => s + g.reps, 0);
  const totalVolume = exerciseGroups.reduce((s, g) => s + g.volume, 0);
  const workoutCount = new Set(rows.map((r) => r.workoutId)).size;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          opacity: mounted ? 1 : 0,
          transition: "transform 200ms ease, opacity 200ms ease",
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-100">
              Week of {formatDate(window.start)}
            </h2>
            <p className="text-xs text-zinc-400">
              {pluralize(workoutCount, "workout")} ·{" "}
              {pluralize(exerciseGroups.length, "exercise")}
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

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {exerciseGroups.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              <WeekSummary
                totalSets={totalSets}
                totalReps={totalReps}
                totalVolume={totalVolume}
                heaviestSet={heaviestSet}
                workoutCount={workoutCount}
              />
              {exerciseGroups.map((g) => (
                <ExerciseSection
                  key={g.exerciseId}
                  exercise={exercises.find((e) => e.id === g.exerciseId)}
                  group={g}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----- Subcomponents -----

function WeekSummary({
  totalSets,
  totalReps,
  totalVolume,
  heaviestSet,
  workoutCount,
}: {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  heaviestSet: { set: SetEntry; date: string; exerciseName: string } | null;
  workoutCount: number;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            Sets
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {totalSets}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            Reps
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {totalReps}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            Volume
          </div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">
            {formatVolume(totalVolume)}
          </div>
        </div>
      </div>
      {heaviestSet && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-950/60 px-3 py-2 text-xs">
          <Dumbbell className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-zinc-400">Heaviest:</span>
          <span className="truncate font-medium text-zinc-100">
            {formatSetSummary(heaviestSet.set)}
          </span>
          <span className="truncate text-zinc-500">
            · {heaviestSet.exerciseName}
          </span>
        </div>
      )}
      {workoutCount > 0 && (
        <div className="mt-2 text-[10px] uppercase tracking-wide text-zinc-500">
          {pluralize(workoutCount, "session")}
        </div>
      )}
    </section>
  );
}

function ExerciseSection({
  exercise,
  group,
}: {
  exercise: Exercise | undefined;
  group: {
    exerciseId: string;
    sets: number;
    reps: number;
    volume: number;
    setRows: { set: SetEntry; date: string; workoutName?: string }[];
  };
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-100">
            {exercise?.name ?? "(deleted exercise)"}
          </div>
          <div className="text-xs capitalize text-zinc-500">
            {exercise?.muscleGroup ?? ""}
          </div>
        </div>
        <div className="shrink-0 text-right text-xs text-zinc-400 tabular-nums">
          {group.volume > 0 && (
            <div className="text-emerald-400">{formatVolume(group.volume)}</div>
          )}
          <div>
            {pluralize(group.sets, "set")} · {group.reps} reps
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {group.setRows.map((row, idx) => (
          <div
            key={`${row.date}-${idx}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-zinc-950/60 px-3 py-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="w-5 shrink-0 text-center text-zinc-500">
                {idx + 1}
              </span>
              <span className="truncate tabular-nums text-zinc-100">
                {formatSetSummary(row.set)}
              </span>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-zinc-500">
              {formatDate(row.date)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
      <Activity className="mx-auto h-8 w-8 text-zinc-500" />
      <div className="mt-3 text-base font-medium text-zinc-200">
        Nothing logged this week
      </div>
      <p className="mt-1 text-sm text-zinc-400">
        Tap the <span className="font-semibold text-emerald-400">+</span> button
        to start a session.
      </p>
    </div>
  );
}