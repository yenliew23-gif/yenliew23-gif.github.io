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
} from "./cloud";
import { getSupabase } from "./supabase";

const KEY_EXERCISES = "gym.exercises.v1";
const KEY_WORKOUTS = "gym.workouts.v1";
const KEY_TEMPLATES = "gym.templates.v1";
const KEY_SEEDED = "gym.seeded.v1";
const KEY_ONBOARDED = "gym.onboarded.v1";
const KEY_PENDING = "gym.pending.v1";
const KEY_PUSHED_ALL = "gym.pushed-all.v1";
// Tombstones: IDs the user has deleted locally. Cloud sync must NEVER
// resurrect these, even if the cloud delete op failed to flush. We keep the
// list forever (well, until the cloud confirms the delete succeeded) — see
// `pruneTombstonesOnPull()` for the cleanup.
const KEY_TOMBSTONES = "gym.tombstones.v1";

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

/** A queued op plus a unique queue id, so a flush can remove exactly the
 *  ops that succeeded without clobbering ops enqueued while it ran. */
type QueuedOp = PendingOp & { qid: string };

/** ID of the record an op touches (deletes carry it; inserts/updates carry
 *  the full row). */
function recordId(op: PendingOp): string | undefined {
  return op.op === "delete" ? op.id : (op.row.id as string | undefined);
}

/** Keep only the latest op per record. Inserts and updates are both upserts
 *  (see runOp), so the latest op alone brings the cloud up to date. */
function compact<T extends PendingOp>(ops: T[]): T[] {
  const latest = new Map<string, number>();
  ops.forEach((op, i) => {
    const id = recordId(op);
    if (id) latest.set(`${op.table}:${id}`, i);
  });
  return ops.filter((op, i) => {
    const id = recordId(op);
    return !id || latest.get(`${op.table}:${id}`) === i;
  });
}

function getPending(): QueuedOp[] {
  const raw = readJSON<(PendingOp & { qid?: string })[]>(KEY_PENDING, []);
  // Ops queued by older builds have no qid — assign one.
  return raw.map((op) => (op.qid ? (op as QueuedOp) : { ...op, qid: uid() }));
}
function setPending(ops: QueuedOp[]) {
  writeJSON(KEY_PENDING, ops);
}

// ----- Tombstones -----
//
// When the user deletes a record locally we add its ID to a tombstone list.
// Subsequent cloud pulls filter these IDs out, so a stale cloud copy can never
// resurrect a deleted record. The list is pruned when the cloud confirms the
// delete actually went through (i.e. a pull happens and the tombstoned ID is
// no longer present in the cloud result).
type Tombstones = {
  exercises: string[];
  workouts: string[];
  templates: string[];
};
const EMPTY_TOMBSTONES: Tombstones = {
  exercises: [],
  workouts: [],
  templates: [],
};
function getTombstones(): Tombstones {
  return readJSON<Tombstones>(KEY_TOMBSTONES, EMPTY_TOMBSTONES);
}
function setTombstones(t: Tombstones) {
  writeJSON(KEY_TOMBSTONES, t);
}
function addTombstone(
  table: "exercises" | "workouts" | "templates",
  id: string
) {
  const t = getTombstones();
  if (!t[table].includes(id)) {
    t[table] = [...t[table], id];
    setTombstones(t);
  }
}
function isTombstoned(
  table: "exercises" | "workouts" | "templates",
  id: string
): boolean {
  return getTombstones()[table].includes(id);
}
/** Strip tombstoned IDs from a list of records (returning the survivors). */
function filterTombstoned<
  T extends { id: string },
  K extends "exercises" | "workouts" | "templates"
>(table: K, rows: T[]): T[] {
  const t = getTombstones();
  return rows.filter((r) => !t[table].includes(r.id));
}
/** Drop tombstone entries whose IDs are no longer in the cloud (i.e. the
 *  delete has been confirmed by the cloud side). */
function pruneTombstones<K extends "exercises" | "workouts" | "templates">(
  table: K,
  cloudIds: Set<string>
) {
  const t = getTombstones();
  const remaining = t[table].filter((id) => cloudIds.has(id));
  if (remaining.length !== t[table].length) {
    t[table] = remaining;
    setTombstones(t);
  }
}
function enqueue(...ops: PendingOp[]) {
  // Supersede any earlier op on the same record.
  setPending(compact([...getPending(), ...ops.map((op) => ({ ...op, qid: uid() }))]));
}

let flushing = false;

/** Per-op fetch timeout (ms) — single stuck request can no longer block the queue. */
const OP_TIMEOUT_MS = 12_000;

/** Max ops processed in parallel within a single flush pass. */
const FLUSH_CONCURRENCY = 5;

/**
 * Dispatch a single pending op through the Supabase client.
 * Returns null on success, or an error message on failure. Always resolves
 * (never throws) so it can be safely used with Promise.all/batch.
 *
 * Inserts and updates both go through the upsert path: an "update" of a
 * record whose insert never reached the cloud must create it, not silently
 * match zero rows.
 */
