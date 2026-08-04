"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  LogOut,
  ChevronDown,
  Sparkles,
  KeyRound,
  X,
  Cloud,
  CloudOff,
  User as UserIcon,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Database,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { signInWithUsername, signUpWithUsername, signOut } from "@/lib/auth";
import {
  clearLocal,
  flushPending,
  getExercises,
  getPendingCount,
  getTemplates,
  getWorkouts,
  pullFromCloud,
} from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";

export function ProfileMenu() {
  const { status, email, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [open]);

  async function handleSignOut() {
    if (!confirm("Sign out? Your data stays safe in the cloud.")) return;
    await signOut();
    clearLocal();
    setOpen(false);
    window.location.reload();
  }

  const isSignedIn = status === "signed-in" && email;
  const initial = email ? email.charAt(0).toUpperCase() : "?";

  return (
    <>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 pl-1 pr-2 text-sm text-zinc-200"
          aria-label="Account menu"
        >
          <span
            className={
              isSignedIn
                ? "flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-400"
                : "flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-400"
            }
          >
            {isSignedIn ? initial : <CloudOff className="h-3.5 w-3.5" />}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </button>

        {open && (
          <div className="absolute right-0 top-11 z-30 w-64 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl">
            <div className="border-b border-zinc-800 px-4 py-3">
              {isSignedIn ? (
                <>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                    <Cloud className="h-3.5 w-3.5 text-emerald-400" />
                    Synced
                  </div>
                  <div className="mt-1 truncate text-sm text-zinc-200">
                    {email}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                    <CloudOff className="h-3.5 w-3.5 text-amber-400" />
                    Not synced
                  </div>
                  <div className="mt-1 text-sm text-zinc-300">
                    Local-only mode
                  </div>
                </>
              )}
            </div>

            {isSignedIn && (
              <button
                onClick={() => {
                  setOpen(false);
                  setDebugOpen(true);
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-900"
              >
                <Database className="h-4 w-4 text-zinc-400" />
                Sync & data
              </button>
            )}

            {!isSignedIn && isSupabaseConfigured() && (
              <button
                onClick={() => {
                  setOpen(false);
                  setAuthOpen(true);
                }}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-900"
              >
                <KeyRound className="h-4 w-4 text-emerald-400" />
                Sign in to sync
              </button>
            )}

            {isSignedIn && (
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 border-t border-zinc-800 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-900"
              >
                <LogOut className="h-4 w-4 text-rose-400" />
                Sign out
              </button>
            )}

            <Link
              href="/templates"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 border-t border-zinc-800 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-900"
            >
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Workout templates
            </Link>
          </div>
        )}
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
      {debugOpen && (
        <SyncDataDialog
          email={email}
          userId={session?.user?.id ?? null}
          onClose={() => setDebugOpen(false)}
        />
      )}
    </>
  );
}

function SyncDataDialog({
  email,
  userId,
  onClose,
}: {
  email: string | null;
  userId: string | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [counts, setCounts] = useState<{
    local: { ex: number; wk: number; tp: number };
    cloud: { ex: number; wk: number; tp: number } | null;
  } | null>(null);

  useEffect(() => {
    setPending(getPendingCount());
    setCounts({
      local: {
        ex: getExercises().length,
        wk: getWorkouts().length,
        tp: getTemplates().length,
      },
      cloud: null,
    });
  }, [result]);

  async function refresh() {
    setBusy(true);
    setResult(null);
    try {
      const r = await pullFromCloud();
      const p = getPendingCount();
      setPending(p);
      setCounts({
        local: {
          ex: getExercises().length,
          wk: getWorkouts().length,
          tp: getTemplates().length,
        },
        cloud: {
          ex: r.exercises.length,
          wk: r.workouts.length,
          tp: r.templates.length,
        },
      });
      setResult(
        p > 0
          ? `Pulled from cloud. ${p} operation${p === 1 ? "" : "s"} still queued for retry.`
          : `Pulled ${r.exercises.length} exercises, ${r.workouts.length} workouts, ${r.templates.length} templates from cloud.`
      );
      window.dispatchEvent(new CustomEvent("gym:data-changed"));
    } catch (e) {
      setResult(`Sync failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function retryPush() {
    setBusy(true);
    setResult(null);
    try {
      const { remaining, lastError } = await flushPending();
      setPending(remaining);
      setResult(
        remaining === 0
          ? "All pending writes pushed to cloud."
          : lastError
          ? `Still failing: ${lastError}`
          : `${remaining} operation${remaining === 1 ? "" : "s"} still failed. Check your network.`
      );
    } catch (e) {
      setResult(`Push failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-3xl border border-zinc-800 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header — always visible */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-3 rounded-t-3xl">
          <h2 className="text-base font-semibold text-zinc-100">Sync & data</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-sm text-zinc-400">
            Account: <span className="text-zinc-200">{email}</span>
          </p>
          <p className="mt-1 break-all text-xs text-zinc-500">
            User ID: {userId ?? "—"}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Local
              </div>
              <div className="mt-1 text-zinc-200">
                {getExercises().length} ex
              </div>
              <div className="text-zinc-400">
                {getWorkouts().length} wk · {getTemplates().length} tpl
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Cloud
              </div>
              {counts?.cloud ? (
                <>
                  <div className="mt-1 text-zinc-200">
                    {counts.cloud.ex} ex
                  </div>
                  <div className="text-zinc-400">
                    {counts.cloud.wk} wk · {counts.cloud.tp} tpl
                  </div>
                </>
              ) : (
                <div className="mt-1 text-xs text-zinc-500">
                  (tap Pull to fetch)
                </div>
              )}
            </div>
          </div>

          {pending > 0 && (
            <div className="mt-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
              ⚠ {pending} pending write{pending === 1 ? "" : "s"} not yet in
              cloud (network or RLS issue). Tap &quot;Retry push&quot; below.
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={refresh}
              disabled={busy}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Pull from cloud
            </button>
            {pending > 0 && (
              <button
                onClick={retryPush}
                disabled={busy}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 text-sm font-semibold text-amber-300 disabled:opacity-50"
              >
                Retry push
              </button>
            )}
          </div>

          {result && (
            <p className="mt-3 text-sm text-zinc-300">{result}</p>
          )}

          <div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
            <p>
              <span className="font-semibold text-zinc-400">How sync works:</span>{" "}
              every save goes to local first (instant) + queued for cloud push.
              Pull also re-tries the queue first so you don&apos;t lose pending
              writes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "magiclink">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    let result;
    if (mode === "signin") {
      result = await signInWithUsername(username, password);
    } else if (mode === "signup") {
      result = await signUpWithUsername(username, password);
    } else {
      // magic link
      const { signInWithEmail } = await import("@/lib/auth");
      result = await signInWithEmail(email);
    }
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (mode === "magiclink") {
      setMagicSent(true);
      return;
    }
    onClose();
    setTimeout(() => window.location.reload(), 200);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-3xl border border-zinc-800 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header — always visible */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-3 rounded-t-3xl">
          <h2 className="text-base font-semibold text-zinc-100">
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : magicSent
              ? "Check your email"
              : "Sign in with email"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          {magicSent ? (
            <div className="py-4 text-center">
              <p className="text-sm text-zinc-300">
                We sent a sign-in link to{" "}
                <span className="font-medium text-zinc-100">{email}</span>.
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Tap the link on this device. You can close this — you&apos;re
                already in the app.
              </p>
              <button
                onClick={onClose}
                className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-emerald-500 text-sm font-semibold text-zinc-950"
              >
                Got it
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex rounded-full border border-zinc-800 bg-zinc-900/60 p-1 text-sm">
                <button
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className={clsx(
                    "flex-1 rounded-full py-1.5 transition",
                    mode === "signin"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400"
                  )}
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className={clsx(
                    "flex-1 rounded-full py-1.5 transition",
                    mode === "signup"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400"
                  )}
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setMode("magiclink");
                    setError(null);
                  }}
                  className={clsx(
                    "flex-1 rounded-full py-1.5 transition",
                    mode === "magiclink"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400"
                  )}
                >
                  Email link
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === "magiclink" ? (
                  <label className="block">
                    <span className="text-xs uppercase tracking-wide text-zinc-400">
                      Email
                    </span>
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      disabled={loading}
                      className="mt-1 h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-zinc-400">
                        Username or email
                      </span>
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="dave or you@example.com"
                        disabled={loading}
                        className="mt-1 h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs uppercase tracking-wide text-zinc-400">
                        Password
                      </span>
                      <div className="relative mt-1">
                        <input
                          type={showPwd ? "text" : "password"}
                          inputMode="text"
                          autoComplete={
                            mode === "signin"
                              ? "current-password"
                              : "new-password"
                          }
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          disabled={loading}
                          className="h-11 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 pr-11 text-base text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800"
                          aria-label={showPwd ? "Hide password" : "Show password"}
                        >
                          {showPwd ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {mode === "signup" && (
                        <p className="mt-1 text-xs text-zinc-500">
                          At least 6 characters
                        </p>
                      )}
                    </label>
                  </>
                )}

                {error && <p className="text-sm text-rose-400">{error}</p>}

                <button
                  type="submit"
                  disabled={
                    loading ||
                    (mode === "magiclink"
                      ? !email.trim()
                      : !username.trim() || !password)
                  }
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-zinc-950 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === "signin"
                        ? "Signing in…"
                        : mode === "signup"
                        ? "Creating account…"
                        : "Sending link…"}
                    </>
                  ) : (
                    <>
                      <UserIcon className="h-4 w-4" />
                      {mode === "signin"
                        ? "Sign in"
                        : mode === "signup"
                        ? "Create account"
                        : "Send sign-in link"}
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Local helper
function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
