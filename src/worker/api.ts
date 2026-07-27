import { Hono } from "hono";
import type { Env, Vars } from "./types";
import { normalizePhone, requireAuth } from "./auth";
import { PhotoError, storePhotoFromUrl, uploadedPhoto } from "./photos";
import { lookupBarcode, normalizeBarcode } from "./barcode";

export const api = new Hono<{ Bindings: Env; Variables: Vars }>();

api.use("*", requireAuth);

const FEED_PAGE = 20;

function badRequest(message: string) {
  return { error: message } as const;
}

function cleanScore(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10) return null;
  return Math.round(n * 10) / 10;
}

function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

const asPhotoKey = (value: unknown): string | null =>
  typeof value === "string" && value.startsWith("photos/") ? value : null;

/* ---------- me & users ---------- */

api.get("/me", (c) => c.json({ user: c.get("user") }));

api.get("/users", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.pin_hash IS NOT NULL AS joined, COUNT(r.id) AS rating_count
       FROM users u LEFT JOIN ratings r ON r.user_id = u.id
      GROUP BY u.id ORDER BY u.name COLLATE NOCASE`,
  ).all<{ id: number; name: string; joined: number; rating_count: number }>();
  return c.json({ users: results });
});

/**
 * Create a placeholder for a friend who hasn't signed up yet, so they can be
 * tagged as a companion today. They become a real account by signing up with
 * this phone number, which claims the row and everything attached to it.
 */
api.post("/users/invite", async (c) => {
  const inviter = c.get("user");
  const body = await c.req.json<{ name?: string; phone?: string }>();

  const name = cleanText(body.name, 40);
  if (!name) return c.json(badRequest("Give them a name"), 400);

  const e164 = normalizePhone(body.phone ?? "");
  if (!e164) return c.json(badRequest("Enter a valid phone number for them"), 400);

  const existing = await c.env.DB.prepare("SELECT id, name FROM users WHERE phone = ?")
    .bind(e164)
    .first<{ id: number; name: string }>();
  if (existing) return c.json({ user: { id: existing.id, name: existing.name }, existed: true });

  const created = await c.env.DB.prepare(
    "INSERT INTO users (phone, name, invited_by) VALUES (?, ?, ?) RETURNING id, name",
  )
    .bind(e164, name, inviter.id)
    .first<{ id: number; name: string }>();

  return c.json({ user: created, existed: false }, 201);
});

api.get("/users/:id/ratings", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json(badRequest("Bad user id"), 400);

  const user = await c.env.DB.prepare("SELECT id, name FROM users WHERE id = ?")
    .bind(id)
    .first<{ id: number; name: string }>();
  if (!user) return c.json(badRequest("No such person"), 404);

  const { results } = await c.env.DB.prepare(
    `SELECT r.id AS rating_id, r.score, r.notes, r.tried_on, r.updated_at,
            i.id AS item_id, i.name AS item_name, i.photo_key,
            s.slug AS section_slug, s.name AS section_name, s.emoji AS section_emoji
       FROM ratings r
       JOIN items i ON i.id = r.item_id
       JOIN sections s ON s.id = i.section_id
      WHERE r.user_id = ?
      ORDER BY r.score DESC, r.updated_at DESC`,
  )
    .bind(id)
    .all();

  return c.json({ user, ratings: results });
});

/* ---------- sections ---------- */

api.get("/sections", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.slug, s.name, s.emoji, COUNT(i.id) AS item_count
       FROM sections s LEFT JOIN items i ON i.section_id = s.id
      GROUP BY s.id ORDER BY s.sort, s.name`,
  ).all();
  return c.json({ sections: results });
});

