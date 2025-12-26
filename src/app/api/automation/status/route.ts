import { NextRequest, NextResponse } from "next/server";
import { statusAutomation } from "../../../lib/status";
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
    if (!rateLimit(ip, String(user.id), 60, 60_000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    const result = await statusAutomation(user);

    await log('info', 'automation_status', { userId: user.id, result });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error?.status || 500;
    const message = error?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
