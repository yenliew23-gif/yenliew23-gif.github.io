"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _initialized = false;

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * Read Supabase config from (in order):
 *   1. window.__SUPABASE_CONFIG__ (set by the user in the in-app config screen)
 *   2. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (build-time env)
 */
export function readSupabaseConfig(): SupabaseConfig | null {
  if (typeof window !== "undefined") {
    const w = window as unknown as { __SUPABASE_CONFIG__?: SupabaseConfig };
    if (w.__SUPABASE_CONFIG__?.url && w.__SUPABASE_CONFIG__?.anonKey) {
      return w.__SUPABASE_CONFIG__;
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) return { url, anonKey: key };
  return null;
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseConfig() !== null;
}

export function getSupabase(): SupabaseClient | null {
  if (_initialized) return _client;
  _initialized = true;
  const cfg = readSupabaseConfig();
  if (!cfg) return null;
  _client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // We process the magic-link URL ourselves (processMagicLinkFromUrl)
      // to avoid a race with the auto-detect. Leaving this on causes the
      // session to be set in the wrong order on some browsers.
      detectSessionInUrl: false,
      // Use localStorage so the session survives reloads + works on the PWA's origin
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey: "gym.supabase.auth",
    },
  });
  return _client;
}

/** Forget the cached client (used after the user pastes a new config). */
export function resetSupabaseClient() {
  _client = null;
  _initialized = false;
}
