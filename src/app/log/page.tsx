"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, ChevronRight } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { WorkoutEditor } from "@/components/WorkoutEditor";
import { defaultSetTypeForExercise } from "@/components/WorkoutEditor";
import { useExercises, useTemplates, useWorkouts } from "@/lib/hooks";
import { getTemplate, uid } from "@/lib/storage";
import { bestAndLastForExercise, lastSessionForExercise } from "@/lib/stats";
import { formatDate, formatWeight } from "@/lib/format";
import type {
  Exercise,
  SetEntry,
  SetType,
  Workout,
  WorkoutExercise,
  WorkoutTemplate,
} from "@/lib/types";

/** Build a single set entry from a template block + a chosen SetType.
 *  Only the fields meaningful for the type are populated. Used for both
 *  the "first time" template-default path and the "last session" pre-fill
 *  path when we need a clean fallback. */
function buildSetFromTemplate(
  te: WorkoutTemplate["exercises"][number],
  type: SetType
): SetEntry {
  const set: SetEntry = { id: uid(), type };
  switch (type) {
    case "weight-reps":
      set.weight = te.defaultWeight ?? 0;
      set.reps = te.defaultReps;
      break;
    case "reps":
      set.reps = te.defaultReps;
      break;
    case "weight-time":
      set.weight = te.defaultWeight ?? 0;
      set.duration = te.defaultDuration;
      break;
    case "time":
      set.duration = te.defaultDuration;
      break;
    case "distance-time":
      set.distance = te.defaultDistance;
      set.duration = te.defaultDuration;
      break;
    case "weight-distance":
      set.weight = te.defaultWeight ?? 0;
      set.distance = te.defaultDistance;
      break;
  }
  return set;
}

/** Re-shape a previously-logged set into the template's chosen SetType,
 *  carrying across whatever fields are still meaningful for the new type.
 *  Used for the "last time" pre-fill so the user sees their previous
 *  weight × reps in the editor even if the template's UOM differs (we
 *  coerce the shape rather than discard the data).
 *
 *  The set is given a fresh id so React keys stay unique across
 *  re-renders. `rpe` and any unknown fields are dropped. */
