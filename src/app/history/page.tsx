"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { WorkoutCard } from "@/components/WorkoutCard";
import { WorkoutDetailModal } from "@/components/WorkoutDetailModal";
import { useExercises, useWorkouts } from "@/lib/hooks";
import { formatWeekLabel } from "@/lib/format";
import { weekStartOf } from "@/lib/stats";

export default function HistoryPage() {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!q.trim()) return workouts;
    const needle = q.toLowerCase();
    return workouts.filter((w) => {
      if (w.name?.toLowerCase().includes(needle)) return true;
      return w.exercises.some((e) => {
        const ex = exercises.find((x) => x.id === e.exerciseId);
        return ex?.name.toLowerCase().includes(needle);
      });
    });
  }, [workouts, exercises, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const w of filtered) {
      const k = weekStartOf(w.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(w);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <PageShell>
      <PageHeader title="History" subtitle={`${workouts.length} workouts total`} />

      <div className="space-y-5 px-4 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search exercise or workout…"
            className="h-10 w-full rounded-full border border-zinc-800 bg-zinc-900/60 pl-9 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-500"
          />
        </div>

        {grouped.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
            <div className="text-sm text-zinc-300">No workouts found</div>
            <p className="mt-1 text-xs text-zinc-500">
              {q ? "Try a different search." : "Log your first workout to see it here."}
            </p>
          </div>
        )}

        {grouped.map(([week, ws]) => (
          <section key={week}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Week of {formatWeekLabel(week)}
            </h2>
            <div className="space-y-2">
              {ws.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedId(w.id)}
                  className="block w-full text-left"
                >
                  <WorkoutCard workout={w} exercises={exercises} />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedId && (
        <WorkoutDetailModal
          workoutId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </PageShell>
  );
}
