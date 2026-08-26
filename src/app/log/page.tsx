"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, ChevronRight } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { WorkoutEditor } from "@/components/WorkoutEditor";
import { useTemplates, useWorkouts } from "@/lib/hooks";
import { getTemplate, uid } from "@/lib/storage";
import type {
  SetEntry,
  Workout,
  WorkoutExercise,
  WorkoutTemplate,
} from "@/lib/types";

/**
 * Find the most recent workout (across ALL templates / non-template workouts)
 * that contains `exerciseId`, and return the sets from that block.
 *
 * The caller uses these sets as the pre-fill for a new workout so the user
 * can pick up where they left off and just bump the weight/reps for
 * progressive overload — instead of staring at empty sets.
 */
function findLastSetsForExercise(
  workouts: Workout[],
  exerciseId: string
): SetEntry[] | null {
  // getWorkouts() already sorts newest-first, so the first match wins.
  for (const w of workouts) {
    const block = w.exercises.find((b) => b.exerciseId === exerciseId);
    if (block && block.sets && block.sets.length > 0) {
      // Deep-copy and assign fresh ids so the editor's set-state stays clean.
      return block.sets.map((s) => ({ ...s, id: uid() }));
    }
  }
  return null;
}

/**
 * Read workouts directly from localStorage (not via the useWorkouts hook).
 * Used so initialBlocks is correct on the editor's first render — useWorkouts()
 * returns [] until its useEffect runs, which would briefly hide "last time"
 * data. Falls back to [] if anything goes wrong.
 */
function workoutsFromStorage(): Workout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("gym.workouts.v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Workout[];
    if (!Array.isArray(parsed)) return [];
    // Sort newest-first to match getWorkouts()'s contract.
    return parsed.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    );
  } catch {
    return [];
  }
}

function hasAnyValues(s: SetEntry): boolean {
  return (
    (s.weight ?? 0) > 0 ||
    (s.reps ?? 0) > 0 ||
    (s.duration ?? 0) > 0 ||
    (s.distance ?? 0) > 0
  );
}

export default function LogPage() {
  const templates = useTemplates();
  const workouts = useWorkouts();
  const [appliedTemplate, setAppliedTemplate] = useState<WorkoutTemplate | null>(null);
  // "Start blank" sets this to true so the editor appears without a template.
  // We can't just set appliedTemplate=null because the editor only renders
  // when appliedTemplate is truthy, so the user would be stuck.
  const [wantsBlank, setWantsBlank] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const tplId = url.searchParams.get("template");
    if (tplId) {
      const t = getTemplate(tplId);
      if (t) setAppliedTemplate(t);
      // Clean the URL
      url.searchParams.delete("template");
      window.history.replaceState({}, "", url.toString());
    }
    setHydrated(true);
  }, []);

  // Convert a template into pre-filled WorkoutExercise blocks for the editor.
  // For each exercise, we look up the most recent workout that contained it
  // and pre-fill from THERE (progressive overload), falling back to the
  // template's hard-coded defaults if the user has never logged this exercise
  // before, or if the most recent occurrence had no usable values.
  //
  // We read workouts synchronously here (not via useWorkouts) so the editor
  // gets the right initialBlocks on its very first render. useWorkouts() is
  // used as a memo dependency so we recompute if workouts change after mount
  // (e.g. after a cloud sync delivers new data) — but the editor's `key`
  // forces a fresh mount when the template changes, so users always see the
  // latest last-workout values for whatever template they pick.
  const initialBlocks: Omit<WorkoutExercise, never>[] = useMemo(() => {
    if (!appliedTemplate) return [];
    // Read directly from localStorage so this is correct on first render
    // (useWorkouts() would return [] until its effect runs, which would
    // make us pre-fill template defaults even when last-workout data exists).
    const allWorkouts =
      typeof window !== "undefined" ? workoutsFromStorage() : workouts;
    return appliedTemplate.exercises.map((te, idx) => {
      const lastSets = findLastSetsForExercise(allWorkouts, te.exerciseId);
      const lastSetsAreUsable =
        lastSets && lastSets.some(hasAnyValues);

      let sets: SetEntry[];
      if (lastSetsAreUsable) {
        // Progressive overload: carry over the most recent workout's sets
        // (type, weight, reps, duration, distance) — the user just bumps
        // the numbers up. This overrides the template's defaultSets count.
        sets = lastSets!;
      } else {
        // First time for this exercise (or last time had no values) — fall
        // back to the template defaults. We re-emit the same shape `te.defaultSets`
        // times so the user gets the same starting point as before this change.
        sets = Array.from({ length: te.defaultSets }).map(() => ({
          id: uid(),
          weight: te.defaultWeight ?? 0,
          reps: te.defaultReps,
        }));
      }
      return {
        id: uid(),
        exerciseId: te.exerciseId,
        order: idx,
        sets,
      };
    });
    // We depend on `workouts` from useWorkouts so that when workouts
    // arrive from cloud sync after mount, the memo invalidates. The editor's
    // `key={appliedTemplate?.id}` forces a fresh mount on template change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedTemplate, workouts]);

  const activeTemplates = templates.filter((t) => !t.archived);

  return (
    <PageShell>
      <PageHeader
        title="Log workout"
        subtitle={
          appliedTemplate ? `From: ${appliedTemplate.name}` : "Record what you did today"
        }
      />

      <div className="space-y-4 px-4 pt-4">
        {/* Template chooser */}
        {!appliedTemplate && activeTemplates.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Start from template
              </h2>
              <Link
                href="/templates"
                className="text-xs text-emerald-400 hover:underline"
              >
                Manage
              </Link>
            </div>
            <div className="space-y-2">
              {activeTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAppliedTemplate(t)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {t.name}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {t.exercises.length} exercise
                        {t.exercises.length === 1 ? "" : "s"} pre-filled
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setWantsBlank(true)}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 text-sm text-zinc-200"
            >
              <Plus className="h-4 w-4" />
              Start blank
            </button>
          </section>
        )}

        {/* The actual editor */}
        {hydrated && (appliedTemplate || wantsBlank || templates.length === 0) && (
          <WorkoutEditor
            mode="create"
            key={appliedTemplate?.id ?? "blank"}
            initialBlocks={initialBlocks}
            initialName={appliedTemplate?.name ?? ""}
          />
        )}

        {/* No templates, no template chosen, just show the empty editor */}
        {hydrated && activeTemplates.length === 0 && (
          <section>
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-zinc-500" />
              <p className="mt-2 text-sm text-zinc-300">
                Tip: build a template (e.g. &quot;Push day&quot;) and start
                future workouts from it in one tap.
              </p>
              <Link
                href="/templates"
                className="mt-3 inline-flex h-9 items-center justify-center rounded-full bg-zinc-800 px-4 text-sm text-zinc-200"
              >
                Create a template
              </Link>
            </div>
            <WorkoutEditor mode="create" key="blank" />
          </section>
        )}
      </div>
    </PageShell>
  );
}
