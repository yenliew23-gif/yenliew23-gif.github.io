"use client";

import { useEffect, useState } from "react";
import { Loader2, Settings, X, CloudOff } from "lucide-react";
import { useAuth, useCloudSync, seedIfEmpty } from "@/lib/hooks";
import { readSupabaseConfig } from "@/lib/supabase";
import { loadStoredConfig, saveStoredConfig, clearStoredConfig } from "@/lib/auth";

/**
 * Wraps the whole app. Always renders the app — sign-in is optional and
 * happens via the profile menu, not as a gate.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  // Cloud sync only runs when signed in.
  useCloudSync(status);
  // Seed sample data only in fully-local mode.
  useEffect(() => {
    if (status === "no-cloud") seedIfEmpty();
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zinc-950 text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {status === "needs-signin" && <NotSyncedBanner />}
      {status === "no-cloud" && <NoCloudBanner />}
      {children}
    </>
  );
}

function NotSyncedBanner() {
  return (
    <div className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
      <CloudOff className="mr-1 inline h-3 w-3" />
      <span>Local-only. </span>
      <span>Open the profile menu to sign in and sync.</span>
    </div>
  );
}

function NoCloudBanner() {
  return (
    <div className="bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300">
      <CloudOff className="mr-1 inline h-3 w-3" />
      <span>Cloud sync not configured. </span>
      <span>Open the profile menu to set up Supabase.</span>
    </div>
  );
}

// Old unused helpers — kept exported so older imports still compile if any.
export const ConfigDialog = NoCloudBanner;