api.post("/sections", async (c) => {
  const body = await c.req.json<{ name?: string; emoji?: string }>();
  const name = cleanText(body.name, 30);
  if (!name) return c.json(badRequest("Give the section a name"), 400);

  const slug = slugify(name);
  if (!slug) return c.json(badRequest("Give the section a name with letters or numbers"), 400);

  const existing = await c.env.DB.prepare("SELECT id FROM sections WHERE slug = ?")
    .bind(slug)
    .first();
  if (existing) return c.json(badRequest("A section with that name already exists"), 409);

  const emoji = cleanText(body.emoji, 8) ?? "🛒";
  const maxSort = await c.env.DB.prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM sections").first<{
    m: number;
  }>();

  const section = await c.env.DB.prepare(
    "INSERT INTO sections (slug, name, emoji, sort) VALUES (?, ?, ?, ?) RETURNING id, slug, name, emoji",
  )
    .bind(slug, name, emoji, (maxSort?.m ?? 0) + 1)
    .first();

  return c.json({ section }, 201);
});

/* ---------- items ---------- */

api.get("/items", async (c) => {
  const user = c.get("user");
  const section = c.req.query("section");
  const q = c.req.query("q");

  const where: string[] = [];
  const binds: unknown[] = [user.id];
  if (section && section !== "all") {
    where.push("s.slug = ?");
    binds.push(section);
  }
  if (q && q.trim()) {
    where.push("i.name LIKE ?");
    binds.push(`%${q.trim()}%`);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.description, i.price_cents, i.photo_key, i.created_at,
            s.slug AS section_slug, s.name AS section_name, s.emoji AS section_emoji,
            AVG(r.score) AS avg_score, COUNT(r.id) AS rating_count,
            (SELECT score FROM ratings WHERE item_id = i.id AND user_id = ?) AS my_score
       FROM items i
       JOIN sections s ON s.id = i.section_id
       LEFT JOIN ratings r ON r.item_id = i.id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY i.id
      ORDER BY (avg_score IS NULL), avg_score DESC, rating_count DESC, i.name COLLATE NOCASE`,
  )
    .bind(...binds)
    .all();

  return c.json({ items: results });
});

/**
 * Scan resolution, in priority order: an item we already have with this barcode
 * (so two people scanning the same snack land on the same item), then an
 * external product database, then nothing and the user types it in.
 */
api.get("/barcode/:code", async (c) => {
  const user = c.get("user");
  const barcode = normalizeBarcode(c.req.param("code"));
  if (!barcode) return c.json(badRequest("That barcode doesn't look right"), 400);

  const existing = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.photo_key,
            s.slug AS section_slug, s.name AS section_name, s.emoji AS section_emoji,
            (SELECT AVG(score) FROM ratings WHERE item_id = i.id) AS avg_score,
            (SELECT COUNT(*) FROM ratings WHERE item_id = i.id) AS rating_count,
            (SELECT score FROM ratings WHERE item_id = i.id AND user_id = ?) AS my_score
       FROM items i JOIN sections s ON s.id = i.section_id
      WHERE i.barcode = ?`,
  )
    .bind(user.id, barcode)
    .first();

  if (existing) return c.json({ barcode, item: existing, suggestion: null });

  return c.json({ barcode, item: null, suggestion: await lookupBarcode(barcode) });
});

