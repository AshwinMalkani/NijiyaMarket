import { useRef, useState } from "react";
import { api, downscale, photoUrl } from "../lib/api";
import { ErrorNote } from "./ui";

export function PhotoPicker({
  photoKey,
  onChange,
  label = "Photo",
}: {
  photoKey: string | null;
  onChange: (key: string | null) => void;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const blob = await downscale(file);
      const res = await api.uploadPhoto(blob);
      onChange(res.photoKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const preview = photoUrl(photoKey);

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-muted)]">{label}</span>

      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-[var(--color-line)]">
          <img src={preview} alt="" className="max-h-56 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="min-h-[48px] w-full rounded-xl border border-dashed border-[var(--color-line)] bg-white px-3 text-sm font-medium text-[var(--color-muted)] active:bg-stone-50"
        >
          {busy ? "Uploading…" : "📷 Take or choose a photo"}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </div>
  );
}
