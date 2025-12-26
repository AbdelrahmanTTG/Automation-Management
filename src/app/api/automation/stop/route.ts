import { NextRequest, NextResponse } from "next/server";
import { stopAutomation } from "../../../lib/stop";
import { log } from "../../../lib/logger";
import { extractIp, rateLimit } from "../../../lib/security";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user } = body;

    if (!user || !user.id || !user.name) {
      return NextResponse.json({ error: 'User object required' }, { status: 400 });
    }

    const ip = extractIp(request.headers);
    if (!rateLimit(ip, String(user.id), 10, 60_000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const result = await stopAutomation(user);
    if (result.error) {
      await log('warn', 'automation_stop_failed', { userId: user.id, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await log('info', 'automation_stopped', { userId: user.id, process: result.process });

    return NextResponse.json({ message: result.message, process: result.process });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}