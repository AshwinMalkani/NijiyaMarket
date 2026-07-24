import type { ReactNode } from "react";
import { photoUrl } from "../lib/api";
import { useRouter } from "../lib/router";

/* ---------- score ---------- */

export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-stone-300";
  if (score >= 8) return "bg-[var(--color-good)]";
  if (score >= 5) return "bg-[var(--color-mid)]";
  return "bg-[var(--color-bad)]";
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
    sm: "h-8 min-w-8 px-1 text-[13px] rounded-[10px]",
    md: "h-11 min-w-11 px-1 text-base rounded-xl",
    lg: "h-16 min-w-16 px-1.5 text-2xl rounded-2xl",
  }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center font-bold tabular-nums text-white shadow-sm ${dims} ${scoreColor(score)}`}
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
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-line)] bg-white ${className}`}
    >
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <span className="text-xl opacity-40">{emoji}</span>
      )}
    </div>
  );
}

/* ---------- layout ---------- */

export function Card({ className = "", children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[0_1px_2px_rgba(33,28,23,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

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
        <header className="sticky top-0 z-10 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[26px] leading-8 font-extrabold tracking-tight">
                {title}
                <span className="text-[var(--color-brand)]">.</span>
              </h1>
              {subtitle && (
                <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">{subtitle}</p>
              )}
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
    <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 backdrop-blur-md">
      <button
        onClick={back}
        aria-label="Back"
        className="flex h-11 w-11 items-center justify-center rounded-full active:bg-[var(--color-line)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M15 5l-7 7 7 7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</h1>
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
      <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-muted)]">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-3 outline-none placeholder:text-stone-400 focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand)]/15";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary:
      "bg-[var(--color-brand)] text-white shadow-[0_2px_10px_rgba(192,57,43,0.25)] active:bg-[var(--color-brand-dark)] disabled:opacity-50 disabled:shadow-none",
    ghost:
      "bg-[var(--color-card)] border border-[var(--color-line)] active:bg-[var(--color-line)]/50",
    danger: "bg-[var(--color-card)] border border-rose-200 text-rose-600 active:bg-rose-50",
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

/** Round selectable chip used for sections, companions, and filters. */
export function Chip({
  selected,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-[40px] shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors ${
        selected
          ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
          : "border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)]"
      } ${className}`}
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
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] text-3xl">
        {emoji}
      </div>
      <p className="mt-4 font-bold">{title}</p>
      {body && <p className="mt-1 text-sm text-[var(--color-muted)]">{body}</p>}
    </div>
  );
}

export function RowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 px-4 pt-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-3"
        >
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
