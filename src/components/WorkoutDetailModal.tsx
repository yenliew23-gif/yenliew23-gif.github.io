"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trophy, TrendingUp, X, Info } from "lucide-react";
import { WorkoutEditor } from "@/components/WorkoutEditor";
import { useExercises, useWorkouts } from "@/lib/hooks";
import {
  estimated1RM,
  exerciseById,
  progressByExercise,
  totalReps,
  totalSets,
  totalVolume,
} from "@/lib/stats";
import { formatDateLong, formatVolume, formatWeight, pluralize } from "@/lib/format";
import type { Workout } from "@/lib/types";

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
              const current = series[lastIdx];
              // Find the actual previous workout containing this exercise
              const previousWorkout = findPreviousWorkoutForExercise(
                workouts,
                workout,
                block.exerciseId
              );
              const previousTopSet = previousWorkout
                ? topSetForExercise(previousWorkout, block.exerciseId)
                : undefined;
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
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {block.sets.map((s, idx) => {
                      const e1rm = estimated1RM(s.weight, s.reps);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg bg-zinc-950/60 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 text-center text-zinc-500">
                              {idx + 1}
                            </span>
                            <span className="tabular-nums text-zinc-100">
                              {formatWeight(s.weight)}
                            </span>
                            <span className="text-zinc-500">×</span>
                            <span className="tabular-nums text-zinc-100">
                              {pluralize(s.reps, "rep")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <span className="tabular-nums">
                              e1RM {formatWeight(Math.round(e1rm * 2) / 2)}
                            </span>
                            {prior && s.weight > prior.maxWeight && (
                              <Trophy className="h-3.5 w-3.5 text-amber-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {previousTopSet && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>
                        Last time:{" "}
                        <span className="tabular-nums text-zinc-200">
                          {formatWeight(previousTopSet.weight)}
                        </span>
                        <span className="text-zinc-500"> × </span>
                        <span className="tabular-nums text-zinc-200">
                          {previousTopSet.reps}
                        </span>{" "}
                        <span className="text-zinc-500">reps</span>
                      </span>
                    </div>
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

/** Get the heaviest set for an exercise in a workout, or null if none. */
function topSetForExercise(
  workout: Workout,
  exerciseId: string
): { weight: number; reps: number } | null {
  const block = workout.exercises.find((b) => b.exerciseId === exerciseId);
  if (!block || block.sets.length === 0) return null;
  const top = block.sets.reduce((best, s) => (s.weight > best.weight ? s : best));
  return { weight: top.weight, reps: top.reps };
}
