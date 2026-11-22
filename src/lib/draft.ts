"use client";

import { useEffect, useState } from "react";
import type { WorkoutExercise } from "@/lib/types";

/**
 * The unfinished workout on the Log page, kept so it survives the app being
 * closed and can be picked up (or saved) later.
 *
 * This lives on the phone only. It has its own key, is never queued for cloud
 * sync, and is not touched by storage.ts. Saving the workout goes through the
 * normal addWorkout() path, after which the draft is cleared.
 */
export type WorkoutDraft = {
  name: string;
  date: string;
  bodyweight: string;
  blocks: WorkoutExercise[];
  footnotes: Record<string, string>;
  /** When logging started (ms). */
  startedAt: number;
  /** When the draft was last changed (ms). */
  updatedAt: number;
};

const KEY_DRAFT = "gym.draft.v1";
const KEY_REMINDER_PROMPT = "gym.save-reminder-prompt.v1";
export const DRAFT_EVENT = "gym:draft-changed";
/** Ask the open editor to save (fired by the leave-page sheet). */
export const SAVE_REQUEST_EVENT = "gym:save-draft";

/** Minutes without changes before the "Done at the gym?" notification. */
export const REMINDER_MINUTES = 20;

function notify() {
  window.dispatchEvent(new CustomEvent(DRAFT_EVENT));
}

export function loadDraft(): WorkoutDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY_DRAFT);
    if (!raw) return null;
    const d = JSON.parse(raw) as WorkoutDraft;
    if (!d || !Array.isArray(d.blocks)) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(d: WorkoutDraft) {
  try {
    window.localStorage.setItem(KEY_DRAFT, JSON.stringify(d));
    notify();
  } catch {
    // Storage full or blocked: the reminder is best-effort.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(KEY_DRAFT);
  } catch {
    // ignore
  }
  notify();
}

/** Sets with at least one number entered. */
export function filledSetCount(blocks: WorkoutExercise[]): number {
  let n = 0;
  for (const b of blocks) {
    for (const s of b.sets) {
      if (
        (s.weight ?? 0) > 0 ||
        (s.reps ?? 0) > 0 ||
        (s.duration ?? 0) > 0 ||
        (s.distance ?? 0) > 0
      ) {
        n++;
      }
    }
  }
  return n;
}

/** Exercises with at least one filled set. */
export function filledExerciseCount(blocks: WorkoutExercise[]): number {
  return blocks.filter((b) => filledSetCount([b]) > 0).length;
}

/** A draft worth reminding about: at least one set has numbers in it. */
export function hasUnsavedSets(d: WorkoutDraft | null): d is WorkoutDraft {
  return !!d && filledSetCount(d.blocks) > 0;
}

/** Live view of the draft, updated whenever it changes (in this tab or another). */
export function useDraft(): WorkoutDraft | null {
  const [draft, setDraft] = useState<WorkoutDraft | null>(null);
  useEffect(() => {
    const read = () => setDraft(loadDraft());
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_DRAFT) read();
    };
    window.addEventListener(DRAFT_EVENT, read);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DRAFT_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return draft;
}

/** "6:42 PM today", "6:42 PM yesterday" or "6:42 PM, 20 Nov". */
export function startedLabel(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `${time} today`;
  if (d.toDateString() === yesterday.toDateString()) return `${time} yesterday`;
  return `${time}, ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

// ---------------------------------------------------------------------------
// "Done at the gym?" notification
// ---------------------------------------------------------------------------

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

/** Show the "turn on reminders" prompt in the editor? */
export function shouldOfferReminders(): boolean {
  if (!notificationsSupported()) return false;
  if (Notification.permission !== "default") return false;
  try {
    return window.localStorage.getItem(KEY_REMINDER_PROMPT) !== "dismissed";
  } catch {
    return true;
  }
}

export function dismissReminderOffer() {
  try {
    window.localStorage.setItem(KEY_REMINDER_PROMPT, "dismissed");
  } catch {
    // ignore
  }
}

export async function enableReminders(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const result = await Notification.requestPermission();
    if (result !== "default") dismissReminderOffer();
    return result === "granted";
  } catch {
    return false;
  }
}

function draftSummary(d: WorkoutDraft): string {
  const sets = filledSetCount(d.blocks);
  const exs = filledExerciseCount(d.blocks);
  const label = d.name.trim() ? d.name.trim() : "workout";
  return `Your ${label} isn't saved yet: ${exs} exercise${exs === 1 ? "" : "s"}, ${sets} set${sets === 1 ? "" : "s"}. Tap to save it.`;
}

/**
 * Show the reminder through the service worker (needed on Android, where
 * `new Notification()` is not allowed). Tapping it opens the Log page.
 */
export async function showSaveReminder(d: WorkoutDraft): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const logUrl = new URL("log/", reg.scope).toString();
    const options: NotificationOptions & {
      actions?: { action: string; title: string }[];
      renotify?: boolean;
    } = {
      body: draftSummary(d),
      icon: new URL("logbook-v1-192.png", reg.scope).toString(),
      badge: new URL("logbook-v1-192.png", reg.scope).toString(),
      tag: "save-workout",
      renotify: true,
      data: { url: logUrl },
      actions: [
        { action: "save", title: "Save now" },
        { action: "later", title: "Still training" },
      ],
    };
    await reg.showNotification("Done at the gym? 💪", options);
  } catch {
    // Best-effort.
  }
}

export async function closeSaveReminder(): Promise<void> {
  if (!notificationsSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const list = (await reg?.getNotifications({ tag: "save-workout" })) ?? [];
    list.forEach((n) => n.close());
  } catch {
    // ignore
  }
}
