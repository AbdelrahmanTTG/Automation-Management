
// ===== security.ts =====
import crypto from 'crypto';

const SECRET = process.env.INTERNAL_SSE_SECRET || '';
const TOKEN_VERSION = '1';

// Enforce secrets in production; fail fast
if (process.env.NODE_ENV === 'production') {
  if (!process.env.INTERNAL_SSE_SECRET) {
    throw new Error('[SECURITY] INTERNAL_SSE_SECRET is required in production.');
  }
} else {
  if (!process.env.INTERNAL_SSE_SECRET) {
    console.warn('[SECURITY] Using ephemeral SECRET in non-production. Set INTERNAL_SSE_SECRET in production.');
  }
}

const EFFECTIVE_SECRET = SECRET || crypto.randomBytes(32).toString('hex');

const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

const RATE_LIMITS = {
  strict: { limit: 10, window: 60_000 },
  normal: { limit: 40, window: 60_000 },
  relaxed: { limit: 100, window: 60_000 },
};

interface TokenPayload {
  subject: string;
  exp: number;
  version: string;
  scope?: string;
}

export function signToken(
  subject: string, 
  ttlMs: number = 10 * 60 * 1000,
  scope: string = 'default'
): string {
  if (!subject || typeof subject !== 'string') {
    throw new Error('Invalid subject');
  }

  const payload: TokenPayload = {
    subject: subject.substring(0, 256),
    exp: Date.now() + ttlMs,
    version: TOKEN_VERSION,
    scope,
  };

  const base = JSON.stringify(payload);
  const hmac = crypto
    .createHmac('sha256', EFFECTIVE_SECRET)
    .update(base)
    .digest('base64url');

  return `${Buffer.from(base).toString('base64url')}.${hmac}`;
}

export function verifyToken(token: string | null | undefined): {
  ok: boolean;
  reason?: string;
  subject?: string;
  scope?: string;
} {
  if (!token) return { ok: false, reason: 'missing-token' };

  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { ok: false, reason: 'malformed-token' };
    }

    const [payloadB64, hmac] = parts;
    // Enforce base64url length
    if (payloadB64.length > 4096 || hmac.length > 128) {
      return { ok: false, reason: 'token-too-large' };
    }

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    // Enforce payload size limit before parsing
    if (payloadStr.length > 4096) {
      return { ok: false, reason: 'payload-too-large' };
    }
    const payload: TokenPayload = JSON.parse(payloadStr);

    const expected = crypto
      .createHmac('sha256', EFFECTIVE_SECRET)
      .update(payloadStr)
      .digest('base64url');

    if (!crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(hmac)
    )) {
      return { ok: false, reason: 'bad-signature' };
    }

    if (Date.now() > payload.exp) {
      return { ok: false, reason: 'expired' };
    }

    if (payload.version !== TOKEN_VERSION) {
      return { ok: false, reason: 'invalid-version' };
    }

    return {
      ok: true,
      subject: payload.subject,
      scope: payload.scope,
    };
  } catch (err) {
    return { ok: false, reason: 'parse-error' };
  }
}

export function validateOrigin(headers: Headers): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const origin = headers.get('origin') || headers.get('referer') || '';
  if (!origin) return false;

  try {
    const u = new URL(origin);
    const simpleOrigin = `${u.protocol}//${u.host}`;
    return ALLOWED_ORIGINS.has(simpleOrigin);
  } catch {
    return false;
  }
}

interface RateLimitEntry {
  count: number;
  windowStart: number;
  blocked: boolean;
  blockUntil?: number;
  lastSeen: number;
}

// Bounded LRU-like maps to prevent unbounded memory growth
const ipCounters = new Map<string, RateLimitEntry>();
const subjectCounters = new Map<string, RateLimitEntry>();
const MAX_RATE_KEYS = Math.max(5000, Number(process.env.RATE_LIMIT_MAX_KEYS || 10000));

const BLOCK_DURATION = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 10 * 60 * 1000;

function ensureCapacity(counter: Map<string, RateLimitEntry>) {
  while (counter.size > MAX_RATE_KEYS) {
    const oldestKey = counter.keys().next().value;
    counter.delete(oldestKey);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipCounters.entries()) {
    if (now - entry.lastSeen > CLEANUP_INTERVAL) {
      ipCounters.delete(key);
    }
  }
  for (const [key, entry] of subjectCounters.entries()) {
    if (now - entry.lastSeen > CLEANUP_INTERVAL) {
      subjectCounters.delete(key);
    }
  }
  ensureCapacity(ipCounters);
  ensureCapacity(subjectCounters);
}, CLEANUP_INTERVAL);

export function rateLimit(
  ip: string,
  subject: string,
  limit: number = 40,
  windowMs: number = 60_000
): boolean {
  const now = Date.now();

  const checkCounter = (
    counter: Map<string, RateLimitEntry>,
    key: string
  ): boolean => {
    let entry = counter.get(key);

    if (!entry) {
      entry = { count: 0, windowStart: now, blocked: false, lastSeen: now };
      counter.set(key, entry);
      ensureCapacity(counter);
    }

    entry.lastSeen = now;

    if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
      return false;
    }

    if (entry.blocked && entry.blockUntil && now >= entry.blockUntil) {
      entry.blocked = false;
      entry.count = 0;
      entry.windowStart = now;
      delete entry.blockUntil;
    }

    if (now - entry.windowStart > windowMs) {
      entry.windowStart = now;
      entry.count = 0;
    }

    entry.count += 1;

    if (entry.count > limit * 2) {
      entry.blocked = true;
      entry.blockUntil = now + BLOCK_DURATION;
      return false;
    }

    return entry.count <= limit;
  };

  const ipOk = checkCounter(ipCounters, ip || 'unknown');
  const subjectOk = checkCounter(subjectCounters, subject || 'unknown');

  return ipOk && subjectOk;
}

export function extractIp(headers: Headers): string {
  const candidates = [
    headers.get('x-real-ip'),
    headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    headers.get('cf-connecting-ip'),
  ];

  for (const ip of candidates) {
    if (ip && isValidIp(ip)) return ip;
  }

  return 'unknown';
}

function isValidIp(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export function sanitizeProcessName(name: string): string {
  return name
    .replace(/[,\s]+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 64);
}

export function sanitizeUserId(id: string | number): string {
  return String(id)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .substring(0, 32);
}

export function createProcessName(userName: string, userId: string | number): string {
  const safeName = sanitizeProcessName(userName);
  const safeId = sanitizeUserId(userId);
  
  if (!safeName || !safeId) {
    throw new Error('Invalid user name or ID');
  }
  
  return `${safeName}_${safeId}`;
}
