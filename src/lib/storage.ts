"use client";

import type { Exercise, Workout, WorkoutTemplate } from "./types";
import {
  deleteExerciseRemote,
  deleteTemplateRemote,
  deleteWorkoutRemote,
  fetchAllExercises,
  fetchAllTemplates,
  fetchAllWorkouts,
  insertExerciseRemote,
  insertTemplateRemote,
  insertWorkoutRemote,
  updateExerciseRemote,
  updateTemplateRemote,
  updateWorkoutRemote,
} from "./cloud";
import { getSupabase } from "./supabase";

const KEY_EXERCISES = "gym.exercises.v1";
const KEY_WORKOUTS = "gym.workouts.v1";
const KEY_TEMPLATES = "gym.templates.v1";
const KEY_SEEDED = "gym.seeded.v1";
const KEY_PENDING = "gym.pending.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Failed to write to localStorage", err);
  }
}

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ----- Pending op queue (offline-safe writes) -----

type PendingOp =
  | { op: "insert"; table: "exercises"; row: Record<string, unknown> }
  | { op: "update"; table: "exercises"; id: string; row: Record<string, unknown> }
  | { op: "delete"; table: "exercises"; id: string }
  | { op: "insert"; table: "workouts"; row: Record<string, unknown> }
  | { op: "update"; table: "workouts"; id: string; row: Record<string, unknown> }
  | { op: "delete"; table: "workouts"; id: string }
  | { op: "insert"; table: "workout_templates"; row: Record<string, unknown> }
  | { op: "update"; table: "workout_templates"; id: string; row: Record<string, unknown> }
  | { op: "delete"; table: "workout_templates"; id: string };

function getPending(): PendingOp[] {
  return readJSON<PendingOp[]>(KEY_PENDING, []);
}
function setPending(ops: PendingOp[]) {
  writeJSON(KEY_PENDING, ops);
}
function enqueue(op: PendingOp) {
  const ops = getPending();
  // dedupe consecutive same-id operations on the same record
  const filtered = ops.filter((p) => {
    if (p.table !== op.table) return true;
    if ("id" in p && "id" in op && p.id === op.id) return false;
    return true;
  });
  filtered.push(op);
  setPending(filtered);
}

let flushing = false;
export async function flushPending(): Promise<{ remaining: number; lastError?: string }> {
  if (flushing) return { remaining: getPending().length };
  if (!getSupabase()) return { remaining: getPending().length };
  flushing = true;
  try {
    let ops = getPending();
    let lastError: string | undefined;
    let safety = ops.length + 1;
    while (ops.length > 0 && safety-- > 0) {
      const remaining: PendingOp[] = [];
      let madeProgress = false;
      for (const o of ops) {
        let err: string | null = null;
        try {
          if (o.table === "exercises") {
            if (o.op === "insert") {
              const r = await insertExerciseRemote(o.row as unknown as Exercise);
              err = r.error;
            } else if (o.op === "update") {
              const r = await updateExerciseRemote(o.row as unknown as Exercise);
              err = r.error;
            } else {
              const r = await deleteExerciseRemote(o.id);
              err = r.error;
            }
          } else if (o.table === "workouts") {
            if (o.op === "insert") {
              const r = await insertWorkoutRemote(o.row as unknown as Workout);
              err = r.error;
            } else if (o.op === "update") {
              const r = await updateWorkoutRemote(o.row as unknown as Workout);
              err = r.error;
            } else {
              const r = await deleteWorkoutRemote(o.id);
              err = r.error;
            }
          } else {
            if (o.op === "insert") {
              const r = await insertTemplateRemote(o.row as unknown as WorkoutTemplate);
              err = r.error;
            } else if (o.op === "update") {
              const r = await updateTemplateRemote(o.row as unknown as WorkoutTemplate);
              err = r.error;
            } else {
              const r = await deleteTemplateRemote(o.id);
              err = r.error;
            }
          }
        } catch (e) {
          err = (e as Error).message;
        }
        if (err) {
          lastError = err;
          remaining.push(o);
        } else {
          madeProgress = true;
        }
      }
      ops = remaining;
      if (!madeProgress) break; // avoid infinite loop if all ops fail
    }
    setPending(ops);
    // If anything is still pending, schedule a background retry. This means
    // a single failed push (e.g. transient network blip) doesn't leave the
    // queue stuck — we keep trying with backoff until it drains or the user
    // explicitly discards.
    if (ops.length > 0) {
      scheduleBackgroundRetry();
    }
    return { remaining: ops.length, lastError };
  } finally {
    flushing = false;
  }
}

// ----- Background retry with exponential backoff -----
//
// After any save, we already call flushPending() which attempts the push
// immediately. If it fails, instead of waiting for the user to click
// "Retry push" or for them to make another change, we schedule retries
// in the background with exponential backoff. We also kick a retry on
// window focus and on the browser "online" event so the queue drains
// automatically when the user comes back to the app or their connection
// comes back.

