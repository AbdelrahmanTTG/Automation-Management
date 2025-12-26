
import { NextRequest } from 'next/server';

export interface AuthUser {
  id: string | number;
  name: string;
  roles?: string[];
}

export async function requireAuth(_request: NextRequest, _requireRole?: string): Promise<AuthUser> {
  const err: any = new Error('Server-side auth is disabled. Provide `user` in request body (e.g. { user: { id, name } }).');
  err.status = 501;
  throw err;
}