api.post("/items", async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{
    name?: string;
    sectionId?: number;
    description?: string;
    priceCents?: number;
    photoKey?: string;
    barcode?: string;
  }>();

  const name = cleanText(body.name, 80);
  if (!name) return c.json(badRequest("Give the item a name"), 400);

  const sectionId = Number(body.sectionId);
  if (!Number.isInteger(sectionId)) return c.json(badRequest("Pick a section"), 400);
  const section = await c.env.DB.prepare("SELECT id FROM sections WHERE id = ?")
    .bind(sectionId)
    .first();
  if (!section) return c.json(badRequest("Pick a section"), 400);

  let priceCents: number | null = null;
  if (body.priceCents !== undefined && body.priceCents !== null && `${body.priceCents}` !== "") {
    const n = Math.round(Number(body.priceCents));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      return c.json(badRequest("That price doesn't look right"), 400);
    }
    priceCents = n;
  }

  const barcode = normalizeBarcode(body.barcode);
  if (barcode) {
    const clash = await c.env.DB.prepare("SELECT id FROM items WHERE barcode = ?")
      .bind(barcode)
      .first<{ id: number }>();
    // Someone beat us to this product — send them to the existing item.
    if (clash) return c.json({ id: clash.id, existed: true });
  }

  const photoKey = asPhotoKey(body.photoKey);

  const item = await c.env.DB.prepare(
    `INSERT INTO items (name, section_id, description, price_cents, photo_key, barcode, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      name,
      sectionId,
      cleanText(body.description, 500),
      priceCents,
      photoKey,
      barcode,
      user.id,
    )
    .first<{ id: number }>();

  return c.json({ id: item?.id, existed: false }, 201);
});

/** Move an item to a different section. Anyone signed in can fix a miscategorization. */
api.patch("/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json(badRequest("Bad item id"), 400);

  const item = await c.env.DB.prepare("SELECT id FROM items WHERE id = ?").bind(id).first();
  if (!item) return c.json(badRequest("No such item"), 404);

  const body = await c.req.json<{ sectionId?: number }>();
  const sectionId = Number(body.sectionId);
  if (!Number.isInteger(sectionId)) return c.json(badRequest("Pick a section"), 400);
  const section = await c.env.DB.prepare("SELECT id FROM sections WHERE id = ?")
    .bind(sectionId)
    .first();
  if (!section) return c.json(badRequest("Pick a section"), 400);

  await c.env.DB.prepare("UPDATE items SET section_id = ? WHERE id = ?").bind(sectionId, id).run();
  return c.json({ ok: true });
});

api.get("/items/:id", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json(badRequest("Bad item id"), 400);

  const item = await c.env.DB.prepare(
    `SELECT i.id, i.name, i.description, i.price_cents, i.photo_key, i.created_at,
            i.created_by, cu.name AS created_by_name,
            s.id AS section_id, s.slug AS section_slug, s.name AS section_name, s.emoji AS section_emoji,
            (SELECT AVG(score) FROM ratings WHERE item_id = i.id) AS avg_score,
            (SELECT COUNT(*) FROM ratings WHERE item_id = i.id) AS rating_count
       FROM items i
       JOIN sections s ON s.id = i.section_id
       JOIN users cu ON cu.id = i.created_by
      WHERE i.id = ?`,
  )
    .bind(id)
    .first();
  if (!item) return c.json(badRequest("No such item"), 404);

  const [ratingsRes, companionsRes, photosRes] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT r.id, r.user_id, u.name AS user_name, r.score, r.notes, r.tried_on, r.updated_at
         FROM ratings r JOIN users u ON u.id = r.user_id
        WHERE r.item_id = ? ORDER BY r.score DESC, r.updated_at DESC`,
    ).bind(id),
    c.env.DB.prepare(
      `SELECT rc.rating_id, rc.user_id, u.name
         FROM rating_companions rc
         JOIN users u ON u.id = rc.user_id
         JOIN ratings r ON r.id = rc.rating_id
        WHERE r.item_id = ?`,
    ).bind(id),
    c.env.DB.prepare(
      `SELECT rp.rating_id, rp.photo_key
         FROM rating_photos rp JOIN ratings r ON r.id = rp.rating_id
        WHERE r.item_id = ?`,
    ).bind(id),
  ]);

  const companions = companionsRes.results as { rating_id: number; user_id: number; name: string }[];
  const photos = photosRes.results as { rating_id: number; photo_key: string }[];

  type RatingRow = { id: number; user_id: number; [column: string]: unknown };
  const ratings = (ratingsRes.results as RatingRow[]).map((r) => ({
    ...r,
    companions: companions
      .filter((x) => x.rating_id === r.id)
      .map((x) => ({ id: x.user_id, name: x.name })),
    photos: photos.filter((x) => x.rating_id === r.id).map((x) => x.photo_key),
  }));

  return c.json({
    item,
    ratings,
    myRating: ratings.find((r) => r.user_id === user.id) ?? null,
  });
});

/* ---------- ratings ---------- */

