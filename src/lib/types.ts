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

export type SetType =
  | "weight-reps" // weight × reps (default, e.g. bench press)
  | "reps" // bodyweight + reps (e.g. pull-ups, dips)
  | "weight-time" // weight × duration (e.g. suitcase carry 32kg × 1min)
  | "time" // duration only (e.g. plank 60s)
  | "distance-time" // distance + time (e.g. ran 5km in 28min)
  | "weight-distance"; // weight × distance (e.g. sled push 50kg × 30m)

export interface SetEntry {
  id: string;
  type?: SetType; // defaults to "weight-reps" when missing (back-compat)
  // Weight (kg). Used for weight-reps and weight-time and weight-distance.
  weight?: number;
  // Reps. Used for weight-reps and reps.
  reps?: number;
  // Duration in seconds. Used for weight-time and time and distance-time.
  duration?: number;
  // Distance in meters. Used for distance-time and weight-distance.
  distance?: number;
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
