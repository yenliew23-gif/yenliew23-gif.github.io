"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import {
  ArrowLeft,
  ChartLine,
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

// Loaded only when opened, so the charting library stays out of the initial
// download of the pages that show this modal.
const ExerciseHistoryModal = dynamic(
  () => import("@/components/ExerciseHistoryModal").then((m) => m.ExerciseHistoryModal),
  { ssr: false }
);

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
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string } | null>(null);

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
    <>
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
                // Full sequence of sets from the previous workout containing
                // this exercise, whatever their type, so the "last time" line
                // can show the entire previous session (not just the top set).
                const previousSets = previousWorkout
                  ? previousWorkout.exercises.find(
                      (b) => b.exerciseId === block.exerciseId
                    )?.sets ?? []
                  : [];
                const blockTrend: Trend = computeBlockTrend(block.sets, previousSets);
                return (
                  <section
                    key={block.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="truncate text-sm font-semibold text-zinc-100">
                            {ex?.name ?? "(deleted)"}
                          </span>
                          {ex && (
                            <button
                              type="button"
                              onClick={() => setHistoryFor({ id: ex.id, name: ex.name })}
                              className="shrink-0 rounded-md p-1 text-emerald-400 hover:bg-zinc-800"
                              aria-label={`${ex.name} history`}
                              title="History & graph"
                            >
                              <ChartLine className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="text-xs capitalize text-zinc-500">
                          {ex?.muscleGroup ?? ""}
                        </div>
                      </div>
                      {blockTrend !== "none" && (
                        <TrendPill trend={blockTrend} compact />
                      )}
                    </div>

                    {/* Persistent exercise-level note (form cues, setup, etc.)
                        from the Exercises page. Distinct from block.note which is
                        the per-workout session comment. Rendered in a muted style
                        so it reads as "background reference" rather than today's
                        log. */}
                    {ex?.notes && (
                      <div className="mt-2 whitespace-pre-wrap rounded-lg border border-zinc-800/60 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-400">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          Note
                        </span>
                        <div className="mt-0.5">{ex.notes}</div>
                      </div>
                    )}

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

                    {previousSets.length > 0 && block.sets.length > 0 && (
                      <LastTimeLine
                        previousSets={previousSets}
                        trend={blockTrend}
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

      {historyFor && (
        <ExerciseHistoryModal
          exerciseId={historyFor.id}
          exerciseName={historyFor.name}
          onClose={() => setHistoryFor(null)}
        />
      )}
    </>
  );
}

// ----- Trend + last-time comparison -----

type Trend = "up" | "down" | "flat" | "none";

type SetField = "weight" | "reps" | "duration" | "distance";

/** Every field a set of the given type records. Used to find what two
 *  different UOMs have in common (e.g. weight-reps vs reps → reps). */
const SET_FIELDS: Record<SetType, SetField[]> = {
  "weight-reps": ["weight", "reps"],
  reps: ["reps"],
  "weight-time": ["weight", "duration"],
  time: ["duration"],
  "distance-time": ["distance", "duration"],
  "weight-distance": ["weight", "distance"],
};

/** The fields that rank two sets of the same type, most significant first. */
const RANK_FIELDS: Record<SetType, SetField[]> = {
  "weight-reps": ["weight", "reps"],
  reps: ["reps"],
  "weight-time": ["weight", "duration"],
  time: ["duration"],
  "distance-time": ["distance"],
  "weight-distance": ["distance"],
};

/** Differences at or below these count as noise ("same"), not progress. */
const FIELD_DEAD_ZONE: Record<SetField, number> = {
  weight: 0.5, // kg
  reps: 0,
  duration: 1, // s
  distance: 1, // m
};

function setTypeOf(s: SetEntry): SetType {
  return s.type ?? "weight-reps";
}

/** The fields to compare a block of `cur`-type sets against a previous
 *  block of `prev`-type sets: the type's own ranking when they match,
 *  otherwise whatever field both UOMs record (empty if none). */
function comparisonFields(cur: SetType, prev: SetType): SetField[] {
  if (cur === prev) return RANK_FIELDS[cur];
  return SET_FIELDS[cur].filter((f) => SET_FIELDS[prev].includes(f));
}

/** Type-aware score of a set: the values of `fields`, most significant
 *  first, compared lexicographically. Defaults to the set's own ranking. */
function scoreSet(
  s: SetEntry,
  fields: SetField[] = RANK_FIELDS[setTypeOf(s)]
): number[] {
  return fields.map((f) => s[f] ?? 0);
}

function compareScores(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** "Best" set in a list — the one with the highest type-aware score. */
function topSetForSets(
  sets: SetEntry[],
  fields?: SetField[]
): SetEntry | undefined {
  if (sets.length === 0) return undefined;
  return sets.reduce((best, s) =>
    compareScores(scoreSet(s, fields), scoreSet(best, fields)) > 0 ? s : best
  );
}

/** Compare two top sets on `fields`, most significant first. A field only
 *  decides the result when it moved beyond its dead-zone, so e.g. a
 *  weight-time set at the same weight is judged on duration.
 *  - "none" if either side is missing or there's nothing to compare on
 *  - "flat" if no field moved beyond its dead-zone
 *  - "up" / "down" otherwise
 */
function compareTopSets(
  current: SetEntry | undefined,
  previous: SetEntry | undefined,
  fields: SetField[]
): Trend {
  if (!current || !previous || fields.length === 0) return "none";
  for (const f of fields) {
    const diff = (current[f] ?? 0) - (previous[f] ?? 0);
    if (Math.abs(diff) > FIELD_DEAD_ZONE[f]) return diff > 0 ? "up" : "down";
  }
  return "flat";
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
  previousSets,
  trend,
}: {
  /** All sets from the previous workout, in order. We render the full list
   *  in each set's own format (e.g. "20kg × 8, 20kg × 6" or "32kg × 1:00")
   *  so the user can see the entire previous session, not just the top set. */
  previousSets: SetEntry[];
  trend: Trend;
}) {
  const c = trendClasses(trend);
  const flat = trend === "flat" || trend === "none";
  const summary = previousSets.map(formatSetSummary).join(", ");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
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
        {summary}
      </span>
      {trend !== "none" && !flat && (
        <span className={clsx("ml-1 text-[10px] uppercase tracking-wide", c.text)}>
          ({trend === "up" ? "+" : "−"}vs now)
        </span>
      )}
    </div>
  );
}

/** Turn a numeric delta into a trend, ignoring changes within `dead`. */
function deltaTrend(delta: number, dead: number): Trend {
  if (delta > dead) return "up";
  if (delta < -dead) return "down";
  return "flat";
}

/**
 * Compare an exercise block (current) against its previous occurrence,
 * type-aware:
 *
 *   - weight-reps : top set (weight, then reps), total volume, total reps
 *   - reps        : best set and total reps
 *   - weight-time : top set by weight, then duration
 *   - time        : longest duration
 *   - distance-*  : longest distance
 *
 * When the two sessions used different UOMs we compare on the field they
 * share (weight-reps vs reps → reps, weight-time vs time → duration, …).
 *
 *   - "up"   : any signal is clearly higher (with a small dead-zone)
 *   - "down" : any is clearly lower
 *   - "flat" : none moved beyond the dead-zone
 *   - "none" : no prior sets, or nothing in common to compare on
 *
 * We use OR (not weighted) so that, for example, dropping one rep at the
 * same weight doesn't hide a heavier top set, and adding a set at a lower
 * weight doesn't hide a rep count increase. Mixed signals defer to the
 * aggregate (volume, else total reps).
 */
function computeBlockTrend(
  currentSets: SetEntry[],
  previousSets: SetEntry[]
): Trend {
  if (currentSets.length === 0 || previousSets.length === 0) return "none";
  const curType = setTypeOf(currentSets[0]);
  const prevType = setTypeOf(previousSets[0]);
  const fields = comparisonFields(curType, prevType);
  if (fields.length === 0) return "none";

  // Only sets that actually record the compared fields take part, so a
  // stray set of another type in the same block can't skew the result.
  const records = (s: SetEntry) =>
    fields.every((f) => SET_FIELDS[setTypeOf(s)].includes(f));
  const cur = currentSets.filter(records);
  const prev = previousSets.filter(records);
  if (cur.length === 0 || prev.length === 0) return "none";

  const signals: Trend[] = [
    compareTopSets(topSetForSets(cur, fields), topSetForSets(prev, fields), fields),
  ];
  let aggregate: Trend | undefined;

  if (curType === "weight-reps" && prevType === "weight-reps") {
    const volume = (sets: SetEntry[]) =>
      sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0);
    aggregate = deltaTrend(volume(cur) - volume(prev), 0.5);
    signals.push(aggregate);
  }
  if (fields.includes("reps")) {
    const reps = (sets: SetEntry[]) =>
      sets.reduce((s, set) => s + (set.reps ?? 0), 0);
    // ±1 rep across a whole session is noise.
    const repsTrend = deltaTrend(reps(cur) - reps(prev), 1);
    aggregate ??= repsTrend;
    signals.push(repsTrend);
  }

  const isUp = signals.includes("up");
  const isDown = signals.includes("down");
  if (isUp && !isDown) return "up";
  if (isDown && !isUp) return "down";
  if (isUp && isDown) {
    // Mixed signals (e.g. heavier top set but fewer total reps from a shorter
    // session). Prefer "flat" unless the aggregate delta is unambiguous.
    return aggregate && aggregate !== "flat" ? aggregate : "flat";
  }
  return "flat";
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
