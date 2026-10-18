"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { DeltaPill } from "@/components/StatCard";
import { WorkoutCard, type WorkoutTrend } from "@/components/WorkoutCard";
import { WorkoutDetailModal } from "@/components/WorkoutDetailModal";
import { WeeklyDetailModal } from "@/components/WeeklyDetailModal";
import { useExercises, useTemplates, useWorkouts } from "@/lib/hooks";
import {
  lastNWeeksVolume,
  latestPR,
  progressByExercise,
  thisWeekVsLastWeek,
  totalVolume,
} from "@/lib/stats";
import {
  formatDate,
  formatPct,
  formatVolume,
  formatWeekLabel,
  formatWeight,
  pluralize,
  todayLocalISO,
} from "@/lib/format";
import type { MuscleGroup, WeeklyVolume } from "@/lib/types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const templates = useTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** When set, opens the per-exercise breakdown modal for the chosen week
   *  (this week or last week, keyed by the Monday of that week). */
  const [weeklyViewStart, setWeeklyViewStart] = useState<string | null>(null);

  const summary = useMemo(
    () => thisWeekVsLastWeek(workouts, exercises),
    [workouts, exercises]
  );
  const weekly = useMemo(() => lastNWeeksVolume(workouts, 6), [workouts]);
  const pr = useMemo(() => latestPR(workouts), [workouts]);

  const recent = workouts.slice(0, 3);

  // Find the most-improved exercise this week vs last week (by total volume)
  const topImprovement = useMemo(() => {
    const ids = Array.from(
      new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId)))
    );
    let best: { id: string; pct: number; delta: number } | null = null;
    for (const id of ids) {
      const points = progressByExercise(workouts, id);
      if (points.length < 2) continue;
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      if (prev.totalVolume === 0 && last.totalVolume === 0) continue;
      const delta = last.totalVolume - prev.totalVolume;
      const pct = prev.totalVolume > 0 ? (delta / prev.totalVolume) * 100 : 100;
      if (!best || pct > best.pct) best = { id, pct, delta };
    }
    return best;
  }, [workouts]);

  // "Up next": the active template you've gone longest without logging
  // (matched on workout name), so a Push / Pull / Legs split rotates by
  // itself. Templates never logged come first.
  const upNext = useMemo(() => {
    const active = templates.filter((t) => !t.archived);
    if (active.length === 0) return null;
    const lastDone = new Map<string, string>();
    for (const w of workouts) {
      const key = w.name?.trim().toLowerCase();
      if (key && !lastDone.has(key)) lastDone.set(key, w.date);
    }
    return [...active].sort((a, b) => {
      const da = lastDone.get(a.name.trim().toLowerCase()) ?? "";
      const db = lastDone.get(b.name.trim().toLowerCase()) ?? "";
      return da.localeCompare(db);
    })[0];
  }, [templates, workouts]);

  const lastWorkout = workouts[0];
  const totalAllTime = useMemo(
    () => workouts.reduce((s, w) => s + totalVolume(w), 0),
    [workouts]
  );

  // Trend map shared by "Last workout" and "Recent" cards. Computed from the
  // full workout list so the comparison is stable.
  const trendById = useMemo(() => {
    const map = new Map<string, WorkoutTrend>();
    for (let i = 0; i < workouts.length; i++) {
      const cur = workouts[i];
      const prev = workouts[i + 1];
      if (!prev) continue;
      const dv = totalVolume(cur) - totalVolume(prev);
      if (Math.abs(dv) < 0.5) map.set(cur.id, "flat");
      else if (dv > 0) map.set(cur.id, "up");
      else map.set(cur.id, "down");
    }
    return map;
  }, [workouts]);

  const sessionsThisWeek = summary
    ? workouts.filter((w) => w.date >= summary.thisWeek.weekStart).length
    : 0;
  const nameOf = (id: string) =>
    exercises.find((e) => e.id === id)?.name ?? "—";

  return (
    <PageShell>
      <PageHeader
        title={greeting()}
        subtitle={
          workouts.length === 0
            ? formatDate(todayLocalISO())
            : `${formatDate(todayLocalISO())} · ${pluralize(workouts.length, "workout")} logged`
        }
      />

      <div className="space-y-3.5 px-4 pt-4">
        {/* Quick start */}
        <Link
          href={upNext ? `/log?template=${encodeURIComponent(upNext.id)}` : "/log"}
          className="flex min-h-16 items-center justify-between rounded-[20px] bg-emerald-500 px-4.5 text-zinc-950 transition-transform active:scale-[0.99]"
        >
          <span>
            <span className="block text-[13px] font-semibold opacity-75">
              {upNext ? "Up next from your templates" : "Ready when you are"}
            </span>
            <span className="block text-xl font-bold">
              {upNext ? `Start ${upNext.name}` : "Log a workout"}
            </span>
          </span>
          <ArrowRight className="h-5.5 w-5.5" strokeWidth={2.4} aria-hidden />
        </Link>

        {/* This week. Tapping opens the per-exercise breakdown; the delta
            pill opens last week's. Chip color means "this week's set count
            vs last week's for the same group": lime = up, rose = down. */}
        {summary && workouts.length > 0 && (
          <section className="rounded-[20px] border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                This week
              </h2>
              <button
                type="button"
                onClick={() => setWeeklyViewStart(summary.lastWeek.weekStart)}
                aria-label={`Open last-week breakdown (${formatVolume(summary.lastWeek.volume)})`}
                className="inline-flex min-h-8 items-center gap-1.5 text-xs text-zinc-400"
              >
                <DeltaPill pct={summary.volumeDeltaPct} />
                vs last
              </button>
            </div>
            <button
              type="button"
              onClick={() => setWeeklyViewStart(summary.thisWeek.weekStart)}
              aria-label={`Open this-week breakdown (${formatVolume(summary.thisWeek.volume)})`}
              className="block w-full text-left"
            >
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-display text-[44px] font-bold leading-tight tabular-nums">
                  {formatVolume(summary.thisWeek.volume)}
                </span>
                <span className="text-sm text-zinc-400">
                  lifted · {pluralize(sessionsThisWeek, "session")}
                </span>
              </div>
              {weekly.some((w) => w.volume > 0) && (
                <WeeklyVolumeBars weekly={weekly} />
              )}
              <MuscleGroupChips
                thisWeek={summary.setsByMuscle.thisWeek}
                lastWeek={summary.setsByMuscle.lastWeek}
              />
            </button>
          </section>
        )}

        {/* Latest PR + most improved */}
        {(pr || topImprovement) && exercises.length > 0 && (
          <section className="grid grid-cols-2 gap-3">
            {pr ? (
              <Link
                href="/progress"
                className="rounded-[20px] bg-amber-500 p-3.5 text-amber-950 transition-transform active:scale-[0.99]"
              >
                <Trophy className="h-5.5 w-5.5" strokeWidth={2.2} aria-hidden />
                <div className="mt-1.5 text-xs font-bold uppercase tracking-wider">
                  Latest PR
                </div>
                <div className="text-[17px] font-bold leading-tight">
                  {nameOf(pr.exerciseId)}
                </div>
                <div className="mt-0.5 font-mono text-base font-bold">
                  {formatWeight(pr.weight)} × {pr.reps}
                </div>
              </Link>
            ) : (
              <AllTimeCard total={totalAllTime} />
            )}
            {topImprovement ? (
              <Link
                href="/progress"
                className="rounded-[20px] border border-zinc-800 bg-zinc-900 p-3.5 transition-transform active:scale-[0.99]"
              >
                <TrendingUp
                  className="h-5.5 w-5.5 text-emerald-400"
                  strokeWidth={2.2}
                  aria-hidden
                />
                <div className="mt-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Most improved
                </div>
                <div className="text-[17px] font-bold leading-tight">
                  {nameOf(topImprovement.id)}
                </div>
                <div
                  className={clsx(
                    "mt-0.5 text-[15px] font-bold",
                    topImprovement.delta > 0 ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {formatPct(topImprovement.pct)} volume
                </div>
              </Link>
            ) : (
              <AllTimeCard total={totalAllTime} />
            )}
          </section>
        )}

        {/* Last workout */}
        {lastWorkout && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Last workout
              </h2>
              <Link
                href="/history"
                className="text-xs font-semibold text-emerald-400 hover:underline"
              >
                See all
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(lastWorkout.id)}
              className="block w-full text-left active:scale-[0.99] transition-transform"
              aria-label={`Open ${lastWorkout.name || "workout"} from ${lastWorkout.date}`}
            >
              <WorkoutCard
                workout={lastWorkout}
                exercises={exercises}
                trend={trendById.get(lastWorkout.id)}
              />
            </button>
          </section>
        )}

        {/* Recent */}
        {recent.length > 1 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
              Recent
            </h2>
            <div className="space-y-2">
              {recent.slice(1).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedId(w.id)}
                  className="block w-full text-left active:scale-[0.99] transition-transform"
                  aria-label={`Open ${w.name || "workout"} from ${w.date}`}
                >
                  <WorkoutCard
                    workout={w}
                    exercises={exercises}
                    trend={trendById.get(w.id)}
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Library */}
        {workouts.length > 0 && (
          <Link
            href="/exercises"
            className="flex items-center justify-between rounded-[20px] border border-zinc-800 bg-zinc-900 px-4 py-3.5 active:scale-[0.99] transition-transform"
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Exercise library
              </span>
              <span className="block text-sm text-zinc-300">
                {pluralize(exercises.length, "exercise")} ·{" "}
                {formatVolume(totalAllTime)} lifted all time
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-zinc-500" aria-hidden />
          </Link>
        )}

        {/* Empty state */}
        {workouts.length === 0 && (
          <section className="rounded-[20px] border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-zinc-500" aria-hidden />
            <div className="mt-3 font-display text-2xl font-bold uppercase text-zinc-100">
              Log your first workout
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Your weekly volume, PRs and most improved lifts show up here
              once you&apos;ve logged a session.
            </p>
          </section>
        )}
      </div>

      {selectedId && (
        <WorkoutDetailModal
          workoutId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
      {weeklyViewStart && (
        <WeeklyDetailModal
          weekStart={weeklyViewStart}
          onClose={() => setWeeklyViewStart(null)}
        />
      )}
    </PageShell>
  );
}

function AllTimeCard({ total }: { total: number }) {
  return (
    <Link
      href="/history"
      className="rounded-[20px] border border-zinc-800 bg-zinc-900 p-3.5 transition-transform active:scale-[0.99]"
    >
      <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">
        All time
      </div>
      <div className="mt-1 font-display text-3xl font-bold tabular-nums">
        {formatVolume(total)}
      </div>
      <div className="text-xs text-zinc-400">total volume lifted</div>
    </Link>
  );
}

// Weekly volume as six bars, oldest left, this week highlighted. Hand-rolled
// SVG instead of pulling recharts (~50KB) for one small widget. Bars use a
// minimum height so a light-but-real week doesn't look like a zero week.
function WeeklyVolumeBars({ weekly }: { weekly: WeeklyVolume[] }) {
  const W = 320;
  const H = 70;
  const GAP = 16;
  const barW = (W - GAP * (weekly.length - 1)) / weekly.length;
  const maxV = Math.max(1, ...weekly.map((w) => w.volume));

  return (
    <div className="mt-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Weekly volume, last ${weekly.length} weeks: ${weekly
          .map((w) => `${formatWeekLabel(w.weekStart)} ${formatVolume(w.volume)}`)
          .join(", ")}`}
      >
        {weekly.map((w, i) => {
          const h = w.volume > 0 ? Math.max(6, (w.volume / maxV) * H) : 3;
          const isCurrent = i === weekly.length - 1;
          return (
            <rect
              key={w.weekStart}
              x={i * (barW + GAP)}
              y={H - h}
              width={barW}
              height={h}
              rx={6}
              className={isCurrent ? "fill-emerald-500" : "fill-zinc-700"}
            />
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
        <span>{formatWeekLabel(weekly[0].weekStart)}</span>
        <span>This week</span>
      </div>
    </div>
  );
}

/**
 * Display order for muscle groups in the "This week" chips. Puts the user's
 * commonly-requested groups (chest / back / arms / core) first, then the
 * rest in a sensible order. Groups with zero sets in BOTH weeks are
 * filtered out.
 */
const MUSCLE_DISPLAY_ORDER: MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
  "glutes",
  "core",
  "cardio",
  "other",
];

/**
 * Per-muscle-group set counts for this week. Each chip's color reflects the
 * delta vs last week for that same group: lime if higher, rose if lower,
 * neutral if equal or no prior data.
 */
function MuscleGroupChips({
  thisWeek,
  lastWeek,
}: {
  thisWeek: Partial<Record<MuscleGroup, number>>;
  lastWeek: Partial<Record<MuscleGroup, number>>;
}) {
  const allGroups = new Set<MuscleGroup>([
    ...(Object.keys(thisWeek) as MuscleGroup[]),
    ...(Object.keys(lastWeek) as MuscleGroup[]),
  ]);
  const groups = MUSCLE_DISPLAY_ORDER.filter((g) => allGroups.has(g));

  if (groups.length === 0) {
    return <div className="mt-2.5 text-xs text-zinc-500">No sets logged yet</div>;
  }

  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-semibold tabular-nums">
      {groups.map((g) => {
        const tw = thisWeek[g] ?? 0;
        const lw = lastWeek[g] ?? 0;
        const up = tw > lw;
        const down = tw < lw;
        return (
          <span
            key={g}
            className={clsx(
              "rounded-full px-2.5 py-1 capitalize",
              up
                ? "bg-emerald-500/15 text-emerald-400"
                : down
                ? "bg-rose-500/15 text-rose-300"
                : "bg-zinc-800 text-zinc-400"
            )}
          >
            {g} {tw}
            {up ? " ↑" : down ? " ↓" : ""}
          </span>
        );
      })}
    </div>
  );
}
