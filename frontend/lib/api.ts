import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new Error('UNAUTHORIZED');
  return userId;
}

export function apiError(error: unknown) {
  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  console.error(error);
  return NextResponse.json({ detail: message }, { status: 500 });
}

export function safeFilename(value: string) {
  const name = value.split(/[\\/]/).pop()?.replace(/[^A-Za-z0-9._ -]/g, '_').trim();
  if (!name) throw new Error('Invalid filename');
  return name;
}
