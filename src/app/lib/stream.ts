
type SSEEvent = {
  event?: string;
  data: unknown;
  id?: number | string;
};

type CreateSSEStreamOptions = {
  heartbeatMs?: number;
  retryMs?: number;
  onClose?: () => void;
};

type SSEStream = {
  stream: ReadableStream<Uint8Array>;
  send: (evt: SSEEvent & { lastEventId?: number }) => void;
  close: () => void;
};

export function createSSEStream(options?: CreateSSEStreamOptions): SSEStream {
  const heartbeatMs = options?.heartbeatMs ?? 15000;
  const retryMs = options?.retryMs ?? 5000;
  const ts = new TransformStream<Uint8Array, Uint8Array>();
  const writer = ts.writable.getWriter();
  const enc = new TextEncoder();

  let closed = false;
  let lastId = 0;
  let hb: ReturnType<typeof setInterval> | null = null;

  writer.write(enc.encode(`retry: ${retryMs}\n\n`));

  const writeLine = (line: string) => {
    if (closed) return;
    writer.write(enc.encode(line));
  };

  const writeEvent = ({ event, data, id }: SSEEvent) => {
    if (closed) return;

    if (id !== undefined) {
      const nextId = Number(id);
      lastId = Number.isFinite(nextId) ? nextId : lastId + 1;
      writeLine(`id: ${lastId}\n`);
    } else {
      lastId += 1;
      writeLine(`id: ${lastId}\n`);
    }

    if (event) writeLine(`event: ${event}\n`);

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const lines = payload.split(/\r?\n/);
    for (const line of lines) {
      writeLine(`data: ${line}\n`);
    }

    writeLine(`\n`);
  };

  const send = (evt: SSEEvent & { lastEventId?: number }) => {
    if (closed) return;
    writeEvent(evt);
  };

  const startHeartbeat = () => {
    if (hb) return;
    hb = setInterval(() => {
      if (closed) return;
      writeLine(`: hb ${Date.now()}\n\n`);
    }, heartbeatMs);
  };

  startHeartbeat();

  const close = () => {
    if (closed) return;
    closed = true;
    if (hb) {
      clearInterval(hb);
      hb = null;
    }
    try {
      writer.close();
    } catch {}
    try {
      options?.onClose?.();
    } catch {}
  };

  return { stream: ts.readable, send, close };
}

export function replayFromBuffer(
  send: (evt: SSEEvent) => void,
  buffer: Array<{ event?: string; data: unknown; id?: number | string }>,
  lastEventId?: number
): void {
  if (!Array.isArray(buffer) || buffer.length === 0) return;
  for (const ev of buffer) {
    const id = typeof ev.id === 'number' ? ev.id : undefined;
    if (lastEventId !== undefined && id !== undefined && id <= lastEventId) continue;
    send({ event: ev.event, data: ev.data, id });
  }
}
