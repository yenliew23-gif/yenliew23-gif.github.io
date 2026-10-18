"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Clock,
  Cloud,
  Dumbbell,
  LayoutList,
  Smartphone,
  Trophy,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { markOnboarded } from "@/lib/storage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { AuthModal } from "@/components/ProfileMenu";

/**
 * Real quotes from people using the app. The "From the people using it"
 * section stays hidden until at least one is added, so the page never
 * shows placeholder or made-up reviews.
 */
const TESTIMONIALS: { quote: string; name: string; detail: string }[] = [];

const FEATURES = [
  {
    icon: Clock,
    title: "See last time, right where you log",
    body: "Your previous weight and reps sit next to every set, so you always know the number to beat.",
  },
  {
    icon: Trophy,
    title: "PRs called out automatically",
    body: "Heaviest lift, best estimated 1RM, biggest volume. You hit it, we flag it.",
    amber: true,
  },
  {
    icon: BarChart3,
    title: "Progress you can actually read",
    body: "Max weight, volume, est. 1RM and reps for any exercise, charted over time.",
  },
  {
    icon: Users,
    title: "This week vs last, by muscle",
    body: "See which muscle groups got more sets and which you skipped, at a glance.",
  },
  {
    icon: LayoutList,
    title: "Templates for your split",
    body: "Save Push day or Legs A once, then start it in one tap every time.",
  },
  {
    icon: Cloud,
    title: "Never lose a session",
    body: "Everything saves on your phone first and syncs when you're back online.",
  },
];

const FACTS = [
  { big: "$0", small: "Free to use, no trial clock" },
  { big: "No sign-up", small: "Open it and start logging" },
  { big: "Offline", small: "No signal in the basement gym? Fine." },
  { big: "Phone + laptop", small: "Optional cloud sync" },
];

const STEPS = [
  {
    title: "Open it on your phone",
    body: "No download, no account. Add it to your home screen and it behaves like an app.",
  },
  {
    title: "Pick a template or an exercise",
    body: "Start from a common lift or your own routine, then log weight × reps as you go.",
  },
  {
    title: "Watch the line go up",
    body: "Your dashboard shows this week vs last, your most improved lift and your latest PRs.",
  },
];

/** Leaves the first-visit screens for good and opens the workout logger. */
function useStartLogging() {
  const router = useRouter();
  return () => {
    markOnboarded();
    router.push("/log");
  };
}

function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={clsx(
        "flex items-center justify-center bg-emerald-500 text-zinc-950",
        size === "lg" ? "h-14 w-14 rounded-2xl" : "h-9 w-9 rounded-[10px]"
      )}
    >
      <Dumbbell
        className={size === "lg" ? "h-7 w-7" : "h-5 w-5"}
        strokeWidth={2.4}
        aria-hidden
      />
    </span>
  );
}

const eyebrow =
  "text-sm font-bold uppercase tracking-[0.15em] text-emerald-400";
const sectionTitle =
  "mt-3 font-display text-[clamp(40px,5vw,64px)] font-extrabold uppercase leading-none";

/** Marketing page shown to first-time visitors on larger screens, and always
 *  at /welcome so it can be shared. */
