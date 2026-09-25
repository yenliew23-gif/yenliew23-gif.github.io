import type {
  Exercise,
  ExerciseProgressPoint,
  MuscleGroup,
  SetEntry,
  WeeklyVolume,
  Workout,
  WorkoutExercise,
} from "./types";
import { formatLocalDate, todayLocalISO } from "./format";

// Get the Monday of the week containing the given date (ISO yyyy-mm-dd)
export function weekStartOf(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return formatLocalDate(d);
}

/** True when this set is a "weight × reps" set (the only kind that counts toward
 *  traditional volume and 1RM numbers). */
export function isWeightRepsSet(set: SetEntry): boolean {
  return (set.type ?? "weight-reps") === "weight-reps";
}

/** True when this set tracks reps at all (weight-reps or reps-only). */
export function hasReps(set: SetEntry): boolean {
  const t = set.type ?? "weight-reps";
  return t === "weight-reps" || t === "reps";
}

/** Sum of (weight * reps) for weight-reps sets only.
 *  Reps-only, time-based, and distance-based sets do not contribute. */
function blockVolume(ex: WorkoutExercise): number {
  return ex.sets.reduce(
    (sum, set) => (isWeightRepsSet(set) ? sum + (set.weight ?? 0) * (set.reps ?? 0) : sum),
    0
  );
}

/** Total reps for sets that track reps (weight-reps + reps-only). */
function blockReps(ex: WorkoutExercise): number {
  return ex.sets.reduce(
    (sum, set) => (hasReps(set) ? sum + (set.reps ?? 0) : sum),
    0
  );
}

export function totalVolume(workout: Workout): number {
  return workout.exercises.reduce((sum, ex) => sum + blockVolume(ex), 0);
}

export function totalSets(workout: Workout): number {
  return workout.exercises.reduce((s, ex) => s + ex.sets.length, 0);
}

export function totalReps(workout: Workout): number {
  return workout.exercises.reduce((s, ex) => s + blockReps(ex), 0);
}

