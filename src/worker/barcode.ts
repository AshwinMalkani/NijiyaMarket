const LOOKUP_TIMEOUT_MS = 6_000;

export type BarcodeSuggestion = {
  name: string;
  brand: string | null;
  imageUrl: string | null;
  source: string;
};

/** EAN-13 / UPC-A / EAN-8 are all plain digit strings; reject anything else. */
export function normalizeBarcode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) return null;
  return digits;
}

/**
 * Open Food Facts is free and keyless, but coverage of niche Japanese imports
 * (and most alcohol) is patchy — a miss here is normal and the UI falls back to
 * manual entry. Our own items table is checked first and is the reliable path.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeSuggestion | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,product_name_en,product_name_ja,brands,image_front_url,image_url`;

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: {
        // Open Food Facts asks API clients to identify themselves.
        "user-agent": "NijiyaRankings/1.0 (personal project; malkaniashwin@gmail.com)",
        accept: "application/json",
      },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  let payload: {
    status?: number;
    product?: {
      product_name?: string;
      product_name_en?: string;
      product_name_ja?: string;
      brands?: string;
      image_front_url?: string;
      image_url?: string;
    };
  };
  try {
    payload = await res.json();
  } catch {
    return null;
  }

  const product = payload.product;
  if (!product || payload.status === 0) return null;

  const name = (product.product_name_en || product.product_name || product.product_name_ja || "")
    .trim()
    .slice(0, 80);
  if (!name) return null;

  return {
    name,
    brand: (product.brands ?? "").split(",")[0].trim() || null,
    imageUrl: product.image_front_url || product.image_url || null,
    source: "Open Food Facts",
  };
}
