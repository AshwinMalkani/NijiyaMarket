import { useEffect, useState } from "react";
import { api, type ItemSummary, type Section } from "../lib/api";
import { useRouter } from "../lib/router";
import { Scanner } from "../components/Scanner";
import { PhotoPicker } from "../components/PhotoPicker";
import {
  BackHeader,
  Button,
  Chip,
  ErrorNote,
  Field,
  ScoreBadge,
  Thumb,
  inputClass,
} from "../components/ui";

export function Add() {
  const { navigate } = useRouter();
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ItemSummary[]>([]);
  const [creating, setCreating] = useState(false);
  const [scanNote, setScanNote] = useState("");
  const [barcode, setBarcode] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ name: string; photoUrl: string | null } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setMatches([]);
      return;
    }
    const timer = setTimeout(() => {
      api
        .items({ q })
        .then((r) => setMatches(r.items.slice(0, 8)))
        .catch(() => {});
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleScan(code: string) {
    setScanning(false);
    setLookingUp(true);
    setError("");
    try {
      const res = await api.barcode(code);
      if (res.item) {
        // Somebody already added this exact product — go rate that one.
        navigate(`/rate/${res.item.id}`);
        return;
      }
      setBarcode(res.barcode);
      if (res.suggestion) {
        setPrefill({ name: res.suggestion.name, photoUrl: res.suggestion.imageUrl });
        setScanNote(`Found "${res.suggestion.name}" via ${res.suggestion.source}. Fix anything that's off.`);
      } else {
        setPrefill({ name: "", photoUrl: null });
        setScanNote("No match in the product database — type the name in and it'll be saved to this barcode.");
      }
      setCreating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Barcode lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  if (scanning) {
    return <Scanner onDetected={handleScan} onClose={() => setScanning(false)} />;
  }

  if (creating) {
    return (
      <NewItemForm
        barcode={barcode}
        note={scanNote}
        initialName={prefill?.name ?? query.trim()}
        initialPhotoUrl={prefill?.photoUrl ?? null}
        onCancel={() => {
          setCreating(false);
          setPrefill(null);
          setBarcode(null);
          setScanNote("");
        }}
      />
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] pb-28">
      <BackHeader title="Add something" />

      <div className="space-y-4 px-4 pt-4">
        <button
          onClick={() => setScanning(true)}
          disabled={lookingUp}
          className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-2xl bg-[var(--color-brand)] text-lg font-bold text-white shadow-[0_4px_14px_rgba(192,57,43,0.3)] active:bg-[var(--color-brand-dark)] disabled:opacity-60 disabled:shadow-none"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 8V5.5A1.5 1.5 0 0 1 4.5 4H8M16 4h3.5A1.5 1.5 0 0 1 21 5.5V8M21 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H4.5A1.5 1.5 0 0 1 3 18.5V16M7 9v6M10.5 9v6M13.5 9v6M17 9v6"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          {lookingUp ? "Looking it up…" : "Scan the barcode"}
        </button>

        <ErrorNote>{error}</ErrorNote>

        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          or find it
          <span className="h-px flex-1 bg-[var(--color-line)]" />
        </div>

        <input
          className={inputClass}
          type="search"
          placeholder="Search what we've already added…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {matches.length > 0 && (
          <ul className="divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
            {matches.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => navigate(`/rate/${item.id}`)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-stone-50"
                >
                  <Thumb
                    photoKey={item.photo_key}
                    alt={item.name}
                    emoji={item.section_emoji}
                    className="h-11 w-11"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {item.section_emoji} {item.section_name}
                    </p>
                  </div>
                  <ScoreBadge score={item.avg_score} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="ghost"
          onClick={() => {
            setPrefill(null);
            setBarcode(null);
            setScanNote("");
            setCreating(true);
          }}
        >
          + Add it by hand
        </Button>
      </div>
    </div>
  );
}

function NewItemForm({
  barcode,
  note,
  initialName,
  initialPhotoUrl,
  onCancel,
}: {
  barcode: string | null;
  note: string;
  initialName: string;
  initialPhotoUrl: string | null;
  onCancel: () => void;
}) {
  const { navigate } = useRouter();
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState(initialName);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [newSection, setNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionEmoji, setNewSectionEmoji] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .sections()
      .then((r) => {
        setSections(r.sections);
        setSectionId((current) => current ?? r.sections[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  // A suggested photo lives on someone else's server; copy it into R2 up front.
  useEffect(() => {
    if (!initialPhotoUrl) return;
    api
      .photoFromUrl(initialPhotoUrl)
      .then((r) => setPhotoKey(r.photoKey))
      .catch(() => {});
  }, [initialPhotoUrl]);

  async function addSection() {
    if (!newSectionName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.createSection(newSectionName, newSectionEmoji || "🛒");
      setSections((prev) => [...prev, res.section]);
      setSectionId(res.section.id);
      setNewSection(false);
      setNewSectionName("");
      setNewSectionEmoji("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that section");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sectionId) {
      setError("Pick a section");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const priceCents = price.trim() ? Math.round(Number(price) * 100) : null;
      const res = await api.createItem({
        name,
        sectionId,
        priceCents: Number.isFinite(priceCents as number) ? priceCents : null,
        photoKey,
        barcode,
      });
      navigate(`/rate/${res.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[520px] pb-28">
      <BackHeader title="New item" />
      <form onSubmit={submit} className="space-y-4 px-4 pt-4">
        {note && (
          <p className="rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm text-[var(--color-muted)]">
            {note}
          </p>
        )}

        <Field label="What is it?">
          <input
            className={inputClass}
            placeholder="Strong Zero Lemon"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus={!name}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-[var(--color-muted)]">Section</span>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <Chip
                key={section.id}
                selected={sectionId === section.id}
                onClick={() => setSectionId(section.id)}
                className="min-h-[44px]"
              >
                {section.emoji} {section.name}
              </Chip>
            ))}
            {!newSection && (
              <button
                type="button"
                onClick={() => setNewSection(true)}
                className="min-h-[44px] rounded-full border border-dashed border-[var(--color-line)] bg-[var(--color-card)] px-4 text-sm font-semibold text-[var(--color-muted)]"
              >
                + New
              </button>
            )}
          </div>

          {newSection && (
            <div className="mt-2 flex gap-2">
              <input
                className={`${inputClass} w-16 text-center`}
                placeholder="🍜"
                maxLength={4}
                value={newSectionEmoji}
                onChange={(e) => setNewSectionEmoji(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Section name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
              />
              <button
                type="button"
                onClick={addSection}
                disabled={busy || !newSectionName.trim()}
                className="min-h-[48px] shrink-0 rounded-xl bg-[var(--color-brand)] px-4 font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>

        <PhotoPicker photoKey={photoKey} onChange={setPhotoKey} />

        <Field label="Price (optional)">
          <input
            className={inputClass}
            type="text"
            inputMode="decimal"
            placeholder="4.99"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </Field>

        {barcode && (
          <p className="text-xs text-[var(--color-muted)]">
            Barcode {barcode} — the next person who scans this will land on your item.
          </p>
        )}

        <ErrorNote>{error}</ErrorNote>

        <Button disabled={busy || !name.trim() || !sectionId}>
          {busy ? "Saving…" : "Next: rate it"}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2 text-sm text-[var(--color-muted)] underline"
        >
          Back
        </button>
      </form>
    </div>
  );
}