// Epley formula — only meaningful for weight-reps sets.
export function estimated1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export function weeklyVolumes(workouts: Workout[]): WeeklyVolume[] {
  const buckets = new Map<string, WeeklyVolume>();
  for (const w of workouts) {
    const wk = weekStartOf(w.date);
    const v = totalVolume(w);
    const sets = totalSets(w);
    const reps = totalReps(w);
    const cur = buckets.get(wk);
    if (cur) {
      cur.volume += v;
      cur.totalSets += sets;
      cur.totalReps += reps;
    } else {
      buckets.set(wk, { weekStart: wk, volume: v, totalSets: sets, totalReps: reps });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export function progressByExercise(
  workouts: Workout[],
  exerciseId: string
): ExerciseProgressPoint[] {
  const points: ExerciseProgressPoint[] = [];
  for (const w of workouts) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex || ex.sets.length === 0) continue;

    // Volume / weight / 1RM only consider weight × reps sets.
    const wrSets = ex.sets.filter(isWeightRepsSet);
    if (wrSets.length === 0) {
      // No traditional lifts in this workout — record a zero point so the date shows up.
      points.push({
        date: w.date,
        maxWeight: 0,
        topSetVolume: 0,
        totalVolume: 0,
        totalReps: blockReps(ex),
        estimated1RM: 0,
      });
      continue;
    }

    const maxWeight = Math.max(...wrSets.map((s) => s.weight ?? 0));
    const topSet = wrSets.reduce(
      (best, s) => ((s.weight ?? 0) > (best.weight ?? 0) ? s : best),
      wrSets[0]
    );
    const totalVol = wrSets.reduce(
      (s, set) => s + (set.weight ?? 0) * (set.reps ?? 0),
      0
    );

    points.push({
      date: w.date,
      maxWeight,
      topSetVolume: (topSet.weight ?? 0) * (topSet.reps ?? 0),
      totalVolume: totalVol,
      totalReps: blockReps(ex),
      estimated1RM: estimated1RM(topSet.weight ?? 0, topSet.reps ?? 0),
    });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

export function personalRecord(
  workouts: Workout[],
  exerciseId: string
): { weight: number; reps: number; date: string; estimated1RM: number } | null {
  let best: { weight: number; reps: number; date: string; estimated1RM: number } | null = null;
  for (const w of workouts) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    for (const s of ex.sets) {
      if (!isWeightRepsSet(s)) continue;
      const w0 = s.weight ?? 0;
      const r0 = s.reps ?? 0;
      const e1rm = estimated1RM(w0, r0);
      if (!best || w0 > best.weight || (w0 === best.weight && r0 > best.reps)) {
        best = { weight: w0, reps: r0, date: w.date, estimated1RM: e1rm };
      }
    }
  }
  return best;
}

/**
 * For an exercise: the heaviest weight-reps set the user has ever logged
 * (single set), plus the FULL sequence of weight-reps sets from the most
 * recent workout that contained the exercise. Used by the workout editor
 * pre-fill to show the user's all-time best with the last workout's sets as
 * a footnote for comparison.
 *
 * `lastSets` is a list (not a single set) so the user can see the full
 * progression from their previous session — e.g. "60kg×10, 50kg×8, 50kg×8"
 * instead of just "60kg×10".
 *
 * Returns `null` / `[]` for each field when there's no usable history —
 * callers can detect that and fall back to template defaults.
 */
export function bestAndLastForExercise(
  workouts: Workout[],
  exerciseId: string
): {
  best: { weight: number; reps: number; date: string } | null;
  lastSets: { weight: number; reps: number; date: string }[];
  lastDate: string | null;
} {
  let best: { weight: number; reps: number; date: string } | null = null;
  let lastSets: { weight: number; reps: number; date: string }[] = [];
  let lastDate: string | null = null;

  // We want the most recent workout (by date) that contained this exercise.
  // Iterate and track the latest date seen so far; once we find a later
  // date, replace lastSets with that workout's sets.
  for (const w of workouts) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const wrSets = ex.sets.filter(isWeightRepsSet);
    if (wrSets.length === 0) continue;

    for (const s of wrSets) {
      const w0 = s.weight ?? 0;
      const r0 = s.reps ?? 0;
      const candidate = { weight: w0, reps: r0, date: w.date };
      // Heaviest weight first; tie-break on more reps.
      if (
        !best ||
        w0 > best.weight ||
        (w0 === best.weight && r0 > best.reps)
      ) {
        best = candidate;
      }
    }

    // Track the most recent workout date. We replace lastSets only when we
    // find a strictly later date — this preserves the chronological order
    // of the original sets within that workout.
    if (lastDate === null || w.date > lastDate) {
      lastDate = w.date;
      lastSets = wrSets.map((s) => ({
        weight: s.weight ?? 0,
        reps: s.reps ?? 0,
        date: w.date,
      }));
    }
  }

  return { best, lastSets, lastDate };
}

// Returns last N weeks of weekly volume. Pads earlier weeks with zeros if missing.
export function lastNWeeksVolume(workouts: Workout[], n: number): WeeklyVolume[] {
  const weekly = weeklyVolumes(workouts);
  const result: WeeklyVolume[] = [];
  // todayLocalISO() gives the current yyyy-mm-dd in the user's timezone, so
  // "this week" is anchored to local Monday — not UTC Monday.
  const currentWeekStart = new Date(weekStartOf(todayLocalISO()) + "T00:00:00");

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - i * 7);
    const key = formatLocalDate(d);
    const found = weekly.find((w) => w.weekStart === key);
    result.push(
      found ?? { weekStart: key, volume: 0, totalSets: 0, totalReps: 0 }
    );
  }
  return result;
}

