import { useEffect, useState } from "react";
import { api, photoUrl, type ItemDetail, type Section } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useRouter } from "../lib/router";
import {
  BackHeader,
  Button,
  Chip,
  Lightbox,
  RowSkeleton,
  ScoreBadge,
  ZoomablePhoto,
  joinNames,
  timeAgo,
} from "../components/ui";

/** Share via the native sheet where it exists (iOS/Android), else copy the link. */
function ShareButton({ itemName }: { itemName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${itemName} — Nijiya Rankings`, url });
        return;
      } catch (err) {
        // AbortError = the user closed the sheet; anything else means share
        // isn't actually usable here, so fall through to copying instead.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; nothing sensible to do */
    }
  }

  return (
    <button
      onClick={share}
      aria-label="Share this item"
      className="flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-[var(--color-muted)] active:bg-[var(--color-line)]"
    >
      {copied ? (
        "Copied!"
      ) : (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v12M12 3L8 7m4-4l4 4M5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/** The section line, tappable to move the item to a different category. */
function SectionEditor({
  item,
  onChanged,
}: {
  item: ItemDetail["item"];
  onChanged: (section: Section) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing && sections.length === 0) {
      api.sections().then((r) => setSections(r.sections)).catch(() => {});
    }
  }, [editing, sections.length]);

  async function pick(section: Section) {
    if (section.id !== item.section_id) {
      setBusy(true);
      try {
        await api.updateItemSection(item.id, section.id);
        onChanged(section);
      } catch {
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] active:opacity-60"
      >
        {item.section_emoji} {item.section_name}
        {item.price_cents !== null && <> · ${(item.price_cents / 100).toFixed(2)}</>}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-label="Edit section">
          <path
            d="M4 20h4L18.5 9.5a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L4 16v4z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <Chip
            key={s.id}
            selected={s.id === item.section_id}
            disabled={busy}
            onClick={() => pick(s)}
            className="min-h-[34px] px-3 text-[13px]"
          >
            {s.emoji} {s.name}
          </Chip>
        ))}
      </div>
      <button
        onClick={() => setEditing(false)}
        className="mt-1.5 text-xs text-[var(--color-muted)] underline"
      >
        Cancel
      </button>
    </div>
  );
}

export function Item({ itemId }: { itemId: number }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

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
      <BackHeader title={item.name} action={<ShareButton itemName={item.name} />} />

      <div className="px-4 pt-4">
        {hero && item.photo_key && (
          <button
            type="button"
            onClick={() => setZoom(hero)}
            className="block w-full"
            aria-label="View photo"
          >
            <img
              src={hero}
              alt={item.name}
              className="max-h-72 w-full rounded-2xl border border-[var(--color-line)] object-cover"
            />
          </button>
        )}

        <div className={`flex items-start gap-3 ${hero ? "mt-4" : ""}`}>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] leading-7 font-extrabold tracking-tight">{item.name}</h1>
            <SectionEditor
              item={item}
              onChanged={(section) =>
                setDetail((prev) =>
                  prev
                    ? {
                        ...prev,
                        item: {
                          ...prev.item,
                          section_id: section.id,
                          section_slug: section.slug,
                          section_name: section.name,
                          section_emoji: section.emoji,
                        },
                      }
                    : prev,
                )
              }
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {item.rating_count === 0
                ? "Nobody's rated this yet"
                : `${item.rating_count} rating${item.rating_count === 1 ? "" : "s"} · added by ${item.created_by_name}`}
            </p>
          </div>
          <div className="text-center">
            <ScoreBadge score={item.avg_score} size="lg" />
            <p className="mt-1 text-[11px] font-semibold text-[var(--color-muted)]">average</p>
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={() => navigate(`/rate/${item.id}`)}>
            {myRating ? `Update your ${myRating.score.toFixed(1)}` : "Rate it"}
          </Button>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="px-4 pb-2 text-[13px] font-semibold tracking-wide text-[var(--color-muted)]">
          What everyone said
        </h2>

        {ratings.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            Be the first to rate it.
          </p>
        ) : (
          <ul className="space-y-2 px-4">
            {ratings.map((rating) => (
              <li
                key={rating.id}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] px-3.5 py-3 shadow-[0_1px_2px_rgba(33,28,23,0.04)]"
              >
                <div className="flex items-start gap-3">
                  <ScoreBadge score={rating.score} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <button
                        onClick={() => navigate(`/user/${rating.user_id}`)}
                        className="font-bold underline-offset-2 hover:underline"
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
                    {rating.notes && (
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-ink)]/85">
                        “{rating.notes}”
                      </p>
                    )}
                    {rating.photos.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {rating.photos.map((key) => (
                          <ZoomablePhoto
                            key={key}
                            photoKey={key}
                            alt={`Photo of ${item.name}`}
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

      {zoom && <Lightbox src={zoom} alt={item.name} onClose={() => setZoom(null)} />}
    </div>
  );
}