api.put("/ratings/:itemId", async (c) => {
  const user = c.get("user");
  const itemId = Number(c.req.param("itemId"));
  if (!Number.isInteger(itemId)) return c.json(badRequest("Bad item id"), 400);

  const item = await c.env.DB.prepare("SELECT id FROM items WHERE id = ?").bind(itemId).first();
  if (!item) return c.json(badRequest("No such item"), 404);

  const body = await c.req.json<{
    score?: number;
    notes?: string;
    triedOn?: string;
    companionIds?: number[];
    photoKeys?: string[];
  }>();

  const score = cleanScore(body.score);
  if (score === null) return c.json(badRequest("Score must be between 0 and 10"), 400);

  const triedOn =
    typeof body.triedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.triedOn)
      ? body.triedOn
      : null;

  const rating = await c.env.DB.prepare(
    `INSERT INTO ratings (item_id, user_id, score, notes, tried_on)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (item_id, user_id) DO UPDATE
       SET score = excluded.score,
           notes = excluded.notes,
           tried_on = excluded.tried_on,
           updated_at = datetime('now')
     RETURNING id`,
  )
    .bind(itemId, user.id, score, cleanText(body.notes, 1000), triedOn)
    .first<{ id: number }>();

  if (!rating) return c.json(badRequest("Could not save rating"), 500);

  // Companions: tags on my rating only — they never become scores for those people.
  const companionIds = Array.isArray(body.companionIds)
    ? [...new Set(body.companionIds.map(Number))].filter(
        (id) => Number.isInteger(id) && id !== user.id,
      )
    : [];

  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare("DELETE FROM rating_companions WHERE rating_id = ?").bind(rating.id),
    c.env.DB.prepare("DELETE FROM rating_photos WHERE rating_id = ?").bind(rating.id),
    // Rating an item resolves any nudge I was sitting on for it.
    c.env.DB.prepare("DELETE FROM pending_ratings WHERE user_id = ? AND item_id = ?").bind(
      user.id,
      itemId,
    ),
  ];

  for (const id of companionIds) {
    statements.push(
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO rating_companions (rating_id, user_id) SELECT ?, id FROM users WHERE id = ?",
      ).bind(rating.id, id),
    );
    // Nudge each companion to add their own score, unless they already rated it.
    statements.push(
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO pending_ratings (user_id, item_id, tagged_by)
         SELECT ?, ?, ? FROM users WHERE id = ?
          AND NOT EXISTS (SELECT 1 FROM ratings WHERE item_id = ? AND user_id = ?)`,
      ).bind(id, itemId, user.id, id, itemId, id),
    );
  }

  const photoKeys = Array.isArray(body.photoKeys)
    ? body.photoKeys.filter((k): k is string => typeof k === "string" && k.startsWith("photos/"))
    : [];
  for (const key of photoKeys.slice(0, 6)) {
    statements.push(
      c.env.DB.prepare("INSERT INTO rating_photos (rating_id, photo_key) VALUES (?, ?)").bind(
        rating.id,
        key,
      ),
    );
  }

  await c.env.DB.batch(statements);

  // If the item has no photo yet, adopt the first one from this rating.
  if (photoKeys.length) {
    await c.env.DB.prepare("UPDATE items SET photo_key = ? WHERE id = ? AND photo_key IS NULL")
      .bind(photoKeys[0], itemId)
      .run();
  }

  return c.json({ id: rating.id, score });
});

api.delete("/ratings/:itemId", async (c) => {
  const user = c.get("user");
  const itemId = Number(c.req.param("itemId"));
  if (!Number.isInteger(itemId)) return c.json(badRequest("Bad item id"), 400);

  const rating = await c.env.DB.prepare(
    "SELECT id FROM ratings WHERE item_id = ? AND user_id = ?",
  )
    .bind(itemId, user.id)
    .first<{ id: number }>();
  if (!rating) return c.json({ ok: true });

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM rating_companions WHERE rating_id = ?").bind(rating.id),
    c.env.DB.prepare("DELETE FROM rating_photos WHERE rating_id = ?").bind(rating.id),
    c.env.DB.prepare("DELETE FROM ratings WHERE id = ?").bind(rating.id),
  ]);

  return c.json({ ok: true });
});

/* ---------- pending ratings (the "tried with you" nudge) ---------- */

api.get("/pending", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.created_at,
            i.id AS item_id, i.name AS item_name, i.photo_key,
            s.emoji AS section_emoji, s.name AS section_name,
            u.id AS tagged_by_id, u.name AS tagged_by_name
       FROM pending_ratings p
       JOIN items i ON i.id = p.item_id
       JOIN sections s ON s.id = i.section_id
       JOIN users u ON u.id = p.tagged_by
      WHERE p.user_id = ? AND p.dismissed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM ratings WHERE item_id = p.item_id AND user_id = p.user_id)
      ORDER BY p.created_at DESC`,
  )
    .bind(user.id)
    .all();
  return c.json({ pending: results });
});

