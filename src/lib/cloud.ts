"use client";

import { getSupabase } from "./supabase";
import type { Exercise, Workout, WorkoutTemplate } from "./types";

/** Get the current Supabase user ID, or null if not signed in. */
async function currentUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

// ----- Row <-> domain mappers -----

type ExerciseRow = {
  id: string;
  user_id: string;
  name: string;
  muscle_group: string;
  notes: string | null;
  created_at: number;
  archived: boolean | null;
};

type WorkoutRow = {
  id: string;
  user_id: string;
  date: string;
  created_at: number;
  name: string | null;
  bodyweight: number | null;
  exercises: Workout["exercises"];
  note: string | null;
};

function rowToExercise(r: ExerciseRow): Exercise {
  return {
    id: r.id,
    name: r.name,
    muscleGroup: r.muscle_group as Exercise["muscleGroup"],
    notes: r.notes ?? undefined,
    createdAt: Number(r.created_at),
    archived: r.archived ?? false,
  };
}

function exerciseToRow(ex: Exercise): Omit<ExerciseRow, "user_id"> {
  return {
    id: ex.id,
    name: ex.name,
    muscle_group: ex.muscleGroup,
    notes: ex.notes ?? null,
    created_at: ex.createdAt,
    archived: ex.archived ?? false,
  };
}

function rowToWorkout(r: WorkoutRow): Workout {
  return {
    id: r.id,
    date: r.date,
    createdAt: Number(r.created_at),
    name: r.name ?? undefined,
    bodyweight: r.bodyweight ?? undefined,
    exercises: r.exercises ?? [],
    note: r.note ?? undefined,
  };
}

function workoutToRow(w: Workout): Omit<WorkoutRow, "user_id"> {
  return {
    id: w.id,
    date: w.date,
    created_at: w.createdAt,
    name: w.name ?? null,
    bodyweight: w.bodyweight ?? null,
    exercises: w.exercises,
    note: w.note ?? null,
  };
}

// ----- Reads -----

export async function fetchAllExercises(): Promise<Exercise[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("exercises")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToExercise(r as ExerciseRow));
}

export async function fetchAllWorkouts(): Promise<Workout[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("workouts")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToWorkout(r as WorkoutRow));
}

// ----- Writes (return the Supabase error so the caller can decide what to do) -----

export async function insertExerciseRemote(
  ex: Exercise
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in" };
  const row = { ...exerciseToRow(ex), user_id: userId };
  const { error } = await sb.from("exercises").insert(row);
  return { error: error?.message ?? null };
}

export async function updateExerciseRemote(
  ex: Exercise
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const { error } = await sb
    .from("exercises")
    .update(exerciseToRow(ex))
    .eq("id", ex.id);
  return { error: error?.message ?? null };
}

export async function deleteExerciseRemote(
  id: string
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const { error } = await sb.from("exercises").delete().eq("id", id);
  return { error: error?.message ?? null };
}

export async function insertWorkoutRemote(
  w: Workout
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in" };
  const row = { ...workoutToRow(w), user_id: userId };
  const { error } = await sb.from("workouts").insert(row);
  return { error: error?.message ?? null };
}

export async function updateWorkoutRemote(
  w: Workout
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const { error } = await sb
    .from("workouts")
    .update(workoutToRow(w))
    .eq("id", w.id);
  return { error: error?.message ?? null };
}

export async function deleteWorkoutRemote(
  id: string
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const { error } = await sb.from("workouts").delete().eq("id", id);
  return { error: error?.message ?? null };
}

// ----- Templates -----

type TemplateRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  exercises: WorkoutTemplate["exercises"];
  archived: boolean | null;
};

function rowToTemplate(r: TemplateRow): WorkoutTemplate {
  return {
    id: r.id,
    name: r.name,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    exercises: r.exercises ?? [],
    archived: r.archived ?? false,
  };
}

function templateToRow(t: WorkoutTemplate): Omit<TemplateRow, "user_id"> {
  return {
    id: t.id,
    name: t.name,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    exercises: t.exercises,
    archived: t.archived ?? false,
  };
}

export async function fetchAllTemplates(): Promise<WorkoutTemplate[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("workout_templates")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToTemplate(r as TemplateRow));
}

export async function insertTemplateRemote(
  t: WorkoutTemplate
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const userId = await currentUserId();
  if (!userId) return { error: "Not signed in" };
  const row = { ...templateToRow(t), user_id: userId };
  const { error } = await sb.from("workout_templates").insert(row);
  return { error: error?.message ?? null };
}

export async function updateTemplateRemote(
  t: WorkoutTemplate
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const { error } = await sb
    .from("workout_templates")
    .update(templateToRow(t))
    .eq("id", t.id);
  return { error: error?.message ?? null };
}

export async function deleteTemplateRemote(
  id: string
): Promise<{ error: string | null }> {
  const sb = getSupabase();
  if (!sb) return { error: "not configured" };
  const { error } = await sb.from("workout_templates").delete().eq("id", id);
  return { error: error?.message ?? null };
}
