"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, ChevronRight } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { WorkoutEditor } from "@/components/WorkoutEditor";
import { useTemplates } from "@/lib/hooks";
import { getTemplate, uid } from "@/lib/storage";
import type { WorkoutExercise, WorkoutTemplate } from "@/lib/types";

export default function LogPage() {
  const templates = useTemplates();
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
  const initialBlocks: Omit<WorkoutExercise, never>[] = appliedTemplate
    ? appliedTemplate.exercises.map((te, idx) => ({
        id: uid(),
        exerciseId: te.exerciseId,
        order: idx,
        sets: Array.from({ length: te.defaultSets }).map(() => ({
          id: uid(),
          weight: te.defaultWeight ?? 0,
          reps: te.defaultReps,
        })),
      }))
    : [];

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
