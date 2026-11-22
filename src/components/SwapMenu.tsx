"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Exercise } from "@/lib/types";
import { swapOptionsFor } from "@/lib/similar";

/**
 * Dropdown under an exercise's header listing exercises to swap it for:
 * the closest movement matches first, then the rest of the same muscle
 * group. Typing searches the whole library.
 */
export function SwapMenu({
  current,
  exercises,
  usedIds,
  usedLabel = "in workout",
  onPick,
  onClose,
}: {
  current: Exercise;
  exercises: Exercise[];
  usedIds: string[];
  /** Tag shown beside exercises already in the list being edited. */
  usedLabel?: string;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const opts = useMemo(() => swapOptionsFor(current, exercises), [current, exercises]);

  // Close on a tap outside the menu or on Escape.
  useEffect(() => {
    function onDown(e: PointerEvent) {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) {
        // Let the swap button's own click toggle the menu shut.
        if ((target as Element).closest?.("[aria-expanded='true']")) return;
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const match = (e: Exercise) => !q || e.name.toLowerCase().includes(q);
  const groupLabel = current.muscleGroup === "other" ? "Other exercises" : `Other ${current.muscleGroup}`;
  const groups: { label: string; items: Exercise[] }[] = [
    { label: opts.similarLabel, items: opts.similar.filter(match) },
    { label: groupLabel, items: opts.sameGroup.filter(match) },
    // The rest of the library only shows up when searching.
    { label: "Everything else", items: q ? opts.others.filter(match) : [] },
  ].filter((g) => g.items.length > 0);

  return (
    <div
      ref={ref}
      className="absolute left-2 right-2 top-14 z-20 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl shadow-black/60"
    >
      <label className="flex h-10 items-center gap-2 rounded-lg border border-zinc-700 px-3 focus-within:border-emerald-500">
        <Search className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          aria-label="Search exercises to swap in"
          className="w-full min-w-0 bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </label>
      <div className="mt-1 max-h-72 overflow-y-auto">
        {groups.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">
            {q
              ? `No exercises match "${query.trim()}".`
              : "No similar exercises yet. Add more on the Exercises page, or search for any exercise."}
          </p>
        )}
        {groups.map((g) => (
          <div key={g.label}>
            <div className="mx-1 mb-1 mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {g.label}
            </div>
            {g.items.map((e) => {
              const used = usedIds.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={used}
                  onClick={() => onPick(e)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left text-sm text-zinc-100 hover:bg-emerald-500/10 disabled:opacity-40"
                >
                  <span className="truncate">{e.name}</span>
                  {used && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-500">
                      {usedLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