const RETRY_DELAYS_MS = [
  1_000, //   1 s
  5_000, //   5 s
  15_000, // 15 s
  60_000, //  1 min
  300_000, //  5 min
  600_000, // 10 min  (cap)
];

let retryAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backgroundRetryInitialized = false;

function clearRetryTimer() {
  if (retryTimer != null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleBackgroundRetry() {
  if (typeof window === "undefined") return;
  if (!getSupabase()) return; // not configured — nothing to push to
  if (getPendingCount() === 0) {
    retryAttempt = 0;
    return;
  }
  if (retryTimer != null) return; // a retry is already pending

  const delay =
    RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];

  retryTimer = setTimeout(async () => {
    retryTimer = null;
    if (getPendingCount() === 0) {
      retryAttempt = 0;
      return;
    }
    const r = await flushPending();
    if (r.remaining === 0) {
      // Drained — reset backoff and notify the UI.
      retryAttempt = 0;
      window.dispatchEvent(new CustomEvent("gym:sync-success"));
    } else {
      // Still failing — bump attempt and re-schedule.
      retryAttempt++;
      window.dispatchEvent(
        new CustomEvent("gym:sync-failed", { detail: r })
      );
      scheduleBackgroundRetry();
    }
  }, delay);
}

/** Reset the backoff (e.g. after the user re-auths or comes back online). */
function resetBackgroundRetry() {
  retryAttempt = 0;
  clearRetryTimer();
  if (getPendingCount() > 0) {
    scheduleBackgroundRetry();
  }
}

/**
 * Wire up window focus + online listeners so the queue retries the moment
 * the user comes back to the app or their connection comes back. Safe to
 * call multiple times. Idempotent.
 */
export function initBackgroundSync() {
  if (typeof window === "undefined") return;
  if (backgroundRetryInitialized) return;
  backgroundRetryInitialized = true;

  // Try once on boot, in case the queue has stale writes from a previous
  // session (offline, backgrounded tab, etc.).
  if (getPendingCount() > 0) {
    scheduleBackgroundRetry();
  }

  // App foregrounded → flush immediately, with a fresh backoff.
  window.addEventListener("focus", resetBackgroundRetry);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resetBackgroundRetry();
    }
  });

  // Network came back online → try again.
  window.addEventListener("online", resetBackgroundRetry);
}

// ----- Exercises -----

export function getExercises(): Exercise[] {
  return readJSON<Exercise[]>(KEY_EXERCISES, []);
}

function saveExercisesLocal(items: Exercise[]) {
  writeJSON(KEY_EXERCISES, items);
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent("gym:data-changed"));
  }
}

export function addExercise(
  input: Omit<Exercise, "id" | "createdAt">
): Exercise {
  const ex: Exercise = { ...input, id: uid(), createdAt: Date.now() };
  const items = getExercises();
  saveExercisesLocal([ex, ...items]);
  enqueue({ op: "insert", table: "exercises", row: ex as unknown as Record<string, unknown> });
  flushPending().catch(() => {});
  return ex;
}

export function updateExercise(id: string, patch: Partial<Exercise>) {
  const items = getExercises().map((e) => (e.id === id ? { ...e, ...patch } : e));
  saveExercisesLocal(items);
  const updated = items.find((e) => e.id === id);
  if (updated) {
    enqueue({ op: "update", table: "exercises", id, row: updated as unknown as Record<string, unknown> });
    flushPending().catch(() => {});
  }
}

export function deleteExercise(id: string) {
  saveExercisesLocal(getExercises().filter((e) => e.id !== id));
  enqueue({ op: "delete", table: "exercises", id });
  flushPending().catch(() => {});
}

// ----- Workouts -----

export function getWorkouts(): Workout[] {
  const items = readJSON<Workout[]>(KEY_WORKOUTS, []);
  return items.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );
}

function saveWorkoutsLocal(items: Workout[]) {
  writeJSON(KEY_WORKOUTS, items);
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent("gym:data-changed"));
  }
}

export function getWorkout(id: string): Workout | undefined {
  return getWorkouts().find((w) => w.id === id);
}

export function addWorkout(
  input: Omit<Workout, "id" | "createdAt">
): Workout {
  const w: Workout = { ...input, id: uid(), createdAt: Date.now() };
  const all = getWorkouts();
  saveWorkoutsLocal([w, ...all]);
  enqueue({ op: "insert", table: "workouts", row: w as unknown as Record<string, unknown> });
  flushPending().catch(() => {});
  return w;
}

export function updateWorkout(id: string, patch: Partial<Workout>) {
  const all = getWorkouts().map((w) => (w.id === id ? { ...w, ...patch } : w));
  saveWorkoutsLocal(all);
  const updated = all.find((w) => w.id === id);
  if (updated) {
    enqueue({ op: "update", table: "workouts", id, row: updated as unknown as Record<string, unknown> });
    flushPending().catch(() => {});
  }
}

