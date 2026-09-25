"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Trophy, Activity } from "lucide-react";
import { PageShell, PageHeader } from "@/components/PageHeader";
import { StatCard, DeltaPill } from "@/components/StatCard";
import { WorkoutCard, type WorkoutTrend } from "@/components/WorkoutCard";
import { WorkoutDetailModal } from "@/components/WorkoutDetailModal";
import { WeeklyDetailModal } from "@/components/WeeklyDetailModal";
import { useExercises, useWorkouts } from "@/lib/hooks";
import {
  lastNWeeksVolume,
  personalRecord,
  progressByExercise,
  thisWeekVsLastWeek,
  totalVolume,
} from "@/lib/stats";
import { formatPct, formatVolume, formatWeekLabel, pluralize } from "@/lib/format";
import type { MuscleGroup, WeeklyVolume } from "@/lib/types";

export default function HomePage() {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** When set, opens the per-exercise breakdown modal for the chosen week
   *  (this week or last week, keyed by the Monday of that week). */
  const [weeklyViewStart, setWeeklyViewStart] = useState<string | null>(null);

  const summary = useMemo(
    () => thisWeekVsLastWeek(workouts, exercises),
    [workouts, exercises]
  );
  const weekly = useMemo(() => lastNWeeksVolume(workouts, 6), [workouts]);

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

  return (
    <PageShell>
      <PageHeader
        title="Gym Tracker"
        subtitle={
          workouts.length === 0
            ? "No workouts yet"
            : `${pluralize(workouts.length, "workout")} logged`
        }
        right={
          <Link
            href="/log"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-zinc-950"
            aria-label="Log workout"
          >
            <Plus className="h-5 w-5" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 pt-4">
        {/* This week vs last week — both cards show a per-muscle-group set
            breakdown so the user can see WHERE volume came from, not just
            that it went up or down. Chip color always means "this week's
            count vs last week's count for the same group" — emerald = up,
            rose = down, zinc = same / no prior. */}
        {summary && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              This week vs last
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="This week"
                value={formatVolume(summary.thisWeek.volume)}
                hint={
                  <MuscleGroupChips
                    thisWeek={summary.setsByMuscle.thisWeek}
                    lastWeek={summary.setsByMuscle.lastWeek}
                  />
                }
                onClick={() => setWeeklyViewStart(summary.thisWeek.weekStart)}
                ariaLabel={`Open this-week breakdown (${formatVolume(summary.thisWeek.volume)})`}
              />
              <StatCard
                label="vs Last week"
                value={formatVolume(summary.lastWeek.volume)}
                hint={
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1">
                      <DeltaPill pct={summary.volumeDeltaPct} />
                    </div>
                    <MuscleGroupChips
                      thisWeek={summary.setsByMuscle.thisWeek}
                      lastWeek={summary.setsByMuscle.lastWeek}
                    />
                  </div>
                }
                tone={
                  summary.volumeDelta > 0
                    ? "positive"
                    : summary.volumeDelta < 0
                    ? "negative"
                    : "default"
                }
                onClick={() => setWeeklyViewStart(summary.lastWeek.weekStart)}
                ariaLabel={`Open last-week breakdown (${formatVolume(summary.lastWeek.volume)})`}
              />
            </div>
          </section>
        )}

        {/* Weekly volume bars — always render the section (with empty-state
            inside if there's no data yet) so the user can see what's
            expected. Previously hidden entirely, which made it look broken
            when no workouts were in the last 6 weeks. */}
        {weekly.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Weekly volume
            </h2>
            {weekly.some((w) => w.volume > 0) ? (
              <WeeklyVolumeChart weekly={weekly} />
            ) : (
              <div className="py-6 text-center text-sm text-zinc-500">
                Log a weight-reps workout to see your weekly volume trend.
              </div>
            )}
          </section>
        )}

        {/* Highlights */}
        <section className="grid grid-cols-2 gap-3">
          <Link
            href="/exercises"
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                Exercises
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="mt-1 text-xl font-semibold">{exercises.length}</div>
            <div className="text-xs text-zinc-400">in your library</div>
          </Link>
          <Link
            href="/history"
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-zinc-400">
                All time
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="mt-1 text-xl font-semibold">
              {formatVolume(totalAllTime)}
            </div>
            <div className="text-xs text-zinc-400">total volume lifted</div>
          </Link>
        </section>

        {/* Most improved */}
        {topImprovement && exercises.length > 0 && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Most improved
              </h2>
              <Trophy className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-lg font-semibold text-zinc-100">
              {exercises.find((e) => e.id === topImprovement.id)?.name ?? "—"}
            </div>
            <div className="mt-1 text-sm text-zinc-300">
              <span
                className={
                  topImprovement.delta > 0 ? "text-emerald-400" : "text-rose-400"
                }
              >
                {formatPct(topImprovement.pct)}
              </span>{" "}
              on volume vs previous session
            </div>
          </section>
        )}

        {/* Last workout */}
        {lastWorkout && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Last workout
              </h2>
              <Link
                href="/history"
                className="text-xs text-emerald-400 hover:underline"
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
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
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

        {/* Empty state */}
        {workouts.length === 0 && (
          <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-zinc-500" />
            <div className="mt-3 text-base font-medium text-zinc-200">
              Log your first workout
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Tap the <span className="font-semibold text-emerald-400">+</span> button to
              start. We&apos;ll handle the analytics from there.
            </p>
            <Link
              href="/log"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950"
            >
              Start logging
            </Link>
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

// Inline line chart for weekly volume. Hand-rolled SVG instead of pulling
// recharts (~50KB) for a single tiny widget on the home page. The chart
// renders:
//   - 6 evenly-spaced x-axis points (one per week, oldest left)
//   - A polyline connecting them, scaled so the tallest bar fills the
//     available height with headroom for the value labels
//   - A numeric label above each point (e.g. "37.5t")
//   - Week labels under each tick
// We use viewBox + 100% width so the chart scales fluidly with the screen.
function WeeklyVolumeChart({ weekly }: { weekly: WeeklyVolume[] }) {
  // Padding inside the SVG so labels and the line don't get clipped.
  const W = 320;
  const H = 132;
  const PAD_LEFT = 28;
  const PAD_RIGHT = 16;
  const PAD_TOP = 18; // room for the numeric label above each point
  const PAD_BOTTOM = 22; // room for the week label under each tick
  const innerW = W - PAD_LEFT - PAD_RIGHT;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const maxV = Math.max(1, ...weekly.map((w) => w.volume));
  // Smallest visible volume gets ~6% of the chart height so a flat-but-real
  // week doesn't look identical to a zero week.
  const minVisiblePct = 0.06;

  const points = weekly.map((w, i) => {
    const x =
      weekly.length === 1
        ? PAD_LEFT + innerW / 2
        : PAD_LEFT + (i / (weekly.length - 1)) * innerW;
    const raw = w.volume / maxV;
    const pct = Math.max(minVisiblePct, raw);
    const y = PAD_TOP + (1 - pct) * innerH;
    return { x, y, w };
  });

  const polyline = points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const lastX = points[points.length - 1].x.toFixed(1);
  const firstX = points[0].x.toFixed(1);
  const baseY = (PAD_TOP + innerH).toFixed(1);
  const areaPath = `M ${polyline.split(" ").join(" L ")} L ${lastX},${baseY} L ${firstX},${baseY} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        className="overflow-visible"
      >
        {/* Subtle horizontal gridline at the max */}
        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT + innerW}
          y1={PAD_TOP}
          y2={PAD_TOP}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeDasharray="2 3"
        />
        {/* Filled area under the line for visual weight */}
        <path d={areaPath} className="fill-emerald-500/15" />
        {/* The line itself */}
        <polyline
          points={polyline}
          className="fill-none stroke-emerald-400"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Points + numeric labels */}
        {points.map((p) => (
          <g key={p.w.weekStart}>
            <circle
              cx={p.x}
              cy={p.y}
              r={3}
              className="fill-emerald-400 stroke-zinc-950"
              strokeWidth={1.5}
            />
            <text
              x={p.x}
              y={p.y - 6}
              textAnchor="middle"
              className="fill-zinc-300"
              fontSize={9}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatVolume(p.w.volume)}
            </text>
          </g>
        ))}
        {/* Week labels under each tick */}
        {points.map((p) => (
          <text
            key={`label-${p.w.weekStart}`}
            x={p.x}
            y={PAD_TOP + innerH + 14}
            textAnchor="middle"
            className="fill-zinc-500"
            fontSize={9}
          >
            {formatWeekLabel(p.w.weekStart)}
          </text>
        ))}
        {/* Y-axis max label in the top-left so the user has a scale anchor */}
        <text
          x={PAD_LEFT - 4}
          y={PAD_TOP + 3}
          textAnchor="end"
          className="fill-zinc-500"
          fontSize={9}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatVolume(maxV)}
        </text>
      </svg>
      <div className="mt-2 text-center text-xs text-zinc-500">
        Last 6 weeks
      </div>
    </div>
  );
}

/**
 * Display order for muscle groups in the "This week vs last" chips. Puts
 * the user's commonly-requested groups (chest / back / arms / core) first,
 * then the rest in a sensible order. Groups with zero sets in BOTH weeks
 * are filtered out at the call site.
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
 * Compact per-muscle-group set-count breakdown, shown inside both
 * "This week" and "vs Last week" cards on the home page.
 *
 * Color rule: each chip's color reflects the **delta vs the other week**
 * for that same muscle group — emerald if this week's count is higher,
 * rose if lower, zinc if equal or no prior data. So both cards render the
 * same chip colors (both cards' chips answer "is this week up vs last?").
 */
function MuscleGroupChips({
  thisWeek,
  lastWeek,
}: {
  thisWeek: Partial<Record<MuscleGroup, number>>;
  lastWeek: Partial<Record<MuscleGroup, number>>;
}) {
  // Build the merged list of groups (union of this week + last week),
  // filtered to those with > 0 sets in at least one of the two weeks,
  // then ordered by MUSCLE_DISPLAY_ORDER.
  const allGroups = new Set<MuscleGroup>([
    ...(Object.keys(thisWeek) as MuscleGroup[]),
    ...(Object.keys(lastWeek) as MuscleGroup[]),
  ]);
  const groups = MUSCLE_DISPLAY_ORDER.filter((g) => allGroups.has(g));

  if (groups.length === 0) {
    return (
      <div className="text-[10px] text-zinc-500">
        No sets logged yet
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] tabular-nums">
      {groups.map((g) => {
        const tw = thisWeek[g] ?? 0;
        const lw = lastWeek[g] ?? 0;
        // Color rule for "is this week up?": compare this week's count for
        // this group to last week's. Same rule for both cards' chips.
        let tone = "text-zinc-400";
        if (tw > 0 || lw > 0) {
          if (tw > lw) tone = "text-emerald-400";
          else if (tw < lw) tone = "text-rose-400";
          else tone = "text-zinc-400";
        }
        return (
          <span key={g} className="inline-flex items-center gap-1">
            <span className="text-zinc-500">{g}</span>
            <span className={tone}>{tw}</span>
          </span>
        );
      })}
    </div>
  );
}
