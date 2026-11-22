"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Plus, BarChart3, History, Dumbbell } from "lucide-react";
import clsx from "clsx";
import { SAVE_REQUEST_EVENT, filledSetCount, hasUnsavedSets, useDraft } from "@/lib/draft";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/log", label: "Log", icon: Plus, primary: true },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const draft = useDraft();
  // Where the user was heading when we stopped them to ask about saving.
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const onLogPage = pathname.startsWith("/log");

  // Leaving the Log page with sets entered but not saved: ask first.
  function onTabClick(e: React.MouseEvent, href: string) {
    if (!onLogPage || href === "/log" || !hasUnsavedSets(draft)) return;
    e.preventDefault();
    setLeavingTo(href);
  }

  return (
    <>
    {leavingTo && draft && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
        onClick={() => setLeavingTo(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-sheet-title"
          className="w-full max-w-md rounded-t-3xl border-t border-zinc-800 bg-zinc-950 px-4 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="save-sheet-title" className="text-xl font-bold">
            Save your workout?
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            {draft.name.trim() || "This workout"} has{" "}
            {filledSetCount(draft.blocks) === 1
              ? "1 set that isn't"
              : `${filledSetCount(draft.blocks)} sets that aren't`}{" "}
            saved yet.
          </p>
          <button
            type="button"
            onClick={() => {
              const goTo = leavingTo;
              setLeavingTo(null);
              window.dispatchEvent(
                new CustomEvent(SAVE_REQUEST_EVENT, { detail: { goTo } })
              );
            }}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-500 font-semibold text-zinc-950 active:scale-[0.99]"
          >
            Save workout
          </button>
          <button
            type="button"
            onClick={() => {
              const goTo = leavingTo;
              setLeavingTo(null);
              router.push(goTo);
            }}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl border border-zinc-700 text-zinc-300 active:scale-[0.99]"
          >
            Keep for later
          </button>
        </div>
      </div>
    )}
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          const Icon = t.icon;
          if (t.primary) {
            return (
              <li key={t.href} className="flex-1 flex justify-center">
                <Link
                  href={t.href}
                  onClick={(e) => onTabClick(e, t.href)}
                  className="my-2 flex h-13 w-13 items-center justify-center rounded-[18px] bg-emerald-500 text-zinc-950"
                  aria-label={t.label}
                >
                  <Icon className="h-6 w-6" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                onClick={(e) => onTabClick(e, t.href)}
                className={clsx(
                  "flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-emerald-400" : "text-zinc-400"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}
