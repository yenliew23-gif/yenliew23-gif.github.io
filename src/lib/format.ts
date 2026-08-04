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
