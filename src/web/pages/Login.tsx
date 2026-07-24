import { useState } from "react";
import { api, type User } from "../lib/api";
import { Button, ErrorNote, Field, inputClass } from "../components/ui";

type Step = "phone" | "login" | "signup";

export function Login({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [knownName, setKnownName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const [invitedBy, setInvitedBy] = useState<string | null>(null);

  const submitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.checkPhone(phone);
      setPhone(res.phone);
      setKnownName(res.name);
      setInvitedBy(res.invitedBy ?? null);
      // A friend may have tagged this number already — prefill the name they used.
      if (!res.exists && res.name) setName(res.name);
      setStep(res.exists ? "login" : "signup");
    });
  };

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.login({ phone, pin });
      onSignedIn(res.user);
    });
  };

  const submitSignup = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.signup({ phone, name, pin, inviteCode });
      onSignedIn(res.user);
    });
  };

  const restart = () => {
    setStep("phone");
    setPin("");
    setError("");
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <img
          src="/icon.svg"
          alt=""
          className="mx-auto h-16 w-16 rounded-2xl shadow-[0_4px_14px_rgba(192,57,43,0.35)]"
        />
        <h1 className="mt-4 text-[32px] font-extrabold tracking-tight">
          Nijiya Rankings<span className="text-[var(--color-brand)]">.</span>
        </h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Everything from the market, ranked by us.
        </p>
      </div>

      {step === "phone" && (
        <form onSubmit={submitPhone} className="space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(33,28,23,0.04)]">
          <Field label="Phone number" hint="We use this as your login — no texts, we promise.">
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <Button disabled={busy || !phone}>{busy ? "Checking…" : "Continue"}</Button>
        </form>
      )}

      {step === "login" && (
        <form onSubmit={submitLogin} className="space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(33,28,23,0.04)]">
          <p className="text-center">
            Welcome back{knownName ? `, ${knownName}` : ""}.
          </p>
          <Field label="Your PIN">
            <input
              className={inputClass}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <Button disabled={busy || pin.length < 4}>{busy ? "Signing in…" : "Sign in"}</Button>
          <button type="button" onClick={restart} className="w-full py-2 text-sm text-[var(--color-muted)] underline">
            Use a different number
          </button>
        </form>
      )}

      {step === "signup" && (
        <form onSubmit={submitSignup} className="space-y-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 shadow-[0_1px_2px_rgba(33,28,23,0.04)]">
          <p className="text-center text-sm text-[var(--color-muted)]">
            {invitedBy
              ? `${invitedBy} has been tagging you in ratings — claim your account and see them.`
              : "New here — let's make you an account."}
          </p>
          <Field label="Your name">
            <input
              className={inputClass}
              placeholder="Ashwin"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Pick a PIN" hint="4–6 digits. You'll use it to sign back in.">
            <input
              className={inputClass}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              placeholder="••••"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Invite code" hint="Ask Ashwin for it.">
            <input
              className={inputClass}
              autoCapitalize="none"
              autoCorrect="off"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <Button disabled={busy || !name || pin.length < 4}>
            {busy ? "Creating…" : "Create account"}
          </Button>
          <button type="button" onClick={restart} className="w-full py-2 text-sm text-[var(--color-muted)] underline">
            Use a different number
          </button>
        </form>
      )}
    </div>
  );
}