export function deleteWorkout(id: string) {
  saveWorkoutsLocal(getWorkouts().filter((w) => w.id !== id));
  enqueue({ op: "delete", table: "workouts", id });
  flushPending().catch(() => {});
}

// ----- Templates -----

export function getTemplates(): WorkoutTemplate[] {
  const items = readJSON<WorkoutTemplate[]>(KEY_TEMPLATES, []);
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

function saveTemplatesLocal(items: WorkoutTemplate[]) {
  writeJSON(KEY_TEMPLATES, items);
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent("gym:data-changed"));
  }
}

export function getTemplate(id: string): WorkoutTemplate | undefined {
  return getTemplates().find((t) => t.id === id);
}

export function addTemplate(
  input: Omit<WorkoutTemplate, "id" | "createdAt" | "updatedAt">
): WorkoutTemplate {
  const now = Date.now();
  const t: WorkoutTemplate = {
    ...input,
    id: uid(),
    createdAt: now,
    updatedAt: now,
  };
  saveTemplatesLocal([t, ...getTemplates()]);
  enqueue({ op: "insert", table: "workout_templates", row: t as unknown as Record<string, unknown> });
  flushPending().catch(() => {});
  return t;
}

export function updateTemplate(id: string, patch: Partial<WorkoutTemplate>) {
  const all = getTemplates().map((t) =>
    t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
  );
  saveTemplatesLocal(all);
  const updated = all.find((t) => t.id === id);
  if (updated) {
    enqueue({ op: "update", table: "workout_templates", id, row: updated as unknown as Record<string, unknown> });
    flushPending().catch(() => {});
  }
}

export function deleteTemplate(id: string) {
  saveTemplatesLocal(getTemplates().filter((t) => t.id !== id));
  enqueue({ op: "delete", table: "workout_templates", id });
  flushPending().catch(() => {});
}

// ----- Seeding -----

export function hasSeeded(): boolean {
  return readJSON<boolean>(KEY_SEEDED, false);
}

export function markSeeded() {
  writeJSON(KEY_SEEDED, true);
}

// ----- Reset / Sign-out -----

/**
 * Wipe the local cache. We deliberately do NOT clear `KEY_PENDING` here — if
 * the user is signing out to re-authenticate (e.g. an expired session), we
 * want their queued writes to survive so they can be retried automatically
 * after sign-in. To deliberately discard pending writes, call
 * `discardPendingWrites()` separately.
 */
export function clearLocal() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_EXERCISES);
  window.localStorage.removeItem(KEY_WORKOUTS);
  window.localStorage.removeItem(KEY_TEMPLATES);
  window.localStorage.removeItem(KEY_SEEDED);
  window.dispatchEvent(new CustomEvent("gym:data-changed"));
}

/** Drop any queued cloud writes. Use this only if you're sure you don't want
 *  them to be retried (e.g. switching to a different account). */
export function discardPendingWrites(): number {
  if (!isBrowser()) return 0;
  const ops = getPending();
  setPending([]);
  window.dispatchEvent(new CustomEvent("gym:data-changed"));
  return ops.length;
}

// ----- Cloud sync helpers -----

/** Pull all data from the cloud and replace the local cache. */
export async function pullFromCloud(): Promise<{
  exercises: Exercise[];
  workouts: Workout[];
  templates: WorkoutTemplate[];
}> {
  if (!getSupabase()) return { exercises: [], workouts: [], templates: [] };
  // Flush any pending writes first so we don't overwrite them
  await flushPending();
  const [exercises, workouts, templates] = await Promise.all([
    fetchAllExercises(),
    fetchAllWorkouts(),
    fetchAllTemplates(),
  ]);
  saveExercisesLocal(exercises);
  saveWorkoutsLocal(workouts);
  saveTemplatesLocal(templates);
  // Clear pending ops since cloud is now the source of truth
  setPending([]);
  return { exercises, workouts, templates };
}

export function getPendingCount(): number {
  return getPending().length;
}

/** Push the entire local cache to the cloud (used on first sign-in). */
export async function pushToCloud(): Promise<{ pushed: number; remaining: number }> {
  const exs = getExercises();
  const wks = getWorkouts();
  const tpls = getTemplates();
  for (const ex of exs) {
    enqueue({ op: "insert", table: "exercises", row: ex as unknown as Record<string, unknown> });
  }
  for (const w of wks) {
    enqueue({ op: "insert", table: "workouts", row: w as unknown as Record<string, unknown> });
  }
  for (const t of tpls) {
    enqueue({ op: "insert", table: "workout_templates", row: t as unknown as Record<string, unknown> });
  }
  const { remaining } = await flushPending();
  return { pushed: exs.length + wks.length + tpls.length, remaining };
}
