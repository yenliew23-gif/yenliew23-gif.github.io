import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-zinc-950 p-6 text-center text-zinc-100">
      <div className="text-5xl font-bold text-emerald-400">404</div>
      <p className="text-sm text-zinc-400">That page doesn&apos;t exist.</p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-zinc-950"
      >
        Back home
      </Link>
    </div>
  );
}
