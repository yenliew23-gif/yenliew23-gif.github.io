"use client";

import { BottomNav } from "./BottomNav";
import { ProfileMenu } from "./ProfileMenu";

export function PageHeader({
  title,
  subtitle,
  right,
  showProfile = true,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  showProfile?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-zinc-50">{title}</h1>
          {subtitle && (
            <p className="truncate text-xs text-zinc-400">{subtitle}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          {showProfile && <ProfileMenu />}
        </div>
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-md pb-24">{children}</div>
      <BottomNav />
    </div>
  );
}
