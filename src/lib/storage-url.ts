import { supabase } from "@/integrations/supabase/client";

const KNOWN_BUCKETS = ["product-images", "branding"] as const;
type KnownBucket = (typeof KNOWN_BUCKETS)[number];

const cache = new Map<string, { url: string; exp: number }>();
const SIGN_TTL = 60 * 60; // 1h

/**
 * Parse a stored image value into { bucket, path }.
 * Accepts:
 *  - full Supabase publicUrl (`.../storage/v1/object/public/<bucket>/<path>`)
 *  - already-signed URL (`.../storage/v1/object/sign/<bucket>/<path>?token=...`)
 *  - bare path stored as `bucket/path/...`
 */
export function parseStoragePath(
  value: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!value) return null;
  const m = value.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  // bare path: bucket/path
  for (const b of KNOWN_BUCKETS) {
    if (value.startsWith(b + "/")) return { bucket: b, path: value.slice(b.length + 1) };
  }
  return null;
}

function publicProxyUrl(bucket: string, path: string) {
  return `/api/public/image?b=${encodeURIComponent(bucket)}&p=${encodeURIComponent(path)}`;
}

export async function getSignedUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  // External URL (not Supabase storage) — use as-is
  if (/^https?:\/\//.test(value) && !value.includes("/storage/v1/object/")) return value;
  // Product and branding assets are public catalog media. Keep public URLs
  // intact so anonymous storefront visitors do not depend on a server proxy.
  if (value.includes("/storage/v1/object/public/")) return value;
  // A previously generated signed URL is already ready to render.
  if (value.includes("/storage/v1/object/sign/")) return value;
  const parsed = parseStoragePath(value);
  if (!parsed) return value ?? null;
  const key = `${parsed.bucket}/${parsed.path}`;
  const now = Math.floor(Date.now() / 1000);
  const cached = cache.get(key);
  if (cached && cached.exp > now + 60) return cached.url;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, SIGN_TTL);
    if (!error && data?.signedUrl) {
      cache.set(key, { url: data.signedUrl, exp: now + SIGN_TTL });
      return data.signedUrl;
    }
  }

  // Signed-in signing failed or visitor is anonymous — go through the public proxy
  const proxied = publicProxyUrl(parsed.bucket, parsed.path);
  cache.set(key, { url: proxied, exp: now + SIGN_TTL });
  return proxied;
}
