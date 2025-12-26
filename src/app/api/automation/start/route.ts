import { NextRequest, NextResponse } from "next/server";
import { startAutomation } from "../../../lib/start";
import { log } from "../../../lib/logger";
import { extractIp, rateLimit } from "../../../lib/security";

export async function POST(request: NextRequest) {
  try {

    const body = await request.json();
    const { scriptName, user } = body;

    if (!user || !user.id || !user.name) {
      return NextResponse.json({ error: 'User object required' }, { status: 400 });
    }

    const ip = extractIp(request.headers);
    if (!rateLimit(ip, String(user.id), 10, 60_000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    if (!scriptName || typeof scriptName !== 'string') {
      return NextResponse.json({ error: "Script name is required" }, { status: 400 });
    }

    const result = await startAutomation(user, scriptName);

    if (result.error) {
      await log('warn', 'automation_start_failed', { userId: user.id, scriptName, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await log('info', 'automation_started', { userId: user.id, scriptName, process: result.process });

    return NextResponse.json({ message: result.message, process: result.process });
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
