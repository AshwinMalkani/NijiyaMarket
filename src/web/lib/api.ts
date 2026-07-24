export type User = { id: number; phone?: string; name: string };

export type Section = {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  item_count?: number;
};

export type ItemSummary = {
  id: number;
  name: string;
  description: string | null;
  price_cents: number | null;
  photo_key: string | null;
  section_slug: string;
  section_name: string;
  section_emoji: string;
  avg_score: number | null;
  rating_count: number;
  my_score: number | null;
};

export type Rating = {
  id: number;
  user_id: number;
  user_name: string;
  score: number;
  notes: string | null;
  tried_on: string | null;
  updated_at: string;
  companions: { id: number; name: string }[];
  photos: string[];
};

export type ItemDetail = {
  item: ItemSummary & {
    section_id: number;
    created_by: number;
    created_by_name: string;
    created_at: string;
  };
  ratings: Rating[];
  myRating: Rating | null;
};

export type FeedEntry = Rating & {
  item_id: number;
  item_name: string;
  photo_key: string | null;
  section_slug: string;
  section_name: string;
  section_emoji: string;
};

export type Pending = {
  id: number;
  created_at: string;
  item_id: number;
  item_name: string;
  photo_key: string | null;
  section_emoji: string;
  section_name: string;
  tagged_by_id: number;
  tagged_by_name: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers:
      init?.body instanceof FormData
        ? init?.headers
        : { "content-type": "application/json", ...(init?.headers ?? {}) },
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    const message =
      (payload as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return payload as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  me: () => request<{ user: User }>("/me"),
  checkPhone: (phone: string) =>
    post<{ exists: boolean; name: string | null; phone: string }>("/auth/check-phone", { phone }),
  signup: (input: { phone: string; name: string; pin: string; inviteCode: string }) =>
    post<{ user: User }>("/auth/signup", input),
  login: (input: { phone: string; pin: string }) => post<{ user: User }>("/auth/login", input),
  logout: () => post<{ ok: true }>("/auth/logout"),

  users: () =>
    request<{ users: (User & { rating_count: number; joined: number })[] }>("/users"),
  invite: (name: string, phone: string) =>
    post<{ user: User; existed: boolean }>("/users/invite", { name, phone }),
  userRatings: (id: number) =>
    request<{
      user: User;
      ratings: (Rating & {
        item_id: number;
        item_name: string;
        photo_key: string | null;
        section_slug: string;
        section_name: string;
        section_emoji: string;
        rating_id: number;
      })[];
    }>(`/users/${id}/ratings`),

  sections: () => request<{ sections: Section[] }>("/sections"),
  createSection: (name: string, emoji: string) =>
    post<{ section: Section }>("/sections", { name, emoji }),

  items: (params: { section?: string; q?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.section && params.section !== "all") search.set("section", params.section);
    if (params.q) search.set("q", params.q);
    const qs = search.toString();
    return request<{ items: ItemSummary[] }>(`/items${qs ? `?${qs}` : ""}`);
  },
  createItem: (input: {
    name: string;
    sectionId: number;
    description?: string;
    priceCents?: number | null;
    photoKey?: string | null;
    barcode?: string | null;
  }) => post<{ id: number; existed: boolean }>("/items", input),

  barcode: (code: string) =>
    request<{
      barcode: string;
      item: (ItemSummary & { id: number }) | null;
      suggestion: { name: string; brand: string | null; imageUrl: string | null; source: string } | null;
    }>(`/barcode/${encodeURIComponent(code)}`),
  item: (id: number) => request<ItemDetail>(`/items/${id}`),

  saveRating: (
    itemId: number,
    input: {
      score: number;
      notes?: string;
      triedOn?: string | null;
      companionIds?: number[];
      photoKeys?: string[];
    },
  ) => request<{ id: number; score: number }>(`/ratings/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  }),
  deleteRating: (itemId: number) =>
    request<{ ok: true }>(`/ratings/${itemId}`, { method: "DELETE" }),

  feed: (cursor?: string | null) =>
    request<{ feed: FeedEntry[]; nextCursor: string | null }>(
      `/feed${cursor ? `?before=${encodeURIComponent(cursor)}` : ""}`,
    ),

  pending: () => request<{ pending: Pending[] }>("/pending"),
  dismissPending: (id: number) => post<{ ok: true }>(`/pending/${id}/dismiss`),

  uploadPhoto: async (file: Blob) => {
    const form = new FormData();
    form.append("file", file, "photo.jpg");
    return request<{ photoKey: string }>("/photos", { method: "POST", body: form });
  },
  /** Copies a barcode-suggested product image into R2. Not a user-facing paste-a-link. */
  photoFromUrl: (photoUrl: string) => post<{ photoKey: string }>("/photos", { photoUrl }),
};

export const photoUrl = (key: string | null | undefined) => (key ? `/img/${key}` : null);

/** Downscale on-device so we aren't shipping 12 MP phone photos to R2. */
export async function downscale(file: File, maxEdge = 1600, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}