export function LandingPage() {
  const start = useStartLogging();

  return (
    <div className="min-h-dvh bg-zinc-950 text-[17px] leading-relaxed text-zinc-100">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <a href="#top" className="flex items-center gap-2.5 text-zinc-100">
          <Logo />
          <span className="font-display text-2xl font-extrabold uppercase tracking-wide">
            Gym Tracker
          </span>
        </a>
        <nav
          aria-label="Main"
          className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[15px] font-medium"
        >
          <a href="#features" className="text-zinc-400 hover:text-zinc-100">
            Features
          </a>
          <a href="#how" className="text-zinc-400 hover:text-zinc-100">
            How it works
          </a>
          {TESTIMONIALS.length > 0 && (
            <a href="#proof" className="text-zinc-400 hover:text-zinc-100">
              Reviews
            </a>
          )}
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-11 items-center rounded-full bg-emerald-500 px-5 font-bold text-zinc-950"
          >
            Open the app
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section
        id="top"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-14 px-6 pb-22 pt-14"
      >
        <div className="min-w-0 flex-[1_1_480px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-3.5 py-1.5 text-sm font-medium text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Free · No sign-up needed · Works offline
          </div>
          <h1 className="mt-6 font-display text-[clamp(52px,7.4vw,96px)] font-extrabold uppercase leading-[0.92]">
            Every rep counted.
            <br />
            <span className="text-emerald-400">Every PR noticed.</span>
          </h1>
          <p className="mt-6 max-w-xl text-xl text-zinc-300">
            The workout log that opens in a tap, works with no signal in the
            gym, and shows you exactly where you&apos;re getting stronger, week
            after week.
          </p>
          <div className="mt-9 flex flex-wrap gap-3.5">
            <button
              type="button"
              onClick={start}
              className="inline-flex min-h-14 items-center gap-2.5 rounded-full bg-emerald-500 px-7 text-lg font-bold text-zinc-950"
            >
              Start your first workout
              <ArrowRight className="h-5 w-5" strokeWidth={2.4} aria-hidden />
            </button>
            <a
              href="#install"
              className="inline-flex min-h-14 items-center gap-2.5 rounded-full border border-zinc-700 px-6 text-lg font-semibold text-zinc-100 hover:border-zinc-500"
            >
              <Smartphone className="h-5 w-5" aria-hidden />
              Add to home screen
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            Your data stays on your phone. Sign in later if you want it on
            your laptop too.
          </p>
        </div>

        <div className="relative flex min-w-0 flex-[1_1_340px] justify-center">
          <PhonePreview />
        </div>
      </section>

      {/* Facts that are true today */}
      <section
        aria-label="Why it's easy to start"
        className="border-y border-zinc-800 bg-zinc-900/50"
      >
        <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5 px-6 py-7">
          {FACTS.map((f) => (
            <div key={f.big}>
              <div className="font-display text-[26px] font-bold uppercase">
                {f.big}
              </div>
              <div className="text-[15px] text-zinc-400">{f.small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-10 pt-26">
        <div className={eyebrow}>Built for the gym floor</div>
        <h2 className={clsx(sectionTitle, "max-w-3xl")}>
          Less typing between sets. More knowing what to lift next.
        </h2>
        <div className="mt-14 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-3xl border border-zinc-800 bg-zinc-900 p-7"
              >
                <div
                  className={clsx(
                    "flex h-12 w-12 items-center justify-center rounded-2xl",
                    f.amber
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  )}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="mt-5 text-[22px] font-bold leading-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-zinc-400">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-24">
        <div className={eyebrow}>How it works</div>
        <h2 className={sectionTitle}>Three taps to your first set</h2>
        <ol className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-8">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className={clsx(
                "border-t-2 pt-5",
                i === 0 ? "border-emerald-500" : "border-zinc-700"
              )}
            >
              <div
                className={clsx(
                  "font-mono font-bold",
                  i === 0 ? "text-emerald-400" : "text-zinc-400"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-2 text-[22px] font-bold">{s.title}</h3>
              <p className="mt-2 text-zinc-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Social proof: only once there are real quotes */}
      {TESTIMONIALS.length > 0 && (
        <section
          id="proof"
          className="border-y border-zinc-800 bg-zinc-900/50"
        >
          <div className="mx-auto max-w-6xl px-6 py-24">
            <div className={eyebrow}>From the people using it</div>
            <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {TESTIMONIALS.map((t) => (
                <figure
                  key={t.name}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900 p-7"
                >
                  <blockquote className="text-[19px] text-zinc-200">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5">
                    <span className="block font-bold">{t.name}</span>
                    <span className="block text-sm text-zinc-500">
                      {t.detail}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-26">
        <div className="flex flex-wrap items-center justify-between gap-8 rounded-[32px] bg-emerald-500 p-[clamp(36px,6vw,72px)] text-zinc-950">
          <div className="min-w-0 flex-[1_1_420px]">
            <h2 className="font-display text-[clamp(40px,5.4vw,72px)] font-extrabold uppercase leading-[0.95]">
              Your next PR starts with one logged set.
            </h2>
            <p id="install" className="mt-4 max-w-xl text-lg font-medium">
              Open it in your phone&apos;s browser, tap Share (or the ⋮ menu),
              then &ldquo;Add to Home Screen&rdquo;. That&apos;s the whole
              install.
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            className="inline-flex min-h-15 items-center gap-2.5 rounded-full bg-zinc-950 px-8 text-[19px] font-bold text-zinc-100"
          >
            Start logging, free
            <ArrowRight className="h-5 w-5" strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      </section>

      <footer className="border-t border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-6 py-8 text-sm text-zinc-500">
          <span>© {new Date().getFullYear()} Gym Tracker</span>
          <span className="flex gap-6">
            <a href="#features" className="hover:text-zinc-300">
              Features
            </a>
            <a href="#how" className="hover:text-zinc-300">
              How it works
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}

/** Illustrative app screen for the hero. Static example numbers. */
function PhonePreview() {
  return (
    <>
      <div
        aria-hidden
        className="w-80 max-w-full rounded-[44px] border border-zinc-800 bg-zinc-900 p-3"
      >
        <div className="flex flex-col gap-3.5 rounded-[34px] bg-zinc-950 px-4.5 pb-4.5 pt-5.5">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs text-zinc-500">Saturday</div>
              <div className="font-display text-[26px] font-bold uppercase">
                Push day
              </div>
            </div>
            <div className="font-mono text-xs text-emerald-400">42:18</div>
          </div>
          <div className="rounded-[18px] border border-zinc-800 bg-zinc-900 p-3.5">
            <div className="flex justify-between text-[13px] text-zinc-400">
              <span>Bench press</span>
              <span>Last: 80 × 6</span>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5 font-mono text-sm">
              <div className="flex justify-between rounded-[10px] bg-zinc-800/70 px-2.5 py-2">
                <span className="text-zinc-500">1</span>
                <span>75 kg × 8</span>
                <span className="text-zinc-500">✓</span>
              </div>
              <div className="flex justify-between rounded-[10px] bg-zinc-800/70 px-2.5 py-2">
                <span className="text-zinc-500">2</span>
                <span>80 kg × 6</span>
                <span className="text-zinc-500">✓</span>
              </div>
              <div className="flex justify-between rounded-[10px] bg-emerald-500 px-2.5 py-2 font-bold text-zinc-950">
                <span>3</span>
                <span>82.5 kg × 6</span>
                <span>PR</span>
              </div>
            </div>
          </div>
          <div className="rounded-[18px] border border-zinc-800 bg-zinc-900 p-3.5">
            <div className="text-xs uppercase tracking-wider text-zinc-500">
              Est. 1RM · bench
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-[34px] font-bold">98.6 kg</span>
              <span className="text-[13px] font-semibold text-emerald-400">
                +4.1%
              </span>
            </div>
            <svg viewBox="0 0 260 60" width="100%" height="60">
              <path
                d="M0 50 L52 44 L104 46 L156 32 L208 26 L260 12"
                fill="none"
                className="stroke-emerald-400"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="260" cy="12" r="4" className="fill-emerald-400" />
            </svg>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="absolute bottom-12 left-0 flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-[15px] font-bold text-amber-950"
      >
        <Trophy className="h-4.5 w-4.5" strokeWidth={2.4} />
        New PR: Bench press
      </div>
    </>
  );
}

const WELCOME_POINTS = [
  {
    icon: Clock,
    title: "Last time, every set",
    body: "Always know the number to beat.",
  },
  {
    icon: Trophy,
    title: "PRs flagged for you",
    body: "Weight, volume and est. 1RM.",
    amber: true,
  },
  {
    icon: Cloud,
    title: "Saved on this phone",
    body: "Works offline. Sync later if you like.",
  },
];

/** First-open screen on phones (and the installed app). */
export function WelcomeScreen() {
  const start = useStartLogging();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-zinc-950 px-6 pb-[max(36px,env(safe-area-inset-bottom))] pt-16 text-zinc-100">
      <Logo size="lg" />
      <h1 className="mt-8 font-display text-[54px] font-extrabold uppercase leading-[0.92]">
        Let&apos;s get
        <br />
        <span className="text-emerald-400">stronger.</span>
      </h1>
      <p className="mt-4 text-lg leading-normal text-zinc-300">
        Log your sets in seconds. We&apos;ll track your PRs and show you
        what&apos;s improving.
      </p>

      <ul className="mt-9 flex flex-col gap-4.5">
        {WELCOME_POINTS.map((p) => {
          const Icon = p.icon;
          return (
            <li key={p.title} className="flex items-start gap-3.5">
              <span
                className={clsx(
                  "flex h-9 w-9 flex-none items-center justify-center rounded-[10px]",
                  p.amber
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-emerald-500/15 text-emerald-400"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span>
                <span className="block font-bold">{p.title}</span>
                <span className="block text-zinc-400">{p.body}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-3 pt-10">
        <button
          type="button"
          onClick={start}
          className="min-h-14 rounded-full bg-emerald-500 text-lg font-bold text-zinc-950"
        >
          Start my first workout
        </button>
        <button
          type="button"
          onClick={markOnboarded}
          className="min-h-13 rounded-full border border-zinc-700 text-base font-semibold text-zinc-100"
        >
          Look around first
        </button>
        {isSupabaseConfigured() && (
          <p className="mt-2 text-center text-[15px] text-zinc-400">
            Already use it on another device?{" "}
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="font-semibold text-emerald-400"
            >
              Sign in
            </button>
          </p>
        )}
      </div>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
