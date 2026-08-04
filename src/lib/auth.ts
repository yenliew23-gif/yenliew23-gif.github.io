"use client";

import { getSupabase, resetSupabaseClient } from "./supabase";
import type { Session, User } from "@supabase/supabase-js";

const CFG_KEY = "gym.supabase.config.v1";

export interface StoredSupabaseConfig {
  url: string;
  anonKey: string;
}

export function loadStoredConfig(): StoredSupabaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CFG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSupabaseConfig;
    if (parsed.url && parsed.anonKey) return parsed;
  } catch {}
  return null;
}

export function saveStoredConfig(cfg: StoredSupabaseConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  // Expose to readSupabaseConfig() via window
  (window as unknown as { __SUPABASE_CONFIG__?: StoredSupabaseConfig }).__SUPABASE_CONFIG__ = cfg;
  resetSupabaseClient();
}

export function clearStoredConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CFG_KEY);
  delete (window as unknown as { __SUPABASE_CONFIG__?: StoredSupabaseConfig }).__SUPABASE_CONFIG__;
  resetSupabaseClient();
}

export async function getSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

export function getUser(): User | null {
  const sb = getSupabase();
  if (!sb) return null;
  // synchronous read of the cached user
  // (supabase-js keeps it in memory after getSession resolves)
  const sess = (sb.auth as unknown as { _cachedSession?: Session })._cachedSession;
  return sess?.user ?? null;
}

export async function signInWithEmail(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ----- Username + password auth -----
// Supabase's auth API requires a real-looking email. We turn a username
// like "dave" into "dave@gym.local" internally so the user never deals
// with real email addresses. The password is the actual password.

const EMAIL_DOMAIN = "gym.local";

function usernameToEmail(input: string): string {
  const trimmed = input.trim();
  // If it already looks like an email (contains @ and a dot), pass it through.
  // This lets users who manually created a Supabase user with their real
  // email sign in with the same email.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Otherwise treat it as a username and convert to a fake email.
  const cleaned = trimmed.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `${cleaned}@${EMAIL_DOMAIN}`;
}

export type UsernameAuthResult =
  | { ok: true; mode: "signin" | "signup" }
  | { ok: false; error: string };

export async function signInWithUsername(
  username: string,
  password: string
): Promise<UsernameAuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  if (!username.trim() || !password) {
    return { ok: false, error: "Username and password are required" };
  }
  const email = usernameToEmail(username);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true, mode: "signin" };
}

export async function signUpWithUsername(
  usernameOrEmail: string,
  password: string
): Promise<UsernameAuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: "Supabase not configured" };
  if (!usernameOrEmail.trim() || !password) {
    return { ok: false, error: "Username and password are required" };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  // Reject raw usernames that contain characters our fake email can't handle,
  // but allow anything that already looks like an email.
  const trimmed = usernameOrEmail.trim();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!isEmail && !/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return {
      ok: false,
      error:
        "Use letters, numbers, dots, dashes or underscores — or use a real email.",
    };
  }
  const email = usernameToEmail(trimmed);
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        typeof window !== "undefined" ? window.location.origin : undefined,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.session) {
    return {
      ok: false,
      error:
        "Account created, but sign-in didn't complete. Disable 'Confirm email' in Supabase Auth settings to skip email confirmation.",
    };
  }
  return { ok: true, mode: "signup" };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function onAuthChange(
  callback: (event: string, session: Session | null) => void
): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * Explicitly process a Supabase magic-link callback. Handles all three URL
 * formats Supabase has shipped over the years:
 *   1. ?token=...&type=magiclink         (legacy OTP)
 *   2. ?code=...                        (PKCE)
 *   3. #access_token=...&refresh_token  (legacy implicit)
 * Returns true if a token was found and processed.
 */
export async function processMagicLinkFromUrl(): Promise<{
  found: boolean;
  ok: boolean;
  detail?: string;
}> {
  if (typeof window === "undefined") return { found: false, ok: false };
  const sb = getSupabase();
  if (!sb) return { found: false, ok: false };

  const url = new URL(window.location.href);

  // Case 1: ?code=... (PKCE flow)
  const code = url.searchParams.get("code");
  if (code) {
    console.log("[auth] PKCE code found, exchanging for session");
    url.searchParams.delete("code");
    window.history.replaceState({}, "", url.toString());
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth] exchangeCodeForSession failed:", error);
      return { found: true, ok: false, detail: error.message };
    }
    return { found: true, ok: true };
  }

  // Case 2: ?token=...&type=magiclink (legacy OTP)
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type");
  if (token && type === "magiclink") {
    console.log("[auth] OTP token found, calling verifyOtp");
    url.searchParams.delete("token");
    url.searchParams.delete("type");
    url.searchParams.delete("expires_at");
    url.searchParams.delete("expires_in");
    url.searchParams.delete("refresh_token");
    window.history.replaceState({}, "", url.toString());
    const { error } = await sb.auth.verifyOtp({
      token_hash: token,
      type: "magiclink",
    });
    if (error) {
      console.error("[auth] verifyOtp failed:", error);
      return { found: true, ok: false, detail: error.message };
    }
    return { found: true, ok: true };
  }

  // Case 3: #access_token=...&refresh_token=... (legacy implicit)
  const fragment = window.location.hash.replace(/^#/, "");
  if (fragment) {
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken) {
      console.log("[auth] Implicit access_token found, calling setSession");
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
      const { error } = await sb.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? "",
      });
      if (error) {
        console.error("[auth] setSession failed:", error);
        return { found: true, ok: false, detail: error.message };
      }
      return { found: true, ok: true };
    }
  }

  return { found: false, ok: false };
}
