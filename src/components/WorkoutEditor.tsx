"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  Save,
  X,
  StickyNote,
  Check,
} from "lucide-react";
import clsx from "clsx";
import type {
  Exercise,
  MuscleGroup,
  SetEntry,
  SetType,
  Workout,
  WorkoutExercise,
} from "@/lib/types";
import { addWorkout, deleteWorkout, getWorkout, updateWorkout, uid } from "@/lib/storage";
import { useExercises } from "@/lib/hooks";
import { formatDuration, formatSetSummary, formatWeight, SET_TYPE_SHORT } from "@/lib/format";

const SET_TYPES: SetType[] = [
  "weight-reps",
  "reps",
  "weight-time",
  "time",
  "distance-time",
  "weight-distance",
];

const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: "chest", label: "Chest" },
  { value: "back", label: "Back" },
  { value: "shoulders", label: "Shoulders" },
  { value: "legs", label: "Legs" },
  { value: "glutes", label: "Glutes" },
  { value: "arms", label: "Arms" },
  { value: "core", label: "Core" },
  { value: "cardio", label: "Cardio" },
  { value: "other", label: "Other" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptySet(prev?: SetEntry, defaultType: SetType = "weight-reps"): SetEntry {
  return {
    id: uid(),
    type: prev?.type ?? defaultType,
    weight: prev?.weight,
    reps: prev?.reps,
    duration: prev?.duration,
    distance: prev?.distance,
  };
}

/**
 * If an exercise name starts with "BW" or "Bodyweight" (case-insensitive),
 * the user almost certainly means a pure-reps movement, so the first set
 * should default to the "reps" type instead of "weight-reps". Anything else
 * falls through to the normal weight-reps default.
 *
 * Examples that auto-pick "reps":
 *   "BW Dips", "bw lunges", "Bodyweight Squats", "BODYWEIGHT Pull-ups"
 * Examples that stay on "weight-reps":
 *   "Barbell Squat", "Dumbbell Row", "Banded Pull-apart"
 */
function defaultSetTypeForExercise(ex?: Exercise): SetType {
  if (!ex) return "weight-reps";
  const name = ex.name.trim().toLowerCase();
  if (
    name === "bw" ||
    name.startsWith("bw ") ||
    name === "bodyweight" ||
    name.startsWith("bodyweight ")
  ) {
    return "reps";
  }
  return "weight-reps";
}

function emptyExerciseBlock(ex: Exercise, prev?: WorkoutExercise): WorkoutExercise {
  const defaultType = defaultSetTypeForExercise(ex);
  return {
    id: uid(),
    exerciseId: ex.id,
    order: 0,
    sets:
      prev?.sets && prev.sets.length > 0
        ? prev.sets.map((s) => ({ ...s, id: uid() }))
        : [emptySet(undefined, defaultType)],
  };
}

export function WorkoutEditor({
  workoutId,
  mode = "create",
  initialBlocks,
  initialName,
}: {
  workoutId?: string;
  mode?: "create" | "edit";
  initialBlocks?: WorkoutExercise[];
  initialName?: string;
}) {
  const router = useRouter();
  const exercises = useExercises();
  const [date, setDate] = useState<string>(todayISO());
  const [name, setName] = useState<string>(initialName ?? "");
  const [bodyweight, setBodyweight] = useState<string>("");
  const [blocks, setBlocks] = useState<WorkoutExercise[]>(
    initialBlocks && initialBlocks.length > 0 ? initialBlocks : []
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newExercise, setNewExercise] = useState<{ name: string; muscleGroup: MuscleGroup } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hydrate from existing workout if editing
  useEffect(() => {
    if (mode === "edit" && workoutId) {
      const w = getWorkout(workoutId);
      if (w) {
        setDate(w.date);
        setName(w.name ?? "");
        setBodyweight(w.bodyweight ? String(w.bodyweight) : "");
        setBlocks(w.exercises);
      }
    }
    setHydrated(true);
  }, [mode, workoutId]);

  const groupedExercises = useMemo(() => {
    const grouped: Record<string, Exercise[]> = {};
    for (const eg of MUSCLE_GROUPS) grouped[eg.value] = [];
    for (const e of exercises) {
      if (e.archived) continue;
      grouped[e.muscleGroup] = grouped[e.muscleGroup] ?? [];
      grouped[e.muscleGroup].push(e);
    }
    return grouped;
  }, [exercises]);

  const usedExerciseIds = blocks.map((b) => b.exerciseId);

  function addExerciseBlock(ex: Exercise) {
    setBlocks((cur) => [
      ...cur,
      { ...emptyExerciseBlock(ex), order: cur.length },
    ]);
    setPickerOpen(false);
  }

  function createNewExercise() {
    if (!newExercise) return;
    const created: Exercise = {
      id: uid(),
      name: newExercise.name.trim(),
      muscleGroup: newExercise.muscleGroup,
      createdAt: Date.now(),
    };
    // add via direct storage call to avoid pulling the storage hook
    const all = JSON.parse(
      window.localStorage.getItem("gym.exercises.v1") ?? "[]"
    ) as Exercise[];
    window.localStorage.setItem(
      "gym.exercises.v1",
      JSON.stringify([created, ...all])
    );
    window.dispatchEvent(new CustomEvent("gym:data-changed"));
    addExerciseBlock(created);
    setNewExercise(null);
  }

  function updateBlock(id: string, patch: Partial<WorkoutExercise>) {
    setBlocks((cur) => cur.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function removeBlock(id: string) {
    setBlocks((cur) => cur.filter((b) => b.id !== id));
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((cur) => {
      const idx = cur.findIndex((b) => b.id === id);
      if (idx < 0) return cur;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= cur.length) return cur;
      const copy = [...cur];
      const [item] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, item);
      return copy.map((b, i) => ({ ...b, order: i }));
    });
  }

  function addSet(blockId: string) {
    setBlocks((cur) =>
      cur.map((b) => {
        if (b.id !== blockId) return b;
        const last = b.sets[b.sets.length - 1];
        return { ...b, sets: [...b.sets, emptySet(last)] };
      })
    );
  }

  function updateSet(blockId: string, setId: string, patch: Partial<SetEntry>) {
    setBlocks((cur) =>
      cur.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          sets: b.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        };
      })
    );
  }

  function removeSet(blockId: string, setId: string) {
    setBlocks((cur) =>
      cur.map((b) => {
        if (b.id !== blockId) return b;
        if (b.sets.length <= 1) return b;
        return { ...b, sets: b.sets.filter((s) => s.id !== setId) };
      })
    );
  }

  function duplicateLastSet(blockId: string) {
    setBlocks((cur) =>
      cur.map((b) => {
        if (b.id !== blockId) return b;
        const last = b.sets[b.sets.length - 1];
        if (!last) return b;
        return { ...b, sets: [...b.sets, { ...last, id: uid() }] };
      })
    );
  }

  function save() {
    if (blocks.length === 0) return;
    // prune empty blocks — a block is "empty" when none of its sets have any
    // value entered (weight, reps, duration, or distance).
    const cleaned = blocks
      .filter((b) =>
        b.sets.some(
          (s) =>
            (s.weight ?? 0) > 0 ||
            (s.reps ?? 0) > 0 ||
            (s.duration ?? 0) > 0 ||
            (s.distance ?? 0) > 0
        )
      )
      .map((b, i) => ({ ...b, order: i }));

    if (cleaned.length === 0) return;

    const bw = bodyweight ? Number(bodyweight) : undefined;

    if (mode === "edit" && workoutId) {
      updateWorkout(workoutId, {
        date,
        name: name || undefined,
        bodyweight: bw,
        exercises: cleaned,
      });
    } else {
      const created = addWorkout({
        date,
        name: name || undefined,
        bodyweight: bw,
        exercises: cleaned,
      });
      // Send the user to the history list — there's no /history/[id] page
      // in this build (the detail view is a modal opened from the list), so
      // pushing to that URL used to 404. Tapping the new workout in the
      // list opens the detail modal.
      router.push("/history");
      return;
    }
    setSaving(true);
    setTimeout(() => setSaving(false), 600);
  }

  function handleDelete() {
    if (mode !== "edit" || !workoutId) return;
    if (!confirm("Delete this workout? This cannot be undone.")) return;
    deleteWorkout(workoutId);
    router.push("/history");
  }

  if (!hydrated) {
    return <div className="p-6 text-center text-sm text-zinc-500">Loading…</div>;
  }

  return (
    <div className="space-y-4 px-4 pt-4">
      {/* Date / name / bodyweight */}
      <section className="grid grid-cols-2 gap-3">
        <label className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">Date</div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full bg-transparent text-base text-zinc-100 outline-none"
          />
        </label>
        <label className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">Bodyweight (kg)</div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={bodyweight}
            onChange={(e) => setBodyweight(e.target.value)}
            placeholder="—"
            className="mt-1 w-full bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600"
          />
        </label>
      </section>

      <label className="block rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="text-[10px] uppercase tracking-wide text-zinc-400">Workout name (optional)</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push day"
          className="mt-1 w-full bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </label>

      {/* Exercise blocks */}
      {blocks.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center">
          <div className="text-sm text-zinc-300">No exercises yet</div>
          <p className="mt-1 text-xs text-zinc-500">
            Add an exercise to start logging sets.
          </p>
        </div>
      )}

      {blocks.map((block, idx) => {
        const ex = exercises.find((e) => e.id === block.exerciseId);
        return (
          <section
            key={block.id}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-100">
                  {ex?.name ?? "(deleted exercise)"}
                </div>
                <div className="text-xs text-zinc-500 capitalize">
                  {ex?.muscleGroup ?? ""} · {block.sets.length} sets
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, -1)}
                  disabled={idx === 0}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(block.id, 1)}
                  disabled={idx === blocks.length - 1}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"
                  aria-label="Remove exercise"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sets header */}
            <div className="mt-3 grid grid-cols-[2rem_7.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
              <div className="text-center">Set</div>
              <div className="text-center">Type</div>
              <div className="text-center">Weight (kg)</div>
              <div className="text-center">Reps / Time / Dist</div>
              <div />
            </div>

            <div className="mt-1 space-y-1.5">
              {block.sets.map((set, sIdx) => (
                <SetRow
                  key={set.id}
                  set={set}
                  index={sIdx}
                  onChange={(patch) => updateSet(block.id, set.id, patch)}
                  onRemove={() => removeSet(block.id, set.id)}
                  canRemove={block.sets.length > 1}
                />
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => addSet(block.id)}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-sm text-zinc-200 active:scale-[0.99]"
              >
                <Plus className="h-4 w-4" />
                Add set
              </button>
              <button
                type="button"
                onClick={() => duplicateLastSet(block.id)}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 active:scale-[0.99]"
                aria-label="Duplicate last set"
                title="Duplicate last set"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            {/* Per-exercise description / note */}
            <ExerciseNoteEditor
              note={block.note ?? ""}
              onChange={(v) => updateBlock(block.id, { note: v || undefined })}
            />
          </section>
        );
      })}

      {/* Add exercise */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 text-sm font-medium text-zinc-200 active:scale-[0.99]"
      >
        <Plus className="h-5 w-5" />
        Add exercise
      </button>

      {/* Save / Delete */}
      <div className="sticky bottom-20 z-10 -mx-4 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="flex gap-2">
          {mode === "edit" && (
            <button
              type="button"
              onClick={handleDelete}
              className="flex h-12 items-center justify-center rounded-2xl border border-zinc-800 px-4 text-rose-400 active:scale-[0.99]"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={blocks.length === 0}
            className={clsx(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-base font-semibold text-zinc-950 active:scale-[0.99] disabled:opacity-50"
            )}
          >
            <Save className="h-5 w-5" />
            {saving ? "Saved!" : mode === "edit" ? "Save changes" : "Save workout"}
          </button>
        </div>
      </div>

      {/* Picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">Add exercise</h3>
              <button
                onClick={() => setPickerOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-80 space-y-3 overflow-y-auto pb-2">
              {MUSCLE_GROUPS.map((g) => {
                const list = groupedExercises[g.value] ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={g.value}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {g.label}
                    </div>
                    <div className="mt-1 space-y-1">
                      {list.map((ex) => {
                        const used = usedExerciseIds.includes(ex.id);
                        return (
                          <button
                            key={ex.id}
                            onClick={() => addExerciseBlock(ex)}
                            className={clsx(
                              "flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-left active:scale-[0.99]",
                              used && "opacity-50"
                            )}
                            disabled={used}
                          >
                            <span className="text-sm text-zinc-100">{ex.name}</span>
                            {used && (
                              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                                added
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 border-t border-zinc-800 pt-3">
              {newExercise ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={newExercise.name}
                    onChange={(e) =>
                      setNewExercise({ ...newExercise, name: e.target.value })
                    }
                    placeholder="New exercise name"
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                  />
                  <select
                    value={newExercise.muscleGroup}
                    onChange={(e) =>
                      setNewExercise({
                        ...newExercise,
                        muscleGroup: e.target.value as MuscleGroup,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                  >
                    {MUSCLE_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewExercise(null)}
                      className="h-10 flex-1 rounded-lg border border-zinc-800 text-sm text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createNewExercise}
                      disabled={!newExercise.name.trim()}
                      className="h-10 flex-1 rounded-lg bg-emerald-500 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewExercise({ name: "", muscleGroup: "other" })}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 text-sm text-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                  New exercise
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="pt-2 text-center">
          <Link href="/history" className="text-xs text-zinc-500 hover:underline">
            Cancel
          </Link>
        </div>
      )}
    </div>
  );
}

function ExerciseNoteEditor({
  note,
  onChange,
}: {
  note: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState<boolean>(Boolean(note));
  const [value, setValue] = useState<string>(note);
  const [saved, setSaved] = useState<boolean>(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  function commit(next: string) {
    setValue(next);
    onChange(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  if (!open && !note) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => taRef.current?.focus(), 50);
        }}
        className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-400 active:scale-[0.99]"
      >
        <StickyNote className="h-3.5 w-3.5" />
        Add description / notes
      </button>
    );
  }

  if (!open && note) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => taRef.current?.focus(), 50);
        }}
        className="mt-2 flex w-full items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-left text-xs text-zinc-300 active:scale-[0.99]"
      >
        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <span className="line-clamp-2 whitespace-pre-wrap">{note}</span>
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-500">
          <StickyNote className="h-3 w-3" />
          Description / notes
        </div>
        <div className="flex items-center gap-1">
          {saved ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400">
              <Check className="h-3 w-3" />
              saved
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800"
            aria-label="Close"
            title="Close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit(value)}
        rows={2}
        placeholder="e.g. Incline press, focus on chest, elbows tucked at 60°"
        className="w-full resize-none rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
      />
    </div>
  );
}

function SetRow({
  set,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  set: SetEntry;
  index: number;
  onChange: (patch: Partial<SetEntry>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const type: SetType = set.type ?? "weight-reps";

  function num(value: number | undefined): string {
    if (value === undefined || value === null) return "";
    // Display durations in minutes with 2 decimals when small,
    // otherwise just the integer seconds.
    if (type === "weight-time" || type === "time" || type === "distance-time") {
      return value === 0 ? "" : String(value);
    }
    return value === 0 ? "" : String(value);
  }

  return (
    <div className="grid grid-cols-[2rem_7.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-1.5">
      <div className="text-center text-sm font-semibold text-zinc-300">
        {index + 1}
      </div>

      {/* Type selector */}
      <select
        value={type}
        onChange={(e) => onChange({ type: e.target.value as SetType })}
        className="h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-1 text-xs text-zinc-100 outline-none focus:border-emerald-500"
        aria-label="Set type"
      >
        {SET_TYPES.map((t) => (
          <option key={t} value={t}>
            {SET_TYPE_SHORT[t]}
          </option>
        ))}
      </select>

      {/* Weight input — only shown for types that use weight */}
      {type === "weight-reps" || type === "weight-time" || type === "weight-distance" ? (
        <input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          value={num(set.weight)}
          onChange={(e) =>
            onChange({
              weight: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          placeholder="kg"
          className="h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-1 text-center text-base tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
        />
      ) : (
        <div className="h-10 flex items-center justify-center text-xs text-zinc-600">
          —
        </div>
      )}

      {/* Reps / Time / Distance input — depends on type */}
      {type === "weight-reps" || type === "reps" ? (
        <input
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          value={num(set.reps)}
          onChange={(e) =>
            onChange({
              reps: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          placeholder="reps"
          className="h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-1 text-center text-base tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
        />
      ) : type === "weight-time" || type === "time" ? (
        <DurationInput
          value={set.duration}
          onChange={(seconds) => onChange({ duration: seconds })}
        />
      ) : type === "distance-time" ? (
        <div className="flex gap-1">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={set.distance !== undefined ? set.distance : ""}
            onChange={(e) =>
              onChange({
                distance: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder="m"
            className="h-10 w-1/2 min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-1 text-center text-base tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
          />
          <DurationInput
            value={set.duration}
            onChange={(seconds) => onChange({ duration: seconds })}
            className="h-10 w-1/2"
          />
        </div>
      ) : type === "weight-distance" ? (
        <div className="flex gap-1">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={set.distance !== undefined ? set.distance : ""}
            onChange={(e) =>
              onChange({
                distance: e.target.value === "" ? undefined : Number(e.target.value),
              })
            }
            placeholder="m"
            className="h-10 w-1/2 min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-1 text-center text-base tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-800 disabled:opacity-30"
        aria-label="Remove set"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function DurationInput({
  value,
  onChange,
  className,
}: {
  value: number | undefined;
  onChange: (seconds: number) => void;
  className?: string;
}) {
  // Show as M:SS — user edits the minutes and seconds parts.
  const total = value ?? 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return (
    <div className={clsx("flex items-stretch overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 focus-within:border-emerald-500", className)}>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={m > 0 ? String(m) : ""}
        onChange={(e) => {
          const newMin = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value));
          onChange(newMin * 60 + s);
        }}
        placeholder="m"
        className="w-0 min-w-0 flex-1 bg-transparent text-center text-base tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600"
      />
      <span className="self-center text-zinc-500">:</span>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        max="59"
        value={s > 0 ? String(s).padStart(2, "0") : ""}
        onChange={(e) => {
          const raw = e.target.value === "" ? 0 : Number(e.target.value);
          const newSec = Math.max(0, Math.min(59, raw));
          onChange(m * 60 + newSec);
        }}
        placeholder="00"
        className="w-0 min-w-0 flex-1 bg-transparent text-center text-base tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600"
      />
    </div>
  );
}
