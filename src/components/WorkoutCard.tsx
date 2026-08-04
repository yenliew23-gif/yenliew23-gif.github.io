"use client";

import type { Exercise, Workout } from "@/lib/types";
import { exerciseById, totalSets, totalVolume, totalReps } from "@/lib/stats";
import { formatRelativeDay, formatVolume, pluralize } from "@/lib/format";

export function WorkoutCard({
  workout,
  exercises,
}: {
  workout: Workout;
  exercises: Exercise[];
}) {
  const names = workout.exercises
    .map((e) => exerciseById(exercises, e.exerciseId)?.name)
    .filter(Boolean) as string[];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-100">
          {workout.name || "Workout"}
        </div>
        <div className="text-xs text-zinc-400">{formatRelativeDay(workout.date)}</div>
      </div>
      <div className="mt-1 text-sm text-zinc-300 line-clamp-2">
        {names.length > 0 ? names.join(" · ") : "No exercises logged"}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
        <span>{pluralize(totalSets(workout), "set")}</span>
        <span aria-hidden>·</span>
        <span>{pluralize(totalReps(workout), "rep")}</span>
        <span aria-hidden>·</span>
        <span className="font-medium text-emerald-400">
          {formatVolume(totalVolume(workout))}
        </span>
      </div>
    </div>
  );
}
