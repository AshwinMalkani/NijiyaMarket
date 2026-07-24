import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import type { Env, User, Vars } from "./types";

const COOKIE = "nj_session";
const SESSION_DAYS = 180;
const PBKDF2_ITERATIONS = 100_000;
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MINUTES = 15;

const encoder = new TextEncoder();

/* ---------- encoding helpers ---------- */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------- phone numbers ---------- */

/**
 * Normalize user input to E.164. Bare 10-digit input is assumed to be US (+1),
 * which covers everyone using this app; full international input with a leading
 * + is passed through.
 */
export function normalizePhone(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function formatPhone(e164: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/* ---------- PIN hashing ---------- */

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const actual = await derive(pin, salt, iterations);
  return timingSafeEqual(actual, expected);
}

/* ---------- sessions ---------- */

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
}

async function issueSession(c: Context<{ Bindings: Env; Variables: Vars }>, userId: number) {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256Hex(token);
  await c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(tokenHash, userId, sessionExpiry())
    .run();

  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function currentUser(
  c: Context<{ Bindings: Env; Variables: Vars }>,
): Promise<User | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);

  const row = await c.env.DB.prepare(
    `SELECT u.id, u.phone, u.name, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
  )
    .bind(tokenHash)
    .first<{ id: number; phone: string; name: string; expires_at: string }>();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }

  // Sliding expiry: refresh once we're inside the final 30 days.
  if (new Date(row.expires_at).getTime() - Date.now() < 30 * 86_400_000) {
    await c.env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?")
      .bind(sessionExpiry(), tokenHash)
      .run();
  }

  return { id: row.id, phone: row.phone, name: row.name };
}

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: Vars }> = async (
  c,
  next,
) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "Not signed in" }, 401);
  c.set("user", user);
  await next();
};

/* ---------- brute-force throttling ---------- */

async function tooManyAttempts(env: Env, phone: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM login_attempts
      WHERE phone = ? AND attempted_at > datetime('now', ?)`,
  )
    .bind(phone, `-${ATTEMPT_WINDOW_MINUTES} minutes`)
    .first<{ n: number }>();
  return (row?.n ?? 0) >= MAX_FAILED_ATTEMPTS;
}

async function recordFailure(env: Env, phone: string) {
  await env.DB.prepare("INSERT INTO login_attempts (phone) VALUES (?)").bind(phone).run();
}

async function clearFailures(env: Env, phone: string) {
  await env.DB.prepare("DELETE FROM login_attempts WHERE phone = ?").bind(phone).run();
}

/* ---------- routes ---------- */

const validPin = (pin: unknown): pin is string =>
  typeof pin === "string" && /^\d{4,6}$/.test(pin);

export const authRoutes = new Hono<{ Bindings: Env; Variables: Vars }>();

authRoutes.post("/check-phone", async (c) => {
  const { phone } = await c.req.json<{ phone?: string }>();
  const e164 = normalizePhone(phone ?? "");
  if (!e164) return c.json({ error: "Enter a valid phone number" }, 400);

  const row = await c.env.DB.prepare(
    `SELECT u.name, u.pin_hash, inviter.name AS invited_by_name
       FROM users u LEFT JOIN users inviter ON inviter.id = u.invited_by
      WHERE u.phone = ?`,
  )
    .bind(e164)
    .first<{ name: string; pin_hash: string | null; invited_by_name: string | null }>();

  // An unclaimed invite is not an account yet — send them through signup, but
  // prefill the name their friend used and tell them who tagged them.
  const claimed = !!row?.pin_hash;
  return c.json({
    exists: claimed,
    name: row?.name ?? null,
    invitedBy: !row || claimed ? null : row.invited_by_name,
    phone: e164,
  });
});

authRoutes.post("/signup", async (c) => {
  const body = await c.req.json<{
    phone?: string;
    name?: string;
    pin?: string;
    inviteCode?: string;
  }>();

  const e164 = normalizePhone(body.phone ?? "");
  if (!e164) return c.json({ error: "Enter a valid phone number" }, 400);

  const name = (body.name ?? "").trim();
  if (name.length < 1 || name.length > 40) return c.json({ error: "Enter your name" }, 400);

  if (!validPin(body.pin)) return c.json({ error: "PIN must be 4–6 digits" }, 400);

  const expected = c.env.INVITE_CODE;
  if (expected && (body.inviteCode ?? "").trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return c.json({ error: "That invite code isn't right" }, 403);
  }

  const existing = await c.env.DB.prepare("SELECT id, pin_hash FROM users WHERE phone = ?")
    .bind(e164)
    .first<{ id: number; pin_hash: string | null }>();
  if (existing?.pin_hash) {
    return c.json({ error: "That number already has an account — sign in" }, 409);
  }

  const pinHash = await hashPin(body.pin);
  let userId: number;

  if (existing) {
    // Claim the placeholder a friend created when they tagged this person.
    await c.env.DB.prepare(
      "UPDATE users SET name = ?, pin_hash = ?, claimed_at = datetime('now') WHERE id = ?",
    )
      .bind(name, pinHash, existing.id)
      .run();
    userId = existing.id;
  } else {
    const inserted = await c.env.DB.prepare(
      "INSERT INTO users (phone, name, pin_hash, claimed_at) VALUES (?, ?, ?, datetime('now')) RETURNING id",
    )
      .bind(e164, name, pinHash)
      .first<{ id: number }>();
    if (!inserted) return c.json({ error: "Could not create account" }, 500);
    userId = inserted.id;
  }

  await issueSession(c, userId);
  return c.json({ user: { id: userId, phone: e164, name } });
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ phone?: string; pin?: string }>();
  const e164 = normalizePhone(body.phone ?? "");
  if (!e164) return c.json({ error: "Enter a valid phone number" }, 400);
  if (typeof body.pin !== "string") return c.json({ error: "Enter your PIN" }, 400);

  if (await tooManyAttempts(c.env, e164)) {
    return c.json({ error: "Too many attempts — wait 15 minutes and try again" }, 429);
  }

  const user = await c.env.DB.prepare("SELECT id, phone, name, pin_hash FROM users WHERE phone = ?")
    .bind(e164)
    .first<{ id: number; phone: string; name: string; pin_hash: string | null }>();

  if (!user?.pin_hash || !(await verifyPin(body.pin, user.pin_hash))) {
    await recordFailure(c.env, e164);
    return c.json({ error: "Wrong phone number or PIN" }, 401);
  }

  await clearFailures(c.env, e164);
  await issueSession(c, user.id);
  return c.json({ user: { id: user.id, phone: user.phone, name: user.name } });
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await sha256Hex(token))
      .run();
  }
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true });
});