export function thisWeekVsLastWeek(
  workouts: Workout[],
  exercises: Exercise[] = []
): {
  thisWeek: WeeklyVolume;
  lastWeek: WeeklyVolume;
  volumeDelta: number;
  volumeDeltaPct: number;
  setsDelta: number;
  /** Set counts broken down by muscle group for both weeks. Only groups
   *  with at least one set are included, so the home page can render a
   *  compact list like "chest 12 · back 18 · arms 22". */
  setsByMuscle: {
    thisWeek: Partial<Record<MuscleGroup, number>>;
    lastWeek: Partial<Record<MuscleGroup, number>>;
  };
} | null {
  const last = lastNWeeksVolume(workouts, 2);
  if (last.length < 2) return null;
  const [lastWeek, thisWeek] = last;
  const volumeDelta = thisWeek.volume - lastWeek.volume;
  const volumeDeltaPct =
    lastWeek.volume > 0 ? (volumeDelta / lastWeek.volume) * 100 : thisWeek.volume > 0 ? 100 : 0;

  // Bucket set counts by muscle group for both weeks. We work from the raw
  // workouts (not the aggregated WeeklyVolume) because WeeklyVolume only
  // tracks totals — we need per-set-type breakdown by group.
  //
  // If the caller didn't pass exercises (or passed [] before the
  // useExercises hook populated), fall back to reading localStorage
  // synchronously so we don't render a misleading "No sets logged yet"
  // on first paint. See the same pattern in log/page.tsx.
  const exerciseMap =
    exercises.length > 0
      ? new Map(exercises.map((e) => [e.id, e.muscleGroup] as const))
      : exercisesFromStorageMap();
  const thisWeekStart = thisWeek.weekStart;
  const lastWeekStart = lastWeek.weekStart;
  const setsByMuscleThisWeek: Partial<Record<MuscleGroup, number>> = {};
  const setsByMuscleLastWeek: Partial<Record<MuscleGroup, number>> = {};
  for (const w of workouts) {
    const bucket =
      w.date === thisWeekStart
        ? setsByMuscleThisWeek
        : w.date === lastWeekStart
        ? setsByMuscleLastWeek
        : null;
    if (!bucket) continue;
    for (const block of w.exercises) {
      const group = exerciseMap.get(block.exerciseId);
      if (!group) continue;
      bucket[group] = (bucket[group] ?? 0) + block.sets.length;
    }
  }

  return {
    thisWeek,
    lastWeek,
    volumeDelta,
    volumeDeltaPct,
    setsDelta: thisWeek.totalSets - lastWeek.totalSets,
    setsByMuscle: {
      thisWeek: setsByMuscleThisWeek,
      lastWeek: setsByMuscleLastWeek,
    },
  };
}

/** Read exercises directly from localStorage and return an id → muscleGroup
 *  map. Used as a fallback when callers don't have the exercises list yet
 *  (the useExercises hook returns [] on first paint). Returns an empty map
 *  on any failure or non-browser environment. */
function exercisesFromStorageMap(): Map<string, MuscleGroup> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem("gym.exercises.v1");
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const m = new Map<string, MuscleGroup>();
    for (const ex of parsed as Array<{ id: string; muscleGroup: MuscleGroup }>) {
      if (ex && typeof ex.id === "string" && ex.muscleGroup) {
        m.set(ex.id, ex.muscleGroup);
      }
    }
    return m;
  } catch {
    return new Map();
  }
}

export function uniqueExercisesUsed(workouts: Workout[]): string[] {
  const set = new Set<string>();
  for (const w of workouts) for (const e of w.exercises) set.add(e.exerciseId);
  return Array.from(set);
}

export function exerciseById(exercises: Exercise[], id: string): Exercise | undefined {
  return exercises.find((e) => e.id === id);
}

export function workoutSummary(workout: Workout, exercises: Exercise[]): string {
  const names = workout.exercises
    .map((e) => exerciseById(exercises, e.exerciseId)?.name)
    .filter(Boolean) as string[];
  if (names.length === 0) return "Empty workout";
  if (names.length <= 3) return names.join(" · ");
  return `${names.slice(0, 3).join(" · ")} +${names.length - 3} more`;
}

export function findExerciseBlock(
  exercises: WorkoutExercise[],
  exerciseId: string
): WorkoutExercise | undefined {
  return exercises.find((e) => e.exerciseId === exerciseId);
}
