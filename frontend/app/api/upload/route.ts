import { del, put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { extractText, getDocumentProxy } from 'unpdf';
import { randomUUID } from 'node:crypto';

import { apiError, requireUser, safeFilename } from '@/lib/api';
import { ensureSchema, getDb } from '@/lib/db';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const form = await request.formData();
    const file = form.get('file');
    const documentKind = String(form.get('document_kind') || 'general');
    if (!(file instanceof File)) return NextResponse.json({ detail: 'Choose a file' }, { status: 400 });
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ detail: 'Files must be 4 MB or smaller' }, { status: 413 });

    const filename = safeFilename(file.name);
    const extension = filename.toLowerCase().split('.').pop();
    if (!['pdf', 'txt'].includes(extension || '')) {
      return NextResponse.json({ detail: 'Only PDF and TXT files are supported' }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let content: string;
    if (extension === 'pdf') {
      const pdf = await getDocumentProxy(bytes);
      const extracted = await extractText(pdf, { mergePages: true });
      content = extracted.text;
    } else {
      content = new TextDecoder().decode(bytes);
    }
    content = content.trim();
    if (!content) return NextResponse.json({ detail: 'No readable text was found' }, { status: 422 });

    await ensureSchema();
    const sql = getDb();
    const previous = await sql`SELECT blob_url FROM documents WHERE user_id = ${userId} AND filename = ${filename}`;
    const blob = await put(`${userId}/${randomUUID()}-${filename}`, file, { access: 'private' });
    await sql`
      INSERT INTO documents (id, user_id, filename, document_kind, blob_url, content)
      VALUES (${randomUUID()}, ${userId}, ${filename}, ${documentKind}, ${blob.url}, ${content})
      ON CONFLICT (user_id, filename) DO UPDATE SET
        document_kind = EXCLUDED.document_kind,
        blob_url = EXCLUDED.blob_url,
        content = EXCLUDED.content,
        created_at = NOW()
    `;
    if (previous[0]?.blob_url) await del(previous[0].blob_url).catch(() => undefined);
    return NextResponse.json({ status: 'success', filename, chunks: Math.max(1, Math.ceil(content.length / 3200)) });
  } catch (error) {
    return apiError(error);
  }
}
