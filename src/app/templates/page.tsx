"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Copy,
  X,
  Edit3,
  Archive,
  ArchiveRestore,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { useExercises, useTemplates } from "@/lib/hooks";
import {
  addTemplate,
  deleteTemplate,
  getTemplate,
  updateTemplate,
  uid,
} from "@/lib/storage";
import type {
  Exercise,
  MuscleGroup,
  TemplateExercise,
  WorkoutTemplate,
} from "@/lib/types";

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

export default function TemplatesPage() {
  const templates = useTemplates();
  const exercises = useExercises();
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = templates.filter((t) => !t.archived);
  const archived = templates.filter((t) => t.archived);

  function handleNew() {
    const t = addTemplate({ name: "New template", exercises: [] });
    setEditing({ id: t.id });
  }

  return (
    <PageShell>
      <PageHeader
        title="Templates"
        subtitle={`${active.length} active`}
      />

      <div className="space-y-4 px-4 pt-4">
        <button
          onClick={handleNew}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-base font-semibold text-zinc-950 active:scale-[0.99]"
        >
          <Plus className="h-5 w-5" />
          New template
        </button>

        {templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-zinc-500" />
            <div className="mt-3 text-base font-medium text-zinc-200">
              Build a workout template
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Make a &quot;Push day&quot;, &quot;Legs A&quot;, etc. with your
              default sets/reps/weight. Start any workout from it with one tap.
            </p>
          </div>
        )}

        {active.length > 0 && (
          <div className="space-y-2">
            {active.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                exercises={exercises}
                onEdit={() => setEditing({ id: t.id })}
              />
            ))}
          </div>
        )}

        {archived.length > 0 && (
          <section>
            <button
              onClick={() => setShowArchived((s) => !s)}
              className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              {showArchived ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              Archived ({archived.length})
            </button>
            {showArchived && (
              <div className="space-y-2 opacity-60">
                {archived.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    exercises={exercises}
                    onEdit={() => setEditing({ id: t.id })}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {editing && (
        <TemplateEditor
          id={editing.id!}
          onClose={() => setEditing(null)}
          exercises={exercises}
        />
      )}
    </PageShell>
  );
}

function TemplateRow({
  template,
  exercises,
  onEdit,
}: {
  template: WorkoutTemplate;
  exercises: Exercise[];
  onEdit: () => void;
}) {
  const exNames = template.exercises
    .map((te) => exercises.find((e) => e.id === te.exerciseId)?.name)
    .filter(Boolean)
    .slice(0, 4);
  const more = template.exercises.length - exNames.length;

  return (
    <button
      onClick={onEdit}
      className="block w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left active:scale-[0.99]"
    >
      <div className="flex items-center justify-between">
        <div className="truncate text-sm font-semibold text-zinc-100">
          {template.name}
        </div>
        <Edit3 className="h-4 w-4 text-zinc-500" />
      </div>
      <div className="mt-1 text-sm text-zinc-300 line-clamp-2">
        {exNames.length > 0
          ? exNames.join(" · ") + (more > 0 ? ` +${more}` : "")
          : "No exercises yet"}
      </div>
      <div className="mt-2 text-xs text-zinc-500">
        {template.exercises.length} exercise
        {template.exercises.length === 1 ? "" : "s"}
      </div>
    </button>
  );
}

function TemplateEditor({
  id,
  onClose,
  exercises,
}: {
  id: string;
  onClose: () => void;
  exercises: Exercise[];
}) {
  const [tpl, setTpl] = useState<WorkoutTemplate | null>(null);
  const [name, setName] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newEx, setNewEx] = useState<{ name: string; muscleGroup: MuscleGroup } | null>(null);

  useEffect(() => {
    const t = getTemplate(id);
    if (t) {
      setTpl(t);
      setName(t.name);
    }
  }, [id]);

  const grouped = useMemo(() => {
    const buckets: Record<string, Exercise[]> = {};
    for (const eg of MUSCLE_GROUPS) buckets[eg.value] = [];
    for (const e of exercises) {
      if (e.archived) continue;
      (buckets[e.muscleGroup] = buckets[e.muscleGroup] ?? []).push(e);
    }
    return buckets;
  }, [exercises]);

  if (!tpl) {
    return null;
  }

  function persist(patch: Partial<WorkoutTemplate>) {
    if (!tpl) return;
    updateTemplate(tpl.id, patch);
    setTpl({ ...tpl, ...patch });
  }

  function addBlock(ex: Exercise) {
    if (!tpl) return;
    const block: TemplateExercise = {
      id: uid(),
      exerciseId: ex.id,
      order: tpl.exercises.length,
      defaultSets: 3,
      defaultReps: 8,
    };
    persist({ exercises: [...tpl.exercises, block] });
    setPickerOpen(false);
  }

  function createNewExercise() {
    if (!newEx) return;
    const created: Exercise = {
      id: uid(),
      name: newEx.name.trim(),
      muscleGroup: newEx.muscleGroup,
      createdAt: Date.now(),
    };
    const all = JSON.parse(
      window.localStorage.getItem("gym.exercises.v1") ?? "[]"
    ) as Exercise[];
    window.localStorage.setItem(
      "gym.exercises.v1",
      JSON.stringify([created, ...all])
    );
    window.dispatchEvent(new CustomEvent("gym:data-changed"));
    addBlock(created);
    setNewEx(null);
  }

  function updateBlock(bid: string, patch: Partial<TemplateExercise>) {
    if (!tpl) return;
    persist({
      exercises: tpl.exercises.map((b) => (b.id === bid ? { ...b, ...patch } : b)),
    });
  }

  function removeBlock(bid: string) {
    if (!tpl) return;
    persist({ exercises: tpl.exercises.filter((b) => b.id !== bid) });
  }

  function moveBlock(bid: string, dir: -1 | 1) {
    if (!tpl) return;
    const idx = tpl.exercises.findIndex((b) => b.id === bid);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= tpl.exercises.length) return;
    const copy = [...tpl.exercises];
    const [item] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, item);
    persist({ exercises: copy.map((b, i) => ({ ...b, order: i })) });
  }

  function handleArchive() {
    if (!tpl) return;
    persist({ archived: !tpl.archived });
  }

  function handleDelete() {
    if (!tpl) return;
    if (!confirm(`Delete template "${tpl.name}"?`)) return;
    deleteTemplate(tpl.id);
    onClose();
  }

  function handleDuplicate() {
    if (!tpl) return;
    addTemplate({
      name: `${tpl.name} (copy)`,
      exercises: tpl.exercises.map((b) => ({ ...b, id: uid() })),
      archived: false,
    });
    onClose();
  }

  const usedIds = tpl.exercises.map((b) => b.exerciseId);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-base font-semibold text-zinc-100">Edit template</h2>
        <button
          onClick={handleDelete}
          className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"
          aria-label="Delete"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        <label className="block rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="text-[10px] uppercase tracking-wide text-zinc-400">
            Name
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              persist({ name: e.target.value });
            }}
            placeholder="e.g. Push day"
            className="mt-1 w-full bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600"
          />
        </label>

        <div className="mt-3 flex gap-2">
          <button
            onClick={handleArchive}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          >
            {tpl.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {tpl.archived ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={handleDuplicate}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 text-sm text-zinc-200"
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {tpl.exercises.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
              No exercises yet
            </div>
          )}

          {tpl.exercises.map((block, idx) => {
            const ex = exercises.find((e) => e.id === block.exerciseId);
            return (
              <section
                key={block.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">
                      {ex?.name ?? "(deleted)"}
                    </div>
                    <div className="text-xs capitalize text-zinc-500">
                      {ex?.muscleGroup ?? ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => moveBlock(block.id, -1)}
                      disabled={idx === 0}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => moveBlock(block.id, 1)}
                      disabled={idx === tpl.exercises.length - 1}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeBlock(block.id)}
                      className="rounded-md p-1.5 text-rose-400 hover:bg-rose-500/10"
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="block">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Sets
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={block.defaultSets}
                      onChange={(e) =>
                        updateBlock(block.id, {
                          defaultSets: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="mt-1 h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-center text-base tabular-nums text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="block">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Reps
                    </div>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={block.defaultReps}
                      onChange={(e) =>
                        updateBlock(block.id, {
                          defaultReps: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="mt-1 h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-center text-base tabular-nums text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="block">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                      Weight (kg)
                    </div>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      value={block.defaultWeight ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        updateBlock(block.id, {
                          defaultWeight:
                            e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      className="mt-1 h-10 w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-center text-base tabular-nums text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                    />
                  </label>
                </div>
              </section>
            );
          })}

          <button
            onClick={() => setPickerOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 text-sm font-medium text-zinc-200 active:scale-[0.99]"
          >
            <Plus className="h-5 w-5" />
            Add exercise
          </button>
        </div>
      </div>

      {/* Sticky done button */}
      <div className="sticky bottom-0 z-10 border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
        <button
          onClick={onClose}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-500 text-base font-semibold text-zinc-950"
        >
          Done
        </button>
      </div>

      {/* Picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-3xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
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

            <div className="flex-1 space-y-3 overflow-y-auto pb-2">
              {MUSCLE_GROUPS.map((g) => {
                const list = grouped[g.value];
                if (!list || list.length === 0) return null;
                return (
                  <div key={g.value}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {g.label}
                    </div>
                    <div className="mt-1 space-y-1">
                      {list.map((ex) => {
                        const used = usedIds.includes(ex.id);
                        return (
                          <button
                            key={ex.id}
                            onClick={() => addBlock(ex)}
                            disabled={used}
                            className={clsx(
                              "flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-left active:scale-[0.99]",
                              used && "opacity-50"
                            )}
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
              {newEx ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    type="text"
                    value={newEx.name}
                    onChange={(e) =>
                      setNewEx({ ...newEx, name: e.target.value })
                    }
                    placeholder="New exercise name"
                    className="h-10 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                  />
                  <select
                    value={newEx.muscleGroup}
                    onChange={(e) =>
                      setNewEx({ ...newEx, muscleGroup: e.target.value as MuscleGroup })
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
                      onClick={() => setNewEx(null)}
                      className="h-10 flex-1 rounded-lg border border-zinc-800 text-sm text-zinc-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createNewExercise}
                      disabled={!newEx.name.trim()}
                      className="h-10 flex-1 rounded-lg bg-emerald-500 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewEx({ name: "", muscleGroup: "other" })}
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
    </div>
  );
}
