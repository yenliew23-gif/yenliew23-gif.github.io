"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Trash2,
  Archive,
  ArchiveRestore,
  Sparkles,
  Pencil,
  X,
} from "lucide-react";
import clsx from "clsx";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { useExercises, useWorkouts } from "@/lib/hooks";
import { addExercise, deleteExercise, updateExercise } from "@/lib/storage";
import type { Exercise, MuscleGroup } from "@/lib/types";

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

const COMMON_EXERCISES: { name: string; muscleGroup: MuscleGroup }[] = [
  { name: "Bench Press", muscleGroup: "chest" },
  { name: "Incline Dumbbell Press", muscleGroup: "chest" },
  { name: "Back Squat", muscleGroup: "legs" },
  { name: "Front Squat", muscleGroup: "legs" },
  { name: "Romanian Deadlift", muscleGroup: "legs" },
  { name: "Deadlift", muscleGroup: "back" },
  { name: "Barbell Row", muscleGroup: "back" },
  { name: "Pull-up", muscleGroup: "back" },
  { name: "Lat Pulldown", muscleGroup: "back" },
  { name: "Overhead Press", muscleGroup: "shoulders" },
  { name: "Lateral Raise", muscleGroup: "shoulders" },
  { name: "Bicep Curl", muscleGroup: "arms" },
  { name: "Tricep Pushdown", muscleGroup: "arms" },
  { name: "Plank", muscleGroup: "core" },
];

export default function ExercisesPage() {
  const exercises = useExercises();
  const workouts = useWorkouts();
  const [q, setQ] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<MuscleGroup>("other");

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of workouts) {
      for (const b of w.exercises) {
        map.set(b.exerciseId, (map.get(b.exerciseId) ?? 0) + 1);
      }
    }
    return map;
  }, [workouts]);

  const grouped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = exercises.filter((e) =>
      needle ? e.name.toLowerCase().includes(needle) : true
    );
    const buckets: Record<string, Exercise[]> = {};
    for (const eg of MUSCLE_GROUPS) buckets[eg.value] = [];
    for (const e of filtered) {
      const key = e.archived ? "__archived" : e.muscleGroup;
      buckets[key] = buckets[key] ?? [];
      buckets[key].push(e);
    }
    return buckets;
  }, [exercises, q]);

  async function handleAdd() {
    if (!newName.trim()) return;
    addExercise({ name: newName.trim(), muscleGroup: newGroup });
    setNewName("");
  }

  function handleAddCommon() {
    if (exercises.length > 0) {
      if (!confirm("Add the common exercises list? Already-added ones will be skipped.")) return;
    }
    const existing = new Set(exercises.map((e) => e.name.toLowerCase()));
    for (const c of COMMON_EXERCISES) {
      if (!existing.has(c.name.toLowerCase())) {
        addExercise(c);
      }
    }
  }

  function handleArchive(ex: Exercise) {
    updateExercise(ex.id, { archived: !ex.archived });
  }

  function handleDelete(ex: Exercise) {
    if (usageCount.get(ex.id)) {
      if (!confirm(`"${ex.name}" is used in ${usageCount.get(ex.id)} session(s). Delete anyway?`)) return;
    } else if (!confirm(`Delete "${ex.name}"?`)) {
      return;
    }
    deleteExercise(ex.id);
  }

  const [editing, setEditing] = useState<Exercise | null>(null);

  return (
    <PageShell>
      <PageHeader
        title="Exercises"
        subtitle={`${exercises.filter((e) => !e.archived).length} active · ${exercises.length} total`}
      />

      <div className="space-y-4 px-4 pt-4">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-900/60 pl-9 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
          />
        </div>

        {/* Quick add */}
        <button
          onClick={handleAddCommon}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-300 active:scale-[0.99]"
        >
          <Sparkles className="h-4 w-4" />
          Add common exercises ({COMMON_EXERCISES.length})
        </button>

        {/* New exercise */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            Add exercise
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="e.g. Incline Bench"
              className="h-10 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
            />
            <select
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value as MuscleGroup)}
              className="h-10 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            >
              {MUSCLE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-zinc-950 disabled:opacity-50"
              aria-label="Add"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </section>

        {/* Groups */}
        {MUSCLE_GROUPS.map((g) => {
          const list = grouped[g.value];
          if (!list || list.length === 0) return null;
          return (
            <section key={g.value}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {g.label}
              </h2>
              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
                {list.map((ex, idx) => {
                  const count = usageCount.get(ex.id) ?? 0;
                  return (
                    <div
                      key={ex.id}
                      className={clsx(
                        "flex items-center justify-between gap-2 px-3 py-2.5",
                        idx > 0 && "border-t border-zinc-800/80"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-zinc-100">
                          {ex.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {count > 0
                            ? `Used ${count}×`
                            : "Never used"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => setEditing(ex)}
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
                          aria-label="Edit"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleArchive(ex)}
                          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
                          aria-label={ex.archived ? "Unarchive" : "Archive"}
                          title={ex.archived ? "Unarchive" : "Archive"}
                        >
                          {ex.archived ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(ex)}
                          className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"
                          aria-label="Delete"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Edit modal */}
        {editing && (
          <EditExerciseDialog
            exercise={editing}
            onClose={() => setEditing(null)}
          />
        )}

        {/* Archived */}
        {grouped.__archived && grouped.__archived.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Archived
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 opacity-60">
              {grouped.__archived.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="text-sm text-zinc-300">{ex.name}</div>
                  <button
                    onClick={() => handleArchive(ex)}
                    className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
                    aria-label="Unarchive"
                  >
                    <ArchiveRestore className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function EditExerciseDialog({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(exercise.muscleGroup);
  const [notes, setNotes] = useState(exercise.notes ?? "");

  function handleSave() {
    if (!name.trim()) return;
    updateExercise(exercise.id, {
      name: name.trim(),
      muscleGroup,
      notes: notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Edit exercise</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-zinc-400">
              Name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="mt-1 h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-base text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-zinc-400">
              Muscle group
            </span>
            <select
              value={muscleGroup}
              onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
              className="mt-1 h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 text-base text-zinc-100 outline-none focus:border-emerald-500"
            >
              {MUSCLE_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-zinc-400">
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. grip width, machine, setup"
              className="mt-1 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="h-11 flex-1 rounded-2xl border border-zinc-800 text-sm text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="h-11 flex-1 rounded-2xl bg-emerald-500 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
