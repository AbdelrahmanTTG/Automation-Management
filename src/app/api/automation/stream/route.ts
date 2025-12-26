import { NextRequest } from 'next/server';
import { createSSEStream } from '@/app/lib/stream';
import { subscribe } from '@/app/lib/pm2';
import { verifyToken, validateOrigin, rateLimit, extractIp } from '@/app/lib/security';

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

export async function GET(req: NextRequest) {
    if (!validateOrigin(req.headers)) {
    return new Response('Forbidden origin', { status: 403 });
  }

  const token = req.nextUrl.searchParams.get('token') || req.cookies.get('sse_token')?.value;
  const auth = verifyToken(token);
  
  if (!auth.ok) {
    return new Response(`Unauthorized: ${auth.reason}`, { status: 401 });
  }

  const ip = extractIp(req.headers);
  if (!rateLimit(ip, auth.subject)) {
    return new Response('Too Many Requests', { status: 429 });
  }

  const processName = req.nextUrl.searchParams.get('proc');
  if (!processName) {
    return new Response('Missing proc', { status: 400 });
  }

 if (auth.subject !== processName && auth.scope !== 'admin' && auth.scope !== 'logs:all') {
    return new Response('Forbidden', { status: 403 });
  }

  const { stream, send, close } = createSSEStream({
    heartbeatMs: 15000,
    retryMs: 5000,
    onClose: () => {
      unsub?.();
    },
  });

  const lastEventIdHeader = req.headers.get('last-event-id');
  const lastEventId = lastEventIdHeader ? Number(lastEventIdHeader) : undefined;

  send({ 
    event: 'hello', 
    data: { 
      process: processName, 
      subject: auth.subject, 
      ts: Date.now() 
    } 
  });

  let unsub = null;
  
  try {
    const { unsubscribe, initial } = await subscribe(processName, ev => {
      switch (ev.type) {
        case 'log':
          send({ 
            event: 'log', 
            data: { 
              ts: ev.ts, 
              pm_id: ev.pm_id, 
              name: ev.name, 
              line: ev.data 
            } 
          });
          break;
        case 'error':
          send({ 
            event: 'error', 
            data: { 
              ts: ev.ts, 
              pm_id: ev.pm_id, 
              name: ev.name, 
              line: ev.data 
            } 
          });
          break;
        case 'status':
          send({ 
            event: 'status', 
            data: { 
              ts: ev.ts, 
              pm_id: ev.pm_id, 
              name: ev.name, 
              status: ev.status 
            } 
          });
          break;
        case 'progress':
          send({ 
            event: 'progress', 
            data: { 
              ts: ev.ts, 
              pm_id: ev.pm_id, 
              name: ev.name, 
              progress: ev.progress, 
              raw: ev.raw 
            } 
          });
          break;
      }
    });

    unsub = unsubscribe;

    for (const ev of initial) {
      if (ev.type === 'status') {
        send({ 
          event: 'status', 
          data: { 
            ts: ev.ts, 
            pm_id: ev.pm_id, 
            name: ev.name, 
            status: ev.status 
          } 
        });
      }
    }
  } catch (e) {
    close();
    return new Response(`Subscribe failed: ${e?.message || e}`, { status: 400 });
  }

  const signal = req.signal;
  signal.addEventListener('abort', () => {
    close();
  });

  return new Response(stream, { headers: sseHeaders() });
}