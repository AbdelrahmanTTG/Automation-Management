
// ===== route.ts (SSE) =====
import { NextRequest } from 'next/server';
import { createSSEStream } from '@/app/lib/stream';
import { verifyToken, validateOrigin, rateLimit, extractIp } from '@/app/lib/security';
import { subscribeToAllProcesses } from '@/app/lib/pm2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sseHeaders() {
  return new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

// Global SSE connection caps to protect scaling
const MAX_GLOBAL_SSE = Math.max(10, Number(process.env.MAX_GLOBAL_SSE || 500));
const MAX_SUBJECT_SSE = Math.max(1, Number(process.env.MAX_SUBJECT_SSE || 5));
let globalSseCount = 0;
const subjectSseCounters = new Map<string, { count: number; lastSeen: number }>();
const SUBJECT_COUNTER_TTL = Math.max(60_000, Number(process.env.SUBJECT_COUNTER_TTL || 10 * 60_000));
const SUBJECT_MAX_ENTRIES = Math.max(1000, Number(process.env.SUBJECT_COUNTER_MAX || 5000));

// Periodic cleanup to bound subject map size
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of subjectSseCounters.entries()) {
    if (now - v.lastSeen > SUBJECT_COUNTER_TTL) {
      subjectSseCounters.delete(k);
    }
  }
  // Trim if oversized
while (subjectSseCounters.size > SUBJECT_MAX_ENTRIES) {
  const it = subjectSseCounters.keys().next();
  if (it.done || !it.value) break;
  subjectSseCounters.delete(it.value);
}
}, SUBJECT_COUNTER_TTL);

export async function GET(req: NextRequest) {
  if (!validateOrigin(req.headers)) {
    return new Response('Forbidden origin', { status: 403 });
  }

  const token = req.nextUrl.searchParams.get('token') || req.cookies.get('sse_token')?.value;
  const auth = verifyToken(token);
  if (!auth.ok) {
    return new Response(`Unauthorized: ${auth.reason}`, { status: 401 });
  }

  // Global connection cap
  if (globalSseCount >= MAX_GLOBAL_SSE) {
    return new Response('SSE capacity reached', { status: 503 });
  }
  // Per-subject cap
  const subjKey = String(auth.subject || 'unknown');
  const subjEntry = subjectSseCounters.get(subjKey) || { count: 0, lastSeen: Date.now() };
  if (subjEntry.count >= MAX_SUBJECT_SSE) {
    return new Response('Too many connections for subject', { status: 429 });
  }

  const ip = extractIp(req.headers);
  if (!rateLimit(ip, subjKey)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const { stream, send, close } = createSSEStream({
    heartbeatMs: 15000,
    retryMs: 5000,
    onClose: () => {
      unsub?.();
    },
  });

  // Track active connections
  globalSseCount += 1;
  subjEntry.count += 1;
  subjEntry.lastSeen = Date.now();
  subjectSseCounters.set(subjKey, subjEntry);

  send({
    event: 'hello',
    data: {
      subject: auth.subject,
      ts: Date.now(),
    },
  });

  let unsub: (() => void) | null = null;

  try {
    const { unsubscribe, getProcessesStats, getLatestStats } = await subscribeToAllProcesses((stats) => {
      send({
        event: 'processes',
        data: stats,
      });
    });

    unsub = () => {
      try {
        unsubscribe();
      } catch {}
    };

    const initialStats = (await getLatestStats()) ?? (await getProcessesStats());
    send({
      event: 'processes',
      data: initialStats,
    });
  } catch (e: any) {
    try { close(); } catch {}
    // Cleanup counters on failure
    globalSseCount = Math.max(0, globalSseCount - 1);
    subjEntry.count = Math.max(0, subjEntry.count - 1);
    subjEntry.lastSeen = Date.now();
    subjectSseCounters.set(subjKey, subjEntry);
    return new Response(`Subscribe failed: ${e?.message || String(e)}`, { status: 400 });
  }

  const signal = (req as any).signal;
  if (signal && typeof signal.addEventListener === 'function') {
    signal.addEventListener('abort', () => {
      try {
        close();
      } finally {
        try { unsub?.(); } catch {}
        // Ensure proper cleanup on disconnect
        globalSseCount = Math.max(0, globalSseCount - 1);
        const cur = subjectSseCounters.get(subjKey);
        if (cur) {
          cur.count = Math.max(0, cur.count - 1);
          cur.lastSeen = Date.now();
          subjectSseCounters.set(subjKey, cur);
        }
      }
    });
  }

  return new Response(stream, { headers: sseHeaders() });
}

// Remove local unhandledRejection handler to avoid duplicates; server.mjs sets the single global handler