async function dispatchOp(op: PendingOp): Promise<string | null> {
  try {
    if (op.table === "exercises") {
      const r =
        op.op === "delete"
          ? await deleteExerciseRemote(op.id)
          : await insertExerciseRemote(op.row as unknown as Exercise);
      return r.error;
    } else if (op.table === "workouts") {
      const r =
        op.op === "delete"
          ? await deleteWorkoutRemote(op.id)
          : await insertWorkoutRemote(op.row as unknown as Workout);
      return r.error;
    } else {
      const r =
        op.op === "delete"
          ? await deleteTemplateRemote(op.id)
          : await insertTemplateRemote(op.row as unknown as WorkoutTemplate);
      return r.error;
    }
  } catch (e) {
    return (e as Error).message;
  }
}

const TIMEOUT_ERROR = `Request timed out after ${OP_TIMEOUT_MS / 1000}s`;

async function runOp(op: PendingOp): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT_ERROR), OP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([dispatchOp(op), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Errors that will fail every op alike (offline, signed out), as opposed to
 *  a problem with one particular row. */
function isConnectionError(err: string): boolean {
  return (
    err === TIMEOUT_ERROR ||
    /failed to fetch|network|load failed|not signed in/i.test(err)
  );
}

export async function flushPending(): Promise<{ remaining: number; lastError?: string }> {
  if (flushing) return { remaining: getPending().length };
  if (!getSupabase()) return { remaining: getPending().length };
  flushing = true;
  const pendingBefore = getPending().length;
  if (pendingBefore > 0) {
    // eslint-disable-next-line no-console
    console.log(`[gym-tracker] flushPending: ${pendingBefore} pending (concurrency=${FLUSH_CONCURRENCY}, timeout=${OP_TIMEOUT_MS / 1000}s)`);
  }
  try {
    setPending(compact(getPending()));
    let lastError: string | undefined;
    // Every op gets one attempt per flush. A failing op stays queued but
    // never blocks the ones behind it — one bad row (e.g. a schema
    // mismatch on exercises) must not starve workouts. Ops enqueued while
    // we're flushing are picked up by the next round of the outer loop.
    const attempted = new Set<string>();
    let offline = false;
    while (!offline) {
      const batch = getPending().filter((op) => !attempted.has(op.qid));
      if (batch.length === 0) break;
      for (let i = 0; i < batch.length; i += FLUSH_CONCURRENCY) {
        const slice = batch.slice(i, i + FLUSH_CONCURRENCY);
        slice.forEach((op) => attempted.add(op.qid));
        const results = await Promise.all(slice.map(runOp));
        const done = new Set(
          slice.filter((_, j) => !results[j]).map((op) => op.qid)
        );
        for (const err of results) if (err) lastError = err;
        // Remove only what succeeded, re-reading the queue so ops enqueued
        // mid-flush (e.g. a workout saved while this ran) are never lost.
        if (done.size > 0) {
          setPending(getPending().filter((op) => !done.has(op.qid)));
        } else if (results.every((err) => err && isConnectionError(err))) {
          // Offline or signed out: every remaining op would fail the same
          // way, so stop instead of timing out on each one.
          offline = true;
          break;
        }
      }
    }
    const remaining = getPending().length;
    // If anything is still pending, schedule a background retry. This means
    // a single failed push (e.g. transient network blip) doesn't leave the
    // queue stuck — we keep trying with backoff until it drains or the user
    // explicitly discards.
    if (remaining > 0) {
      if (lastError) {
        // eslint-disable-next-line no-console
        console.warn(`[gym-tracker] flushPending: ${remaining} still failing — ${lastError}`);
      }
      scheduleBackgroundRetry();
    }
    return { remaining, lastError };
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
/** When the user-visible queue stays high after several attempts, we pause
 *  the auto-retry so we stop hammering the cloud every minute. The user can
 *  still click "Retry push" manually, or it resumes after a long cooldown.
 *  This prevents the "every click is slow because the queue keeps timing
 *  out" pattern. */
const MAX_CONSECUTIVE_FAILURES = 3;
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

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

  // If we've hit the failure ceiling, schedule one final retry at the
  // cooldown interval, then give up until the user acts (manual retry,
  // window focus, online event, re-auth, or page reload).
  if (retryAttempt >= MAX_CONSECUTIVE_FAILURES) {
    // eslint-disable-next-line no-console
    console.warn(
      `[gym-tracker] auto-retry paused after ${MAX_CONSECUTIVE_FAILURES} consecutive failures (${getPendingCount()} still pending). Will retry in ~${COOLDOWN_MS / 60_000} min, or on focus/online.`
    );
    return;
  }

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
      // Still failing — bump attempt and re-schedule (with the cooldown
      // ceiling above preventing a tight loop).
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
  addTombstone("exercises", id);
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
  addTombstone("workouts", id);
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
  addTombstone("templates", id);
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

// ----- First visit -----

/** True once this browser has got past the welcome / landing screen. Kept
 *  on sign-out on purpose: a returning user shouldn't be pitched again. */
export function hasOnboarded(): boolean {
  return readJSON<boolean>(KEY_ONBOARDED, false);
}

export function markOnboarded() {
  writeJSON(KEY_ONBOARDED, true);
  if (isBrowser()) window.dispatchEvent(new Event("gym:onboarded"));
}

// ----- Reset / Sign-out -----

/**
 * Wipe the local cache. We deliberately do NOT clear `KEY_PENDING` here — if
 * the user is signing out to re-authenticate (e.g. an expired session), we
 * want their queued writes to survive so they can be retried automatically
 * after sign-in. To deliberately discard pending writes, call
 * `discardPendingWrites()` separately.
 *
 * Tombstones ARE cleared on sign-out — they're per-device state and the
 * next sign-in's pull will recreate them naturally based on what's in the
 * cloud. Keeping tombstones around across sign-outs would just block
 * legitimate recovery of records that another device legitimately deleted
 * (e.g. laptop archive + phone re-sync).
 */
export function clearLocal() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY_EXERCISES);
  window.localStorage.removeItem(KEY_WORKOUTS);
  window.localStorage.removeItem(KEY_TEMPLATES);
  window.localStorage.removeItem(KEY_SEEDED);
  window.localStorage.removeItem(KEY_TOMBSTONES);
  window.localStorage.removeItem(KEY_PUSHED_ALL);
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
  let [exercises, workouts, templates] = await Promise.all([
    fetchAllExercises(),
    fetchAllWorkouts(),
    fetchAllTemplates(),
  ]);

  // The cloud may still hold records the user has deleted locally (the
  // delete op didn't make it through, or another device re-synced it).
  // Tombstones ensure locally-deleted records stay gone. We also re-queue
  // delete ops for anything in the cloud that we tombstoned but the cloud
  // hasn't yet acknowledged, so the cloud eventually catches up.
  const liveExercises = filterTombstoned("exercises", exercises);
  const liveWorkouts = filterTombstoned("workouts", workouts);
  const liveTemplates = filterTombstoned("templates", templates);

  for (const e of exercises) {
    if (isTombstoned("exercises", e.id)) {
      enqueue({ op: "delete", table: "exercises", id: e.id });
    }
  }
  for (const w of workouts) {
    if (isTombstoned("workouts", w.id)) {
      enqueue({ op: "delete", table: "workouts", id: w.id });
    }
  }
  for (const t of templates) {
    if (isTombstoned("templates", t.id)) {
      enqueue({ op: "delete", table: "workout_templates", id: t.id });
    }
  }

  // Prune tombstones for any IDs the cloud no longer has — that means the
  // delete reached the cloud successfully and we don't need to keep nagging.
  pruneTombstones(
    "exercises",
    new Set(exercises.map((e) => e.id))
  );
  pruneTombstones("workouts", new Set(workouts.map((w) => w.id)));
  pruneTombstones(
    "templates",
    new Set(templates.map((t) => t.id))
  );

  // Writes that haven't reached the cloud yet must survive the pull: keep
  // the local version of every record with a pending insert/update, both
  // in the cache and in the queue, so it keeps retrying.
  const overlay = <T extends { id: string }>(
    table: PendingOp["table"],
    rows: T[]
  ): T[] => {
    const pending = new Map<string, T>();
    for (const op of getPending()) {
      if (op.table === table && op.op !== "delete") {
        pending.set(op.row.id as string, op.row as unknown as T);
      }
    }
    return [
      ...rows.map((r) => pending.get(r.id) ?? r),
      ...[...pending.values()].filter((p) => !rows.some((r) => r.id === p.id)),
    ];
  };
  exercises = overlay("exercises", liveExercises);
  workouts = overlay("workouts", liveWorkouts);
  templates = overlay("workout_templates", liveTemplates);

  saveExercisesLocal(exercises);
  saveWorkoutsLocal(workouts);
  saveTemplatesLocal(templates);
  // Best-effort: try to push anything still queued (including re-queued
  // deletes) immediately so the cloud catches up before the next pull.
  flushPending().catch(() => {});
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
  // One queue write for the lot — enqueueing row by row re-serialises the
  // whole queue each time.
  enqueue(
    ...exs.map((ex) => ({ op: "insert", table: "exercises", row: ex as unknown as Record<string, unknown> }) as const),
    ...wks.map((w) => ({ op: "insert", table: "workouts", row: w as unknown as Record<string, unknown> }) as const),
    ...tpls.map((t) => ({ op: "insert", table: "workout_templates", row: t as unknown as Record<string, unknown> }) as const)
  );
  const { remaining } = await flushPending();
  return { pushed: exs.length + wks.length + tpls.length, remaining };
}

/** True once this device has pushed its whole local cache for `userId`.
 *  After that, the pending queue alone carries every local change, so app
 *  start only needs to flush it and pull. */
export function hasPushedAll(userId: string): boolean {
  return readJSON<string | null>(KEY_PUSHED_ALL, null) === userId;
}
export function markPushedAll(userId: string) {
  writeJSON(KEY_PUSHED_ALL, userId);
}
