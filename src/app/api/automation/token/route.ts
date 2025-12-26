import { NextResponse } from 'next/server';
import { signToken, validateOrigin, extractIp, rateLimit } from '@/app/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!validateOrigin(req.headers)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  const ip = extractIp(req.headers);
  const subject = req.headers.get('x-user-id') || 'dev-user';

  if (!rateLimit(ip, subject, 20, 60_000)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const token = signToken(subject, 10 * 60 * 1000);

  const response = NextResponse.json({ token, subject });

  response.cookies.set('sse_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 10 * 60,
  });

  return response;
}