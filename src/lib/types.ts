// Core data model for the gym tracker

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "legs"
  | "glutes"
  | "arms"
  | "core"
  | "cardio"
  | "other";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  notes?: string;
  createdAt: number; // epoch ms
  archived?: boolean;
}

export interface SetEntry {
  id: string;
  weight: number; // in kg
  reps: number;
  // optional RPE (rate of perceived exertion) 1-10
  rpe?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  // For display ordering within a workout
  order: number;
  sets: SetEntry[];
  // optional note for the whole exercise block
  note?: string;
}

export interface Workout {
  id: string;
  // ISO date string YYYY-MM-DD (workout date, may differ from createdAt)
  date: string;
  createdAt: number;
  // optional name like "Push day", "Legs A"
  name?: string;
  // bodyweight in kg on the day (optional)
  bodyweight?: number;
  exercises: WorkoutExercise[];
  note?: string;
}

export interface TemplateExercise {
  id: string;
  exerciseId: string;
  order: number;
  // Pre-fill values for new workouts started from this template
  defaultSets: number;
  defaultReps: number;
  defaultWeight?: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  exercises: TemplateExercise[];
  archived?: boolean;
}

// Computed / derived types used by charts and stats

export interface WeeklyVolume {
  weekStart: string; // ISO date of the Monday of that week
  volume: number; // sum of (weight * reps) for that week
  totalSets: number;
  totalReps: number;
}

export interface ExerciseProgressPoint {
  date: string; // ISO date
  maxWeight: number; // heaviest single set
  topSetVolume: number; // weight * reps of heaviest set
  totalVolume: number; // sum of weight * reps across all sets that day
  totalReps: number;
  estimated1RM: number; // Epley: weight * (1 + reps/30)
}

export interface ExercisePR {
  exerciseId: string;
  weight: number;
  reps: number;
  estimated1RM: number;
  date: string;
}
