import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useRouter } from "../lib/router";
import {
  BackHeader,
  Button,
  Empty,
  RowSkeleton,
  ScoreBadge,
  Screen,
  Thumb,
} from "../components/ui";
import { RankNumber } from "./Rankings";

type Loaded = Awaited<ReturnType<typeof api.userRatings>>;

export function Profile({ userId }: { userId?: number }) {
  const { user, setUser } = useAuth();
  const { navigate } = useRouter();
  const id = userId ?? user.id;
  const isMe = id === user.id;

  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    setData(null);
    api.userRatings(id).then(setData).catch(() => {});
  }, [id]);

  async function signOut() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  const ratings = data?.ratings ?? [];
  const bySection = ratings.reduce<Record<string, { emoji: string; count: number }>>(
    (acc, rating) => {
      const key = rating.section_name;
      acc[key] = { emoji: rating.section_emoji, count: (acc[key]?.count ?? 0) + 1 };
      return acc;
    },
    {},
  );

  const average =
    ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : null;

  const body = (
    <>
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4 text-center shadow-[0_1px_2px_rgba(33,28,23,0.04)]">
          <p className="text-[28px] leading-8 font-extrabold tabular-nums">{ratings.length}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">things rated</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4 text-center shadow-[0_1px_2px_rgba(33,28,23,0.04)]">
          <p className="text-[28px] leading-8 font-extrabold tabular-nums">
            {average === null ? "—" : average.toFixed(1)}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">average score</p>
        </div>
      </div>

      {Object.keys(bySection).length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {Object.entries(bySection).map(([name, { emoji, count }]) => (
            <span
              key={name}
              className="rounded-full border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]"
            >
              {emoji} {name} · {count}
            </span>
          ))}
        </div>
      )}

      <h2 className="px-4 pt-6 pb-2 text-[13px] font-semibold tracking-wide text-[var(--color-muted)]">
        {isMe ? "Your ranking" : `${data?.user.name ?? "Their"} ranking`}
      </h2>

      {data === null ? (
        <RowSkeleton count={4} />
      ) : ratings.length === 0 ? (
        <Empty
          emoji="🍡"
          title={isMe ? "You haven't rated anything yet" : "Nothing rated yet"}
          body={isMe ? "Tap + to start." : undefined}
        />
      ) : (
        <ol className="space-y-2 px-4">
          {ratings.map((rating, index) => (
            <li key={rating.rating_id}>
              <button
                onClick={() => navigate(`/item/${rating.item_id}`)}
                className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-3 text-left shadow-[0_1px_2px_rgba(33,28,23,0.04)] active:bg-[var(--color-line)]/30"
              >
                <RankNumber rank={index + 1} />
                <Thumb
                  photoKey={rating.photo_key}
                  alt={rating.item_name}
                  emoji={rating.section_emoji}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{rating.item_name}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {rating.section_emoji} {rating.section_name}
                    {rating.notes && ` · “${rating.notes}”`}
                  </p>
                </div>
                <ScoreBadge score={rating.score} />
              </button>
            </li>
          ))}
        </ol>
      )}

      {isMe && (
        <div className="px-4 pt-6">
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      )}
    </>
  );

  if (isMe) {
    return (
      <Screen title={user.name} subtitle="Your rankings">
        {body}
      </Screen>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] pb-28">
      <BackHeader title={data?.user.name ?? "Profile"} />
      {body}
    </div>
  );
}
