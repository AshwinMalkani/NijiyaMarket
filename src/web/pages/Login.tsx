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

  const submitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const res = await api.checkPhone(phone);
      setPhone(res.phone);
      setKnownName(res.name);
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
        <div className="text-5xl">🍙</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Nijiya Rankings</h1>
        <p className="mt-1 text-[var(--color-muted)]">
          Everything from the market, ranked by us.
        </p>
      </div>

      {step === "phone" && (
        <form onSubmit={submitPhone} className="space-y-4">
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
        <form onSubmit={submitLogin} className="space-y-4">
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
        <form onSubmit={submitSignup} className="space-y-4">
          <p className="text-center text-sm text-[var(--color-muted)]">
            New here — let's make you an account.
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
