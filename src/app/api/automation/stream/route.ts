export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { streamPm2Logs } from "@/app/lib/status-stream";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const processName = searchParams.get("process");

  if (!processName) {
    return new Response("process name is required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (log: string) => {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ log })}\n\n`
          )
        );
      };

      const pm2Process = streamPm2Logs(processName, send);

      req.signal.addEventListener("abort", () => {
        pm2Process.kill();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
