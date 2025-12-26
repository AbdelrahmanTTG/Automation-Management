
// ===== proxy.ts =====
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import pako from "pako";

// Simple bounded TTL cache keyed by token (LRU-ish via insertion order eviction)
type CacheEntry = { expiresAt: number; routes: string[] };
const PERM_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = Math.max(10_000, Number(process.env.PERM_CACHE_TTL_MS || 30_000)); // default 30s
const CACHE_MAX_ENTRIES = Math.max(10, Number(process.env.PERM_CACHE_MAX || 200));

// Strict limits to avoid decompression/JSON parsing abuse on hot path
const MAX_COMPRESSED_BASE64_BYTES = Math.max(32_768, Number(process.env.MAX_COMPRESSED_B64_BYTES || 512_000)); // 512KB
const MAX_DECOMPRESSED_JSON_BYTES = Math.max(65_536, Number(process.env.MAX_DECOMPRESSED_JSON_BYTES || 2_000_000)); // 2MB
const MAX_ROUTES = Math.max(100, Number(process.env.MAX_ROUTES || 5000));

// Evict oldest if cache exceeds bounds
function cacheSet(key: string, value: CacheEntry) {
  if (PERM_CACHE.size >= CACHE_MAX_ENTRIES) {
    const firstKey = PERM_CACHE.keys().next().value;
    if (firstKey) PERM_CACHE.delete(firstKey);
  }
  PERM_CACHE.set(key, value);
}

function cacheGetValid(key: string): string[] | null {
  const e = PERM_CACHE.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    PERM_CACHE.delete(key);
    return null;
  }
  return e.routes;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/^\/+/, "");

  // Fail fast for required env in production to ensure secure defaults
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ACCESS_TOKEN_NAME) {
      console.error("[proxy] Missing ACCESS_TOKEN_NAME in production");
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!process.env.API_BASE_URL) {
      console.error("[proxy] Missing API_BASE_URL in production");
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const publicPaths = ["login", "unauthorized"];
  const publicExtensions = [".png", ".jpg", ".jpeg", ".svg", ".gif", ".css", ".js", ".ico"];

  if (
    publicPaths.includes(pathname) ||
    publicExtensions.some(ext => pathname.endsWith(ext))
  ) {
    return NextResponse.next();
  }

  const tokenName = process.env.ACCESS_TOKEN_NAME;
  if (!tokenName) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const token = request.cookies.get(tokenName)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check cache first
  const cachedRoutes = cacheGetValid(token);
  if (cachedRoutes && cachedRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  const apiUrl = process.env.API_BASE_URL;
  if (!apiUrl) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Fetch with timeout & AbortController to avoid slow external dependency on hot path
  const controller = new AbortController();
  const timeoutMs = Math.max(2000, Number(process.env.PERM_FETCH_TIMEOUT_MS || 5000));
  const t = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/perm`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    clearTimeout(t);
    console.error("[proxy] fetch /api/perm failed:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let resData: any;
  try {
    // Enforce strict size limits before parsing JSON (Response.json() buffers entire body).
    // We read as text and bound length, then JSON.parse safely.
    const MAX_JSON_TEXT_BYTES = Math.max(32_768, Number(process.env.MAX_PERM_JSON_BYTES || 512_000)); // 512KB
    const reader = (res.body as any)?.getReader?.();
    if (reader && typeof reader.read === "function") {
      let total = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength || 0;
        if (total > MAX_JSON_TEXT_BYTES) {
          throw new Error("perm-response-too-large");
        }
        chunks.push(value);
      }
      const merged = chunks.length === 1 ? chunks[0] : Uint8Array.from(chunks.flatMap(c => Array.from(c)));
      const text = new TextDecoder("utf-8", { fatal: false }).decode(merged);
      resData = JSON.parse(text);
    } else {
      // Fallback to .text() with a post-size check
      const text = await res.text();
      if (text.length > MAX_JSON_TEXT_BYTES) throw new Error("perm-response-too-large");
      resData = JSON.parse(text);
    }
  } catch (err) {
    console.error("[proxy] Failed to parse API response:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let dataArray: any[] = [];

  try {
    if (resData.data && typeof resData.data === "string") {
      const compressedBase64: string = resData.data;

      if (compressedBase64.length > MAX_COMPRESSED_BASE64_BYTES) {
        throw new Error("compressed-data-too-large");
      }

      const compressed = Uint8Array.from(atob(compressedBase64), c => c.charCodeAt(0));
      // Decompress & enforce string size limit before JSON.parse
      const decompressed = pako.inflate(compressed, { to: "string" });
      if (decompressed.length > MAX_DECOMPRESSED_JSON_BYTES) {
        throw new Error("decompressed-json-too-large");
      }
      const parsed = JSON.parse(decompressed);
      if (!Array.isArray(parsed)) {
        throw new Error("decompressed-json-not-array");
      }
      dataArray = parsed.slice(0, MAX_ROUTES);
    } else if (Array.isArray(resData.data)) {
      dataArray = resData.data.slice(0, MAX_ROUTES);
    } else {
      dataArray = [];
    }
  } catch (err) {
    console.error("[proxy] Failed to decompress/parse API response:", err);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const allowedRoutes: string[] = dataArray.map((r: any) => String(r?.url || "")).filter(Boolean);

  // Update cache
  cacheSet(token, { expiresAt: Date.now() + CACHE_TTL_MS, routes: allowedRoutes });

  if (!allowedRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|assets/|login|unauthorized).*)",
  ],
};