api.post("/pending/:id/dismiss", async (c) => {
  const user = c.get("user");
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json(badRequest("Bad id"), 400);
  await c.env.DB.prepare(
    "UPDATE pending_ratings SET dismissed_at = datetime('now') WHERE id = ? AND user_id = ?",
  )
    .bind(id, user.id)
    .run();
  return c.json({ ok: true });
});

/* ---------- feed ---------- */

api.get("/feed", async (c) => {
  const before = c.req.query("before");
  const binds: unknown[] = [];
  let cursorClause = "";

  if (before) {
    const [ts, rawId] = before.split("|");
    const id = Number(rawId);
    if (ts && Number.isInteger(id)) {
      cursorClause = "WHERE (r.updated_at < ? OR (r.updated_at = ? AND r.id < ?))";
      binds.push(ts, ts, id);
    }
  }

  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.score, r.notes, r.tried_on, r.updated_at,
            u.id AS user_id, u.name AS user_name,
            i.id AS item_id, i.name AS item_name, i.photo_key,
            s.slug AS section_slug, s.name AS section_name, s.emoji AS section_emoji
       FROM ratings r
       JOIN users u ON u.id = r.user_id
       JOIN items i ON i.id = r.item_id
       JOIN sections s ON s.id = i.section_id
       ${cursorClause}
      ORDER BY r.updated_at DESC, r.id DESC
      LIMIT ?`,
  )
    .bind(...binds, FEED_PAGE + 1)
    .all<Record<string, unknown> & { id: number; updated_at: string }>();

  const page = results.slice(0, FEED_PAGE);
  const last = page[page.length - 1];

  let companions: { rating_id: number; user_id: number; name: string }[] = [];
  let photos: { rating_id: number; photo_key: string }[] = [];
  if (page.length) {
    const ids = page.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const [cRes, pRes] = await c.env.DB.batch([
      c.env.DB.prepare(
        `SELECT rc.rating_id, rc.user_id, u.name FROM rating_companions rc
           JOIN users u ON u.id = rc.user_id WHERE rc.rating_id IN (${placeholders})`,
      ).bind(...ids),
      c.env.DB.prepare(
        `SELECT rating_id, photo_key FROM rating_photos WHERE rating_id IN (${placeholders})`,
      ).bind(...ids),
    ]);
    companions = cRes.results as typeof companions;
    photos = pRes.results as typeof photos;
  }

  return c.json({
    feed: page.map((r) => ({
      ...r,
      companions: companions
        .filter((x) => x.rating_id === r.id)
        .map((x) => ({ id: x.user_id, name: x.name })),
      photos: photos.filter((x) => x.rating_id === r.id).map((x) => x.photo_key),
    })),
    nextCursor: results.length > FEED_PAGE && last ? `${last.updated_at}|${last.id}` : null,
  });
});

/* ---------- photo upload ---------- */

api.post("/photos", async (c) => {
  try {
    const contentType = c.req.header("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return c.json(badRequest("No image received"), 400);
      return c.json({ photoKey: await uploadedPhoto(c.env, file) }, 201);
    }
    const body = await c.req.json<{ photoUrl?: string }>();
    if (!body.photoUrl) return c.json(badRequest("No image received"), 400);
    return c.json({ photoKey: await storePhotoFromUrl(c.env, body.photoUrl) }, 201);
  } catch (err) {
    if (err instanceof PhotoError) return c.json(badRequest(err.message), err.status as 400);
    throw err;
  }
});
