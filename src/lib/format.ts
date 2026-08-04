// Small formatting helpers shared across the UI

export function formatVolume(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(1)}t`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)}t`;
  return `${Math.round(v)}kg`;
}

export function formatWeight(w: number): string {
  if (w === 0) return "BW";
  return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}kg`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatRelativeDay(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return formatDate(iso);
}

export function formatWeekLabel(weekStartISO: string): string {
  const d = new Date(weekStartISO + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatPct(pct: number, withSign = true): string {
  if (!isFinite(pct)) return "—";
  const sign = withSign && pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function pluralize(n: number, singular: string, plural?: string) {
  return `${n} ${n === 1 ? singular : plural ?? singular + "s"}`;
}

/** Format a duration in seconds as `1:30` or `1:05:30` for ≥1 hour. */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format a distance in meters, choosing km or m sensibly. */
export function formatDistance(meters: number): string {
  if (!isFinite(meters) || meters < 0) return "0m";
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2).replace(/\.?0+$/, "")}km`;
  }
  return `${Math.round(meters)}m`;
}

/** Render a single set on one line, picking the right format for its type. */
export function formatSetSummary(s: {
  type?: string;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
}): string {
  const t = s.type ?? "weight-reps";
  const w = s.weight ?? 0;
  switch (t) {
    case "reps":
      return `${s.reps ?? 0} reps`;
    case "weight-time":
      return `${formatWeight(w)} × ${formatDuration(s.duration ?? 0)}`;
    case "time":
      return formatDuration(s.duration ?? 0);
    case "distance-time":
      return `${formatDistance(s.distance ?? 0)} · ${formatDuration(s.duration ?? 0)}`;
    case "weight-distance":
      return `${formatWeight(w)} × ${formatDistance(s.distance ?? 0)}`;
    case "weight-reps":
    default:
      return `${formatWeight(w)} × ${s.reps ?? 0}`;
  }
}

export const SET_TYPE_LABELS: Record<string, string> = {
  "weight-reps": "Weight × Reps",
  reps: "Reps only",
  "weight-time": "Weight × Time",
  time: "Time only",
  "distance-time": "Distance + Time",
  "weight-distance": "Weight × Distance",
};

export const SET_TYPE_SHORT: Record<string, string> = {
  "weight-reps": "kg × reps",
  reps: "reps",
  "weight-time": "kg × time",
  time: "time",
  "distance-time": "dist + time",
  "weight-distance": "kg × dist",
};
