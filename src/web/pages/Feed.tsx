import { useCallback, useEffect, useState } from "react";
import { api, photoUrl, type FeedEntry, type Pending } from "../lib/api";
import { useRouter } from "../lib/router";
import {
  Button,
  Empty,
  RowSkeleton,
  ScoreBadge,
  Screen,
  Thumb,
  joinNames,
  timeAgo,
} from "../components/ui";

export function Feed() {
  const { navigate } = useRouter();
  const [entries, setEntries] = useState<FeedEntry[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    const [feedRes, pendingRes] = await Promise.all([api.feed(), api.pending()]);
    setEntries(feedRes.feed);
    setCursor(feedRes.nextCursor);
    setPending(pendingRes.pending);
  }, []);

  useEffect(() => {
    load().catch(() => setEntries([]));
  }, [load]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.feed(cursor);
      setEntries((prev) => [...(prev ?? []), ...res.feed]);
      setCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function dismiss(id: number) {
    setPending((prev) => prev.filter((p) => p.id !== id));
    await api.dismissPending(id).catch(() => {});
  }

  return (
    <Screen title="Nijiya" subtitle="What everyone's been trying">
      {pending.length > 0 && (
        <section className="space-y-2 px-4 pt-4">
          {pending.map((p) => (
            <PendingCard key={p.id} pending={p} onDismiss={() => dismiss(p.id)} />
          ))}
        </section>
      )}

      {entries === null ? (
        <div className="pt-2">
          <RowSkeleton count={4} />
        </div>
      ) : entries.length === 0 ? (
        <Empty
          emoji="🛒"
          title="Nothing rated yet"
          body="Tap + to add the first thing from Nijiya."
        />
      ) : (
        <div className="space-y-3 px-4 pt-4">
          {entries.map((entry) => (
            <FeedCard key={entry.id} entry={entry} onOpen={() => navigate(`/item/${entry.item_id}`)} />
          ))}
          {cursor && (
            <Button variant="ghost" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      )}
    </Screen>
  );
}

function PendingCard({ pending, onDismiss }: { pending: Pending; onDismiss: () => void }) {
  const { navigate } = useRouter();
  return (
    <div className="rounded-2xl border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[0.06] p-3">
      <div className="flex items-center gap-3">
        <Thumb photoKey={pending.photo_key} alt={pending.item_name} emoji={pending.section_emoji} />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            <span className="font-bold">{pending.tagged_by_name}</span> says you tried{" "}
            <span className="font-bold">{pending.item_name}</span> together.
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">What did you think?</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => navigate(`/rate/${pending.item_id}`)}
          className="min-h-[40px] flex-1 rounded-xl bg-[var(--color-brand)] px-3 font-semibold text-white active:bg-[var(--color-brand-dark)]"
        >
          Rate it
        </button>
        <button
          onClick={onDismiss}
          className="min-h-[40px] rounded-xl border border-[var(--color-line)] bg-[var(--color-card)] px-4 text-sm font-semibold text-[var(--color-muted)]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function FeedCard({ entry, onOpen }: { entry: FeedEntry; onOpen: () => void }) {
  const photo = entry.photos[0] ?? entry.photo_key;
  const companions = entry.companions.map((c) => c.name);

  return (
    <article
      onClick={onOpen}
      className="cursor-pointer overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] shadow-[0_1px_2px_rgba(33,28,23,0.04)] active:bg-[var(--color-line)]/30"
    >
      <div className="flex items-start gap-3 p-3.5">
        <Thumb photoKey={photo} alt={entry.item_name} emoji={entry.section_emoji} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[var(--color-muted)]">
            <span className="font-bold text-[var(--color-ink)]">{entry.user_name}</span> ·{" "}
            {timeAgo(entry.updated_at)}
          </p>
          <h2 className="truncate text-[15px] font-bold">{entry.item_name}</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
            {entry.section_emoji} {entry.section_name}
            {companions.length > 0 && <> · with {joinNames(companions)}</>}
          </p>
        </div>
        <ScoreBadge score={entry.score} />
      </div>

      {entry.notes && (
        <p className="px-3.5 pb-3.5 text-sm leading-relaxed text-[var(--color-ink)]/85">
          “{entry.notes}”
        </p>
      )}

      {entry.photos.length > 0 && (
        <img
          src={photoUrl(entry.photos[0]) ?? undefined}
          alt={entry.item_name}
          loading="lazy"
          className="max-h-72 w-full border-t border-[var(--color-line)] object-cover"
        />
      )}
    </article>
  );
}
