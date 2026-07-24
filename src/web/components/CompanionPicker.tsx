import { useEffect, useRef, useState } from "react";
import { api, type User } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ErrorNote, inputClass } from "./ui";

type Person = User & { joined?: number };

/** Adds whoever is half-typed into the "someone new" fields. Returns their id. */
export type FlushInvite = () => Promise<number | null>;

/**
 * Tagging someone doesn't score the item for them — it nudges them to rate it
 * themselves. People who haven't signed up can still be tagged: we create a
 * placeholder they claim later by signing up with the same number.
 */
export function CompanionPicker({
  value,
  onChange,
  registerFlush,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  registerFlush?: (flush: FlushInvite) => void;
}) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .users()
      .then((r) => setPeople(r.users.filter((u) => u.id !== user.id)))
      .catch(() => {});
  }, [user.id]);

  function toggle(id: number) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function invite(): Promise<number | null> {
    if (!name.trim() || !phone.trim()) return null;
    setBusy(true);
    setError("");
    try {
      const res = await api.invite(name, phone);
      setPeople((prev) =>
        prev.some((p) => p.id === res.user.id)
          ? prev
          : [...prev, res.user].sort((a, b) => a.name.localeCompare(b.name)),
      );
      if (!value.includes(res.user.id)) onChange([...value, res.user.id]);
      setName("");
      setPhone("");
      setAdding(false);
      return res.user.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add them");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  // Let the parent add a half-typed person on save, so filling the fields and
  // hitting "Save rating" without pressing "Add them" doesn't drop them.
  const inviteRef = useRef(invite);
  inviteRef.current = invite;
  useEffect(() => {
    registerFlush?.(() => inviteRef.current());
  }, [registerFlush]);

  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold tracking-wide text-[var(--color-muted)]">
        Tried it with
      </span>

      <div className="flex flex-wrap gap-2">
        {people.map((person) => {
          const selected = value.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => toggle(person.id)}
              className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold transition-colors ${
                selected
                  ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                  : "border border-[var(--color-line)] bg-[var(--color-card)] text-[var(--color-muted)]"
              }`}
            >
              {person.name}
              {person.joined === 0 && (
                <span className={selected ? "opacity-80" : "opacity-60"}> · invited</span>
              )}
            </button>
          );
        })}

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-[40px] rounded-full border border-dashed border-[var(--color-line)] bg-[var(--color-card)] px-3.5 text-sm font-semibold text-[var(--color-muted)]"
          >
            + Someone new
          </button>
        )}
      </div>

      {/*
        Deliberately not a <form>: this renders inside the rating page's form,
        and a nested form lets the submit event escape to the outer one — which
        silently navigated away instead of adding the person.
      */}
      {adding && (
        <div className="mt-3 space-y-2 rounded-xl bg-[var(--color-card)] p-3 ring-1 ring-[var(--color-line)]">
          <p className="text-xs text-[var(--color-muted)]">
            They don't need an account yet — when they sign up with this number, everything
            you've tagged them in will be waiting.
          </p>
          <input
            className={inputClass}
            placeholder="Their name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <input
            className={inputClass}
            type="tel"
            inputMode="tel"
            placeholder="Their phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                invite().catch(() => {});
              }
            }}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => invite().catch(() => {})}
              disabled={busy || !name.trim() || !phone.trim()}
              className="min-h-[44px] flex-1 rounded-xl bg-[var(--color-brand)] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add them"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setName("");
                setPhone("");
                setError("");
              }}
              className="min-h-[44px] rounded-xl border border-[var(--color-line)] px-4 text-sm text-[var(--color-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
