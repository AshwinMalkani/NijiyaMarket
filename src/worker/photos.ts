import type { Env } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export class PhotoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertImage(contentType: string | null): string {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) throw new PhotoError("That file isn't an image");
  return type;
}

export async function storePhoto(env: Env, body: ArrayBuffer, contentType: string): Promise<string> {
  if (body.byteLength === 0) throw new PhotoError("Image is empty");
  if (body.byteLength > MAX_BYTES) throw new PhotoError("Image is larger than 10 MB");
  const key = `photos/${crypto.randomUUID()}`;
  await env.PHOTOS.put(key, body, { httpMetadata: { contentType } });
  return key;
}

/** Pull an image from a URL the user pasted and keep our own copy, so links can't rot. */
export async function storePhotoFromUrl(env: Env, rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PhotoError("That doesn't look like a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PhotoError("Image URL must start with http or https");
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "image/*" },
      redirect: "follow",
    });
  } catch {
    throw new PhotoError("Couldn't download that image (timed out or unreachable)");
  }

  if (!res.ok) throw new PhotoError(`Couldn't download that image (HTTP ${res.status})`);

  const contentType = assertImage(res.headers.get("content-type"));
  const declaredLength = Number(res.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) throw new PhotoError("That image is larger than 10 MB");

  const body = await res.arrayBuffer();
  return storePhoto(env, body, contentType);
}

export async function uploadedPhoto(env: Env, file: File): Promise<string> {
  const contentType = assertImage(file.type);
  if (file.size > MAX_BYTES) throw new PhotoError("Image is larger than 10 MB");
  return storePhoto(env, await file.arrayBuffer(), contentType);
}

export async function servePhoto(env: Env, key: string): Promise<Response> {
  if (!key.startsWith("photos/")) return new Response("Not found", { status: 404 });
  const object = await env.PHOTOS.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
