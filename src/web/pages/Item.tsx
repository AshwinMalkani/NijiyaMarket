import { useEffect, useState } from "react";
import { api, photoUrl, type ItemDetail } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useRouter } from "../lib/router";
import {
  BackHeader,
  Button,
  RowSkeleton,
  ScoreBadge,
  Thumb,
  joinNames,
  timeAgo,
} from "../components/ui";

export function Item({ itemId }: { itemId: number }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api
      .item(itemId)
      .then(setDetail)
      .catch(() => setMissing(true));
  }, [itemId]);

  if (missing) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-[520px]">
        <BackHeader title="Not found" />
        <p className="px-4 py-12 text-center text-[var(--color-muted)]">
          That item doesn't exist any more.
        </p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-[520px]">
        <BackHeader title="Loading…" />
        <RowSkeleton count={3} />
      </div>
    );
  }

  const { item, ratings, myRating } = detail;
  const hero = photoUrl(item.photo_key);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] pb-28">
      <BackHeader title={item.name} />

      {hero && <img src={hero} alt={item.name} className="max-h-72 w-full object-cover" />}

      <div className="px-4 pt-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">{item.name}</h1>
            <p className="mt-0.5 text-sm text-[var(--color-muted)]">
              {item.section_emoji} {item.section_name}
              {item.price_cents !== null && <> · ${(item.price_cents / 100).toFixed(2)}</>}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {item.rating_count === 0
                ? "Nobody's rated this yet"
                : `${item.rating_count} rating${item.rating_count === 1 ? "" : "s"} · added by ${item.created_by_name}`}
            </p>
          </div>
          <div className="text-center">
            <ScoreBadge score={item.avg_score} size="lg" />
            <p className="mt-1 text-[11px] text-[var(--color-muted)]">average</p>
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={() => navigate(`/rate/${item.id}`)}>
            {myRating ? `Update your ${myRating.score.toFixed(1)}` : "Rate it"}
          </Button>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="px-4 pb-2 text-sm font-semibold text-[var(--color-muted)]">
          What everyone said
        </h2>

        {ratings.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            Be the first to rate it.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)] bg-white">
            {ratings.map((rating) => (
              <li key={rating.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <ScoreBadge score={rating.score} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <button
                        onClick={() => navigate(`/user/${rating.user_id}`)}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {rating.user_id === user.id ? "You" : rating.user_name}
                      </button>
                      <span className="text-[var(--color-muted)]">
                        {" "}
                        · {timeAgo(rating.updated_at)}
                      </span>
                    </p>
                    {rating.companions.length > 0 && (
                      <p className="text-xs text-[var(--color-muted)]">
                        with {joinNames(rating.companions.map((c) => c.name))}
                      </p>
                    )}
                    {rating.notes && <p className="mt-1 text-sm">“{rating.notes}”</p>}
                    {rating.photos.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {rating.photos.map((key) => (
                          <Thumb
                            key={key}
                            photoKey={key}
                            alt=""
                            className="h-20 w-20"
                            emoji={item.section_emoji}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
