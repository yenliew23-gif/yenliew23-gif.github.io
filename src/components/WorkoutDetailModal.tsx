"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  ArrowLeft,
  Pencil,
  Trophy,
  TrendingDown,
  TrendingUp,
  Minus,
  X,
} from "lucide-react";
import { WorkoutEditor } from "@/components/WorkoutEditor";
import { useExercises, useWorkouts } from "@/lib/hooks";
import {
  estimated1RM,
  exerciseById,
  isWeightRepsSet,
  progressByExercise,
  totalReps,
  totalSets,
  totalVolume,
} from "@/lib/stats";
import {
  formatDateLong,
  formatSetSummary,
  formatVolume,
  pluralize,
} from "@/lib/format";
import type { SetEntry, SetType, Workout } from "@/lib/types";

/**
 * A modal that shows the full detail of a workout, with an edit toggle.
 * Uses a slide-up sheet on small screens, centered dialog on larger ones.
 */
export function WorkoutDetailModal({
  workoutId,
  onClose,
}: {
  workoutId: string;
  onClose: () => void;
}) {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const [editing, setEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const workout: Workout | undefined = workouts.find((w) => w.id === workoutId);

  // Lock body scroll while open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  if (!workout) return null;

  if (editing) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-zinc-950">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
          <button
            onClick={() => setEditing(false)}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-zinc-100">Edit workout</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-auto w-full max-w-md flex-1 pb-24">
          <WorkoutEditor mode="edit" workoutId={workout.id} />
        </div>
      </div>
    );
  }

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
              {workout.name || "Workout"}
            </h2>
            <p className="truncate text-xs text-zinc-400">
              {formatDateLong(workout.date)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEditing(true)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
              aria-label="Edit"
            >
              <Pencil className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            <section className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-400">Sets</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {totalSets(workout)}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-400">Reps</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">
                  {totalReps(workout)}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wide text-zinc-400">Volume</div>
                <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-400">
                  {formatVolume(totalVolume(workout))}
                </div>
              </div>
            </section>

            {workout.bodyweight && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-300">
                Bodyweight: <span className="font-semibold">{workout.bodyweight} kg</span>
              </section>
            )}

            {workout.exercises.map((block) => {
              const ex = exerciseById(exercises, block.exerciseId);
              const series = progressByExercise(workouts, block.exerciseId);
              const lastIdx = series.findIndex((p) => p.date === workout.date);
              const prior = lastIdx > 0 ? series[lastIdx - 1] : undefined;
              // Find the actual previous workout containing this exercise
              const previousWorkout = findPreviousWorkoutForExercise(
                workouts,
                workout,
                block.exerciseId
              );
              const previousTopSet = previousWorkout
                ? topSetForExercise(previousWorkout, block.exerciseId)
                : undefined;
              const currentTopSet = topSetForSets(block.sets);
              const trend: Trend = compareTopSets(currentTopSet, previousTopSet);
              return (
                <section
                  key={block.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {ex?.name ?? "(deleted)"}
                      </div>
                      <div className="text-xs capitalize text-zinc-500">
                        {ex?.muscleGroup ?? ""}
                      </div>
                    </div>
                    {currentTopSet && previousTopSet && trend !== "none" && (
                      <TrendPill trend={trend} compact />
                    )}
                  </div>

                  {block.note && (
                    <div className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-950/40 px-3 py-2 text-xs text-zinc-300">
                      {block.note}
                    </div>
                  )}

                  <div className="mt-3 space-y-1.5">
                    {block.sets.map((s, idx) => {
                      const showE1RM = isWeightRepsSet(s);
                      const e1rm = showE1RM
                        ? estimated1RM(s.weight ?? 0, s.reps ?? 0)
                        : 0;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg bg-zinc-950/60 px-3 py-2 text-sm"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="w-5 text-center text-zinc-500">
                              {idx + 1}
                            </span>
                            <span className="truncate tabular-nums text-zinc-100">
                              {formatSetSummary(s)}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
                            {showE1RM ? (
                              <span className="tabular-nums">
                                e1RM {Math.round(e1rm * 2) / 2}kg
                              </span>
                            ) : null}
                            {showE1RM && prior && (s.weight ?? 0) > prior.maxWeight && (
                              <Trophy className="h-3.5 w-3.5 text-amber-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {previousTopSet && currentTopSet && (
                    <LastTimeLine
                      current={currentTopSet}
                      previous={previousTopSet}
                      trend={trend}
                    />
                  )}
                </section>
              );
            })}

            {workout.note && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-300">
                {workout.note}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Trend + last-time comparison -----

type Trend = "up" | "down" | "flat" | "none";

/** Single-score representation of a set, type-aware (mirrors the per-type
 *  scoring in `topSetForExercise` so we can compare two sets of the same
 *  type and tell which one is "better"). */
function scoreSet(s: SetEntry): number {
  const t = s.type ?? "weight-reps";
  switch (t) {
    case "reps":
      return s.reps ?? 0;
    case "weight-time":
    case "weight-distance":
      return s.weight ?? 0;
    case "time":
      return s.duration ?? 0;
    case "distance-time":
      return s.distance ?? 0;
    case "weight-reps":
    default:
      // weight primary, reps tiebreaker
      return (s.weight ?? 0) * 1000 + (s.reps ?? 0);
  }
}

/** "Best" set in a list — the one with the highest type-aware score. */
function topSetForSets(sets: SetEntry[]): SetEntry | undefined {
  if (sets.length === 0) return undefined;
  return sets.reduce((best, s) => (scoreSet(s) > scoreSet(best) ? s : best));
}

/** Compare two top sets and tell us whether the current one improved.
 *  - "none" if either side is missing
 *  - "flat" if the two sets are of different types (or equal score)
 *  - "up" / "down" otherwise
 */
function compareTopSets(
  current: SetEntry | undefined,
  previous: SetEntry | undefined
): Trend {
  if (!current || !previous) return "none";
  const curType: SetType = current.type ?? "weight-reps";
  const prevType: SetType = previous.type ?? "weight-reps";
  if (curType !== prevType) return "flat";

  const diff = scoreSet(current) - scoreSet(previous);
  if (diff === 0) return "flat";
  // Use a per-type "flat" threshold so a 1-second / 1m / 1-rep noise
  // doesn't trigger a "regressed" pill on tiny variance.
  let flatThreshold = 0.5;
  if (curType === "weight-reps") flatThreshold = 1000; // ≤1kg or weight-tied counts as flat
  if (Math.abs(diff) < flatThreshold) return "flat";
  return diff > 0 ? "up" : "down";
}

function trendClasses(trend: Trend) {
  if (trend === "up")
    return {
      text: "text-emerald-400",
      icon: "text-emerald-400",
      underline: "decoration-emerald-500/60",
    };
  if (trend === "down")
    return {
      text: "text-rose-400",
      icon: "text-rose-400",
      underline: "decoration-rose-500/60",
    };
  return {
    text: "text-zinc-200",
    icon: "text-zinc-400",
    underline: "decoration-zinc-500/40",
  };
}

function trendIcon(trend: Trend, className: string) {
  if (trend === "up") return <TrendingUp className={className} />;
  if (trend === "down") return <TrendingDown className={className} />;
  return <Minus className={className} />;
}

function trendLabel(trend: Trend) {
  if (trend === "up") return "Improved";
  if (trend === "down") return "Regressed";
  if (trend === "flat") return "Same";
  return "";
}

function TrendPill({ trend, compact = false }: { trend: Trend; compact?: boolean }) {
  if (trend === "none") return null;
  const c = trendClasses(trend);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full text-[10px] font-medium uppercase tracking-wide",
        compact ? "px-1.5 py-0.5" : "px-2 py-0.5",
        trend === "up" && "bg-emerald-500/15",
        trend === "down" && "bg-rose-500/15",
        trend === "flat" && "bg-zinc-800",
        c.text
      )}
      title={trendLabel(trend)}
    >
      {trendIcon(trend, "h-3 w-3")}
      {trendLabel(trend)}
    </span>
  );
}

function LastTimeLine({
  current,
  previous,
  trend,
}: {
  current: SetEntry;
  previous: SetEntry;
  trend: Trend;
}) {
  const c = trendClasses(trend);
  const flat = trend === "flat" || trend === "none";
  return (
    <div className="mt-3 flex items-center gap-1.5 text-xs">
      <span className={c.icon}>{trendIcon(trend, "h-3.5 w-3.5")}</span>
      <span className="text-zinc-400">Last time:</span>{" "}
      <span
        className={clsx(
          "tabular-nums",
          c.text,
          "underline decoration-2 underline-offset-4",
          c.underline,
          flat && "decoration-1"
        )}
      >
        {formatSetSummary(previous)}
      </span>
      {trend !== "none" && !flat && (
        <span className={clsx("ml-1 text-[10px] uppercase tracking-wide", c.text)}>
          ({trend === "up" ? "+" : "−"}vs now)
        </span>
      )}
    </div>
  );
}

// ----- Helpers used by the per-exercise "last time" comparison -----

/**
 * Find the most recent workout (strictly before `current`) that contains the
 * given exercise. Returns null if this is the first time the user logged it.
 */
function findPreviousWorkoutForExercise(
  workouts: Workout[],
  current: Workout,
  exerciseId: string
): Workout | null {
  const candidates = workouts
    .filter(
      (w) =>
        w.id !== current.id &&
        w.date <= current.date &&
        w.exercises.some((b) => b.exerciseId === exerciseId)
    )
    .sort((a, b) => {
      // newest first by date, then by createdAt as tiebreaker
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt - a.createdAt;
    });
  return candidates[0] ?? null;
}

/**
 * Pick the "best" set for an exercise in a workout, in a way that makes sense
 * for the set's type:
 *  - weight-reps: heaviest weight (ties broken by more reps)
 *  - reps: most reps
 *  - weight-time / weight-distance: heaviest weight
 *  - time: longest duration
 *  - distance-time: longest distance
 *
 * Returns the set itself so the caller can format it with `formatSetSummary`.
 */
function topSetForExercise(
  workout: Workout,
  exerciseId: string
): SetEntry | undefined {
  const block = workout.exercises.find((b) => b.exerciseId === exerciseId);
  if (!block || block.sets.length === 0) return undefined;
  return topSetForSets(block.sets);
}
