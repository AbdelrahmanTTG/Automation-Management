
import { NextRequest, NextResponse } from 'next/server';
import { signToken, validateOrigin, extractIp, rateLimit } from '@/app/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!validateOrigin(req.headers)) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  }

  const ip = extractIp(req.headers);
  const subjectHeader = req.headers.get('x-user-id');
  const subject = subjectHeader && subjectHeader.trim() !== '' ? subjectHeader : 'dev-user';

  if (!rateLimit(ip, subject, 20, 60_000)) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  const ttlMs = 10 * 60 * 1000;
  const token = signToken(subject, ttlMs);

  const res = NextResponse.json({ token, subject });

  res.cookies.set('sse_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: Math.floor(ttlMs / 1000),
    path: '/',
  });

  return res;
}
