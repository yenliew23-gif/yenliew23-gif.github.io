"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, BarChart3, History, Dumbbell } from "lucide-react";
import clsx from "clsx";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: History },
  { href: "/log", label: "Log", icon: Plus, primary: true },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  return (
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
                  className="my-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-900/40"
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
  );
}