function adaptSetToType(prev: SetEntry, targetType: SetType): SetEntry {
  const set: SetEntry = { id: uid(), type: targetType };
  const w = prev.weight ?? 0;
  const r = prev.reps ?? 0;
  const d = prev.duration ?? 0;
  const dist = prev.distance ?? 0;
  switch (targetType) {
    case "weight-reps":
      set.weight = w;
      set.reps = r;
      break;
    case "reps":
      set.reps = r;
      break;
    case "weight-time":
      set.weight = w;
      set.duration = d;
      break;
    case "time":
      set.duration = d;
      break;
    case "distance-time":
      set.distance = dist;
      set.duration = d;
      break;
    case "weight-distance":
      set.weight = w;
      set.distance = dist;
      break;
  }
  return set;
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

export default function LogPage() {
  const templates = useTemplates();
  const workouts = useWorkouts();
  const exercises = useExercises();
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
  // For each exercise:
  //   - Pre-fill the sets with the user's most recent session of that
  //     exercise (any UOM), re-shaped into the template's chosen UOM so
  //     the editor input grid matches. This is what the user expects:
  //     "load up the last time I did this, not my all-time best".
  //   - Add a footnote showing the previous session + their all-time best
  //     for weight-reps exercises, so the heavy history reference is
  //     preserved in the description even though the input is "last".
  //   - Fall back to template defaults if there's no usable history.
  //
  // The footnote is returned as a parallel map keyed by the block ID so the
  // editor can render it without us needing to mutate the WorkoutExercise
  // type. The editor drops the footnote before saving.
  const { initialBlocks, initialFootnotes } = useMemo(() => {
    if (!appliedTemplate)
      return {
        initialBlocks: [] as Omit<WorkoutExercise, never>[],
        initialFootnotes: {} as Record<string, string>,
      };
    // Read directly from localStorage so this is correct on first render
    // (useWorkouts() would return [] until its effect runs, which would
    // make us pre-fill template defaults even when last-workout data exists).
    const allWorkouts =
      typeof window !== "undefined" ? workoutsFromStorage() : workouts;

    const blocks: Omit<WorkoutExercise, never>[] = [];
    const footnotes: Record<string, string> = {};

    appliedTemplate.exercises.forEach((te, idx) => {
      const { best, lastSets, lastDate } = bestAndLastForExercise(
        allWorkouts,
        te.exerciseId
      );
      const lastSession = lastSessionForExercise(allWorkouts, te.exerciseId);
      const ex: Exercise | undefined = exercises.find(
        (e) => e.id === te.exerciseId
      );
      // Resolve the SetType for this template block in priority order:
      //   1. The template's own per-block defaultSetType (lets a "Push
      //      day" template override the exercise's personal default to
      //      weight-reps for everything in it).
      //   2. The exercise's defaultSetType (set on the Exercises page).
      //   3. Name-based heuristic.
      //   4. weight-reps fallback.
      const t: SetType = te.defaultSetType
        ? te.defaultSetType
        : defaultSetTypeForExercise(ex);

      let sets: SetEntry[];
      const blockId = uid();

      if (lastSession.sets.length > 0) {
        // Pre-fill from the user's most recent session of this exercise
        // (any UOM). Take the first `te.defaultSets` entries verbatim,
        // re-shaped into the template's chosen UOM so the editor input
        // grid matches. If the user did more sets last time than the
        // template asks for, the extras are dropped — the user can always
        // tap "+" to add them. If they did fewer, we pad the rest with a
        // clone of the last entry so the form is full and ready.
        const taken = lastSession.sets.slice(0, te.defaultSets);
        sets = taken.map((s) => adaptSetToType(s, t));
        if (sets.length < te.defaultSets && sets.length > 0) {
          const lastAdapted = sets[sets.length - 1];
          while (sets.length < te.defaultSets) {
            sets.push({ ...lastAdapted, id: uid() });
          }
        }
      } else {
        // First time for this exercise — fall back to template defaults
        // for every set. The user can edit per-set before saving.
        sets = Array.from({ length: te.defaultSets }).map(() =>
          buildSetFromTemplate(te, t)
        );
      }

      // Footnote: keep the "best ever" reference (history) in the
      // description even though we now pre-fill from "last time". For
      // weight-reps exercises the best/load distinction is meaningful;
      // for non-weight-reps UOMs the "best" line is omitted.
      if (best && t === "weight-reps" && lastSets.length > 0) {
        const lastSummary = lastSets
          .map((s) => `${formatWeight(s.weight)} × ${s.reps}`)
          .join(", ");
        const lastIsBest =
          lastSets.length === 1 &&
          lastSets[0].weight === best.weight &&
          lastSets[0].reps === best.reps;
        if (lastIsBest) {
          footnotes[blockId] =
            `Best ever and last time: ${formatWeight(best.weight)} × ${best.reps}`;
        } else {
          const datePart = lastDate ? ` (${formatDate(lastDate)})` : "";
          const bestPart = `best ever: ${formatWeight(best.weight)} × ${best.reps}`;
          footnotes[blockId] =
            `Last time${datePart}: ${lastSummary} · ${bestPart}`;
        }
      } else if (best && t === "weight-reps") {
        // No lastSets but we have a best (very old history?) — show best
        // alone so the user still has a reference.
        footnotes[blockId] = `Best ever: ${formatWeight(best.weight)} × ${best.reps}`;
      }

      blocks.push({
        id: blockId,
        exerciseId: te.exerciseId,
        order: idx,
        sets,
      });
    });

    return { initialBlocks: blocks, initialFootnotes: footnotes };
    // We depend on `workouts` from useWorkouts so that when workouts arrive
    // from cloud sync after mount, the memo invalidates. The editor's
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
            initialFootnotes={initialFootnotes}
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
