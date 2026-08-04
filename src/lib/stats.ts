import type {
  Exercise,
  ExerciseProgressPoint,
  WeeklyVolume,
  Workout,
  WorkoutExercise,
} from "./types";

// Get the Monday of the week containing the given date (ISO yyyy-mm-dd)
export function weekStartOf(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function totalVolume(workout: Workout): number {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0),
    0
  );
}

export function totalSets(workout: Workout): number {
  return workout.exercises.reduce((s, ex) => s + ex.sets.length, 0);
}

export function totalReps(workout: Workout): number {
  return workout.exercises.reduce(
    (s, ex) => s + ex.sets.reduce((ss, set) => ss + set.reps, 0),
    0
  );
}

// Epley formula
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
    const maxWeight = Math.max(...ex.sets.map((s) => s.weight));
    const topSet = ex.sets.reduce(
      (best, s) => (s.weight > best.weight ? s : best),
      ex.sets[0]
    );
    const totalVol = ex.sets.reduce((s, set) => s + set.weight * set.reps, 0);
    const totalReps = ex.sets.reduce((s, set) => s + set.reps, 0);
    points.push({
      date: w.date,
      maxWeight,
      topSetVolume: topSet.weight * topSet.reps,
      totalVolume: totalVol,
      totalReps,
      estimated1RM: estimated1RM(maxWeight, topSet.reps),
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
      const e1rm = estimated1RM(s.weight, s.reps);
      if (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) {
        best = { weight: s.weight, reps: s.reps, date: w.date, estimated1RM: e1rm };
      }
    }
  }
  return best;
}

// Returns last N weeks of weekly volume. Pads earlier weeks with zeros if missing.
export function lastNWeeksVolume(workouts: Workout[], n: number): WeeklyVolume[] {
  const weekly = weeklyVolumes(workouts);
  const result: WeeklyVolume[] = [];
  const today = new Date();
  const currentWeekStart = new Date(weekStartOf(today.toISOString().slice(0, 10)) + "T00:00:00");

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    const found = weekly.find((w) => w.weekStart === key);
    result.push(
      found ?? { weekStart: key, volume: 0, totalSets: 0, totalReps: 0 }
    );
  }
  return result;
}

export function thisWeekVsLastWeek(workouts: Workout[]): {
  thisWeek: WeeklyVolume;
  lastWeek: WeeklyVolume;
  volumeDelta: number;
  volumeDeltaPct: number;
  setsDelta: number;
} | null {
  const last = lastNWeeksVolume(workouts, 2);
  if (last.length < 2) return null;
  const [lastWeek, thisWeek] = last;
  const volumeDelta = thisWeek.volume - lastWeek.volume;
  const volumeDeltaPct =
    lastWeek.volume > 0 ? (volumeDelta / lastWeek.volume) * 100 : thisWeek.volume > 0 ? 100 : 0;
  return {
    thisWeek,
    lastWeek,
    volumeDelta,
    volumeDeltaPct,
    setsDelta: thisWeek.totalSets - lastWeek.totalSets,
  };
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
