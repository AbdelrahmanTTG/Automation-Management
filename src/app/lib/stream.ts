export function createSSEStream(options) {
  const heartbeatMs = options?.heartbeatMs ?? 15000;
  const retryMs = options?.retryMs ?? 5000;
  const ts = new TransformStream();
  const writer = ts.writable.getWriter();
  const enc = new TextEncoder();

  let closed = false;
  let lastId = 0;
  let hb = null;

  writer.write(enc.encode(`retry: ${retryMs}\n\n`));

  function writeLine(line) {
    return writer.write(enc.encode(line));
  }

  function writeEvent({ event, data, id }) {
    if (closed) return;

    if (id !== undefined) {
      lastId = Number(id) || (lastId + 1);
      writeLine(`id: ${lastId}\n`);
    } else {
      lastId += 1;
      writeLine(`id: ${lastId}\n`);
    }

    if (event) writeLine(`event: ${event}\n`);

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const line of payload.split(/\r?\n/)) {
      writeLine(`data: ${line}\n`);
    }

    writeLine(`\n`);
  }

  function send(evt) {
    writeEvent(evt);
  }

  function startHeartbeat() {
    hb = setInterval(() => {
      if (closed) return;
      writeLine(`: hb ${Date.now()}\n\n`);
    }, heartbeatMs);
  }

  startHeartbeat();

  function close() {
    closed = true;
    if (hb) clearInterval(hb);
    writer.close();
    options?.onClose?.();
  }

  return { stream: ts.readable, send, close };
}

export function replayFromBuffer(send, buffer, lastEventId) {
  if (!buffer.length) return;

  for (const ev of buffer) {
    const id = typeof ev.id === 'number' ? ev.id : undefined;
    if (lastEventId !== undefined && id !== undefined && id <= lastEventId) continue;
    send({ event: ev.event, data: ev.data, id });
  }
}