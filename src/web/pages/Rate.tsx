import { useEffect, useState } from "react";
import { api, type ItemDetail } from "../lib/api";
import { useRouter } from "../lib/router";
import { CompanionPicker } from "../components/CompanionPicker";
import { PhotoPicker } from "../components/PhotoPicker";
import {
  BackHeader,
  Button,
  ErrorNote,
  Field,
  Thumb,
  formatScore,
  inputClass,
  scoreColor,
} from "../components/ui";

const today = () => new Date().toISOString().slice(0, 10);

export function Rate({ itemId }: { itemId: number }) {
  const { navigate } = useRouter();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [score, setScore] = useState(7.5);
  const [notes, setNotes] = useState("");
  const [triedOn, setTriedOn] = useState(today());
  const [companionIds, setCompanionIds] = useState<number[]>([]);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .item(itemId)
      .then((res) => {
        setDetail(res);
        if (res.myRating) {
          setScore(res.myRating.score);
          setNotes(res.myRating.notes ?? "");
          setTriedOn(res.myRating.tried_on ?? today());
          setCompanionIds(res.myRating.companions.map((c) => c.id));
          setPhotoKey(res.myRating.photos[0] ?? null);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load that item"));
  }, [itemId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.saveRating(itemId, {
        score,
        notes,
        triedOn,
        companionIds,
        photoKeys: photoKey ? [photoKey] : [],
      });
      navigate(`/item/${itemId}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your rating");
      setBusy(false);
    }
  }

  const existing = !!detail?.myRating;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] pb-28">
      <BackHeader title={existing ? "Update your rating" : "Rate it"} />

      <form onSubmit={submit} className="space-y-5 px-4 pt-4">
        {detail && (
          <div className="flex items-center gap-3">
            <Thumb
              photoKey={detail.item.photo_key}
              alt={detail.item.name}
              emoji={detail.item.section_emoji}
              className="h-16 w-16"
            />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{detail.item.name}</h2>
              <p className="text-sm text-[var(--color-muted)]">
                {detail.item.section_emoji} {detail.item.section_name}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-muted)]">Your score</span>
            <span
              className={`flex h-16 w-20 items-center justify-center rounded-2xl text-3xl font-bold tabular-nums text-white ${scoreColor(score)}`}
            >
              {formatScore(score)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--color-brand)]"
            aria-label="Score"
          />

          <div className="mt-1 flex justify-between text-xs text-[var(--color-muted)]">
            <span>0 · never again</span>
            <span>10 · buy every time</span>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setScore((s) => Math.max(0, Math.round((s - 0.1) * 10) / 10))}
              className="min-h-[44px] flex-1 rounded-xl border border-[var(--color-line)] text-lg"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => setScore((s) => Math.min(10, Math.round((s + 0.1) * 10) / 10))}
              className="min-h-[44px] flex-1 rounded-xl border border-[var(--color-line)] text-lg"
            >
              +
            </button>
          </div>
        </div>

        <Field label="Notes">
          <textarea
            className={`${inputClass} min-h-[88px] resize-y`}
            placeholder="Tastes like…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <CompanionPicker value={companionIds} onChange={setCompanionIds} />

        <PhotoPicker photoKey={photoKey} onChange={setPhotoKey} label="Add a photo (optional)" />

        <Field label="When did you try it?">
          <input
            className={inputClass}
            type="date"
            value={triedOn}
            max={today()}
            onChange={(e) => setTriedOn(e.target.value)}
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <Button disabled={busy || !detail}>
          {!detail ? "Loading…" : busy ? "Saving…" : existing ? "Update rating" : "Save rating"}
        </Button>

        {existing && (
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.deleteRating(itemId);
                navigate(`/item/${itemId}`, { replace: true });
              } catch {
                setBusy(false);
              }
            }}
          >
            Delete my rating
          </Button>
        )}
      </form>
    </div>
  );
}
