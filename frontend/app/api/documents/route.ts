import { NextResponse } from 'next/server';

import { apiError, requireUser } from '@/lib/api';
import { ensureSchema, getDb } from '@/lib/db';

export async function GET() {
  try {
    const userId = await requireUser();
    await ensureSchema();
    const sql = getDb();
    const documents = await sql`
      SELECT filename, document_kind FROM documents
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(documents);
  } catch (error) {
    return apiError(error);
  }
}
