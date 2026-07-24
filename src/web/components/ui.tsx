import type { ReactNode } from "react";
import { photoUrl } from "../lib/api";
import { useRouter } from "../lib/router";

/* ---------- score ---------- */

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-stone-300";
  if (score >= 8) return "bg-emerald-600";
  if (score >= 5) return "bg-amber-500";
  return "bg-rose-500";
}

export function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? "—" : score.toFixed(1);
}

export function ScoreBadge({
  score,
  size = "md",
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const dims = {
    sm: "h-8 w-8 text-[13px]",
    md: "h-11 w-11 text-base",
    lg: "h-16 w-16 text-2xl",
  }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-bold tabular-nums text-white ${dims} ${scoreColor(score)}`}
    >
      {formatScore(score)}
    </span>
  );
}

/* ---------- photos ---------- */

export function Thumb({
  photoKey,
  alt,
  className = "h-14 w-14",
  emoji = "🛒",
}: {
  photoKey: string | null | undefined;
  alt: string;
  className?: string;
  emoji?: string;
}) {
  const src = photoUrl(photoKey);
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-200 ${className}`}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xl opacity-50">{emoji}</span>
      )}
    </div>
  );
}

/* ---------- layout ---------- */

export function Screen({
  title,
  subtitle,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] pb-28">
      {title && (
        <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-[var(--color-muted)]">{subtitle}</p>}
            </div>
            {action}
          </div>
        </header>
      )}
      {children}
    </div>
  );
}

export function BackHeader({ title, action }: { title: string; action?: ReactNode }) {
  const { back } = useRouter();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur">
      <button
        onClick={back}
        aria-label="Back"
        className="flex h-11 w-11 items-center justify-center rounded-full text-xl active:bg-stone-200"
      >
        ‹
      </button>
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      {action}
    </header>
  );
}

/* ---------- form primitives ---------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-muted)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-muted)]">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-3 outline-none placeholder:text-stone-400 focus:border-[var(--color-brand)]";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary:
      "bg-[var(--color-brand)] text-white active:bg-[var(--color-brand-dark)] disabled:opacity-50",
    ghost: "bg-white border border-[var(--color-line)] active:bg-stone-100",
    danger: "bg-white border border-rose-200 text-rose-600 active:bg-rose-50",
  }[variant];
  return (
    <button
      {...props}
      className={`min-h-[48px] w-full rounded-xl px-4 py-3 font-semibold ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700" role="alert">
      {children}
    </p>
  );
}

export function Empty({ emoji, title, body }: { emoji: string; title: string; body?: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="text-4xl">{emoji}</div>
      <p className="mt-3 font-semibold">{title}</p>
      {body && <p className="mt-1 text-sm text-[var(--color-muted)]">{body}</p>}
    </div>
  );
}

export function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--color-line)]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="skeleton h-14 w-14 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/3 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
          <div className="skeleton h-11 w-11 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

/* ---------- misc ---------- */

export function timeAgo(iso: string): string {
  // SQLite datetime() has no zone marker; it is UTC.
  const ts = iso.includes("T") ? iso : `${iso.replace(" ", "T")}Z`;
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
