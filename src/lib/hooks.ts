"use client";

import { useEffect, useState } from "react";
import {
  getExercises,
  getTemplates,
  getWorkouts,
  pullFromCloud,
  pushToCloud,
  hasSeeded,
  markSeeded,
  addExercise,
  addWorkout,
  uid,
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getSession, onAuthChange, processMagicLinkFromUrl } from "@/lib/auth";
import type { Session } from "@supabase/supabase-js";
import type { Exercise, Workout, WorkoutTemplate } from "@/lib/types";

type AuthStatus = "loading" | "no-cloud" | "needs-signin" | "signed-in";

export function useAuth(): {
  status: AuthStatus;
  session: Session | null;
  email: string | null;
} {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus("no-cloud");
      setSession(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // First, process any magic-link token in the URL
      const result = await processMagicLinkFromUrl();
      if (result.found && !result.ok) {
        console.warn("[auth] Magic link processing failed:", result.detail);
      }
      const s = await getSession();
      if (cancelled) return;
      setSession(s);
      setStatus(s ? "signed-in" : "needs-signin");
    })();
    const unsub = onAuthChange((_event, s) => {
      if (cancelled) return;
      setSession(s);
      setStatus(s ? "signed-in" : "needs-signin");
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return {
    status,
    session,
    email: session?.user?.email ?? null,
  };
}

/**
 * Pulls from cloud when the user becomes signed in, and pushes any
 * local-only data to the cloud on first sign-in.
 */
export function useCloudSync(status: AuthStatus) {
  useEffect(() => {
    if (status !== "signed-in") return;
    let cancelled = false;
    (async () => {
      const exs = getExercises();
      const wks = getWorkouts();
      const hasLocal = exs.length > 0 || wks.length > 0;

      if (hasLocal) {
        const result = await pushToCloud();
        if (!cancelled && result.remaining === 0) {
          await pullFromCloud();
        }
      } else {
        await pullFromCloud();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);
}

/**
 * Workouts hook — reads from localStorage cache, which is updated by:
 *  - the storage module (local writes) via the "gym:data-changed" event
 *  - the cloud sync (pull from cloud on sign-in) via the same event
 */
export function useWorkouts(): Workout[] {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  useEffect(() => {
    setWorkouts(getWorkouts());
    const handler = () => setWorkouts(getWorkouts());
    window.addEventListener("gym:data-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("gym:data-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return workouts;
}

export function useExercises(): Exercise[] {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  useEffect(() => {
    setExercises(getExercises());
    const handler = () => setExercises(getExercises());
    window.addEventListener("gym:data-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("gym:data-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return exercises;
}

export function useTemplates(): WorkoutTemplate[] {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  useEffect(() => {
    setTemplates(getTemplates());
    const handler = () => setTemplates(getTemplates());
    window.addEventListener("gym:data-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("gym:data-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return templates;
}

/**
 * Seed sample data for the local-only mode only.
 * Cloud-sync users should not have fake data pushed to their real DB.
 */
export function seedIfEmpty() {
  if (isSupabaseConfigured()) return;
  if (hasSeeded()) return;

  const bench = addExercise({ name: "Bench Press", muscleGroup: "chest" });
  const squat = addExercise({ name: "Back Squat", muscleGroup: "legs" });
  const deadlift = addExercise({ name: "Deadlift", muscleGroup: "back" });
  const row = addExercise({ name: "Barbell Row", muscleGroup: "back" });
  const ohp = addExercise({ name: "Overhead Press", muscleGroup: "shoulders" });
  const pullup = addExercise({ name: "Pull-up", muscleGroup: "back" });

  const today = new Date();
  const startOffsetDays = 7 * 6;
  const start = new Date(today);
  start.setDate(today.getDate() - startOffsetDays);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sessions: { date: Date; lifts: { exId: string; baseWeight: number; sets: number }[] }[] = [
    { date: new Date(start), lifts: [
      { exId: squat.id, baseWeight: 80, sets: 3 },
      { exId: bench.id, baseWeight: 60, sets: 3 },
      { exId: row.id, baseWeight: 50, sets: 3 },
    ]},
    { date: new Date(start.getTime() + 2 * 86400000), lifts: [
      { exId: deadlift.id, baseWeight: 100, sets: 3 },
      { exId: ohp.id, baseWeight: 40, sets: 3 },
      { exId: pullup.id, baseWeight: 0, sets: 3 },
    ]},
    { date: new Date(start.getTime() + 4 * 86400000), lifts: [
      { exId: squat.id, baseWeight: 82.5, sets: 3 },
      { exId: bench.id, baseWeight: 62.5, sets: 3 },
      { exId: row.id, baseWeight: 52.5, sets: 3 },
    ]},
  ];

  for (let week = 0; week < 6; week++) {
    for (const s of sessions) {
      const d = new Date(s.date);
      d.setDate(d.getDate() + week * 7);
      if (d > today) continue;
      const exercises = s.lifts.map((l, idx) => {
        const weightJitter = (Math.random() - 0.5) * 2.5;
        const setsJitter = Math.random() < 0.3 ? 1 : 0;
        const baseW = l.baseWeight + week * 2.5;
        return {
          id: uid(),
          exerciseId: l.exId,
          order: idx,
          sets: Array.from({ length: l.sets + setsJitter }).map((_, sIdx) => ({
            id: uid(),
            weight: Math.max(0, Math.round((baseW + weightJitter - sIdx * 2.5) * 2) / 2),
            reps: 5 + Math.floor(Math.random() * 4),
          })),
        };
      });
      addWorkout({ date: iso(d), exercises });
    }
  }
  markSeeded();
}
