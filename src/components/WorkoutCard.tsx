"use client";

import clsx from "clsx";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Exercise, Workout } from "@/lib/types";
import { exerciseById, totalSets, totalVolume, totalReps } from "@/lib/stats";
import { formatRelativeDay, formatVolume, pluralize } from "@/lib/format";

export type WorkoutTrend = "up" | "down" | "flat";

/**
 * Numeric deltas vs the previous workout (by time), shown inline on the
 * card so the user can see what changed — not just the up/down/flat icon.
 *
 *   volume  — total weight × reps (kg); positive = heavier session
 *   maxWeight — heaviest single set (kg); positive = peak lift grew
 *   reps    — total reps across weight-reps + reps-only sets
 *
 * `undefined` for the very first workout ever logged.
 */
export interface WorkoutDelta {
  dVolume: number;
  dMaxWeight: number;
  dReps: number;
}

export function WorkoutCard({
  workout,
  exercises,
  trend,
  delta,
}: {
  workout: Workout;
  exercises: Exercise[];
  /**
   * How this workout's total volume compares to the previous workout
   * (in time). `undefined` for the very first workout logged.
   */
  trend?: WorkoutTrend;
  /** Numeric deltas to render next to the totals. */
  delta?: WorkoutDelta;
}) {
  const names = workout.exercises
    .map((e) => exerciseById(exercises, e.exerciseId)?.name)
    .filter(Boolean) as string[];

  const volume = totalVolume(workout);
  const reps = totalReps(workout);
  const sets = totalSets(workout);

  // Color tone for weight + reps numbers (and the volume chip). The volume
  // baseline is always emerald; we layer the trend color on top.
  const trendTone =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
      ? "text-rose-400"
      : "text-zinc-400";

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-100">
          {workout.name || "Workout"}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {trend && <TrendBadge trend={trend} />}
          <span>{formatRelativeDay(workout.date)}</span>
        </div>
      </div>
      <div className="mt-1 text-sm text-zinc-300 line-clamp-2">
        {names.length > 0 ? names.join(" · ") : "No exercises logged"}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className="text-zinc-400">{pluralize(sets, "set")}</span>
        <span aria-hidden className="text-zinc-600">·</span>
        <span className={clsx("tabular-nums", trendTone)}>
          {pluralize(reps, "rep")}
        </span>
        <span aria-hidden className="text-zinc-600">·</span>
        <span
          className={clsx(
            "font-medium tabular-nums",
            trend ? trendTone : "text-emerald-400"
          )}
        >
          {formatVolume(volume)}
        </span>
      </div>
      {/* Inline delta vs previous workout. Hidden for the very first workout
          (no prior to compare against). Uses the same trend color so the
          numbers line up with the icon. */}
      {delta && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] tabular-nums">
          <DeltaChip
            label="vol"
            value={delta.dVolume}
            unit="kg"
            tone={trendTone}
            showSign
          />
          <DeltaChip
            label="max"
            value={delta.dMaxWeight}
            unit="kg"
            tone={trendTone}
            showSign
          />
          <DeltaChip
            label="reps"
            value={delta.dReps}
            tone={trendTone}
            showSign
          />
        </div>
      )}
    </div>
  );
}

function DeltaChip({
  label,
  value,
  unit,
  tone,
  showSign,
}: {
  label: string;
  value: number;
  unit?: string;
  tone: string;
  /** When true, prefix positive values with "+" (so 5 reads as "+5"). */
  showSign?: boolean;
}) {
  if (value === 0) return null;
  const sign = value > 0 ? "+" : "−";
  const magnitude = Math.abs(value);
  // Round weights to 1 decimal so a "+2.5kg" delta doesn't show as "+2.4998kg".
  const display = unit === "kg" ? magnitude.toFixed(1).replace(/\.0$/, "") : magnitude.toString();
  return (
    <span className={clsx("inline-flex items-center gap-1", tone)}>
      <span className="text-zinc-500">{label}</span>
      <span>
        {showSign ? sign : ""}
        {display}
        {unit ?? ""}
      </span>
    </span>
  );
}

function TrendBadge({ trend }: { trend: WorkoutTrend }) {
  if (trend === "up") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400"
        aria-label="Improving vs previous workout"
        title="Improving vs previous workout"
      >
        <TrendingUp className="h-3 w-3" />
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/15 text-rose-400"
        aria-label="Regressed vs previous workout"
        title="Regressed vs previous workout"
      >
        <TrendingDown className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-zinc-400"
      aria-label="Same as previous workout"
      title="Same as previous workout"
    >
      <Minus className="h-3 w-3" />
    </span>
  );
}
