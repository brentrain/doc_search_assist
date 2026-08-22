import { generateText } from 'ai';
import { NextResponse } from 'next/server';

import { apiError, requireUser } from '@/lib/api';
import { ensureSchema, getDb } from '@/lib/db';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const { question, source, document_kind: documentKind = 'general' } = await request.json();
    if (!String(question || '').trim()) return NextResponse.json({ detail: 'Question is required' }, { status: 400 });
    await ensureSchema();
    const sql = getDb();
    const documents = source
      ? await sql`SELECT filename, content FROM documents WHERE user_id = ${userId} AND filename = ${source} LIMIT 1`
      : await sql`SELECT filename, content FROM documents WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 8`;
    if (!documents.length) return NextResponse.json({ answer: 'Upload a document first so I have something to explain.', sources: [] });
    const context = documents.map((document) => `[Document: ${document.filename}]\n${document.content}`).join('\n\n').slice(0, 50000);
    const guidance: Record<string, string> = {
      legal: 'Explain legal language cautiously in plain English. Do not give legal advice.',
      everyday: 'Explain bills, policies, notices, instructions, or letters in practical everyday language.',
      general: 'Explain the material clearly for a non-expert reader.',
    };
    const { text } = await generateText({
      model: 'openai/gpt-5.4-mini',
      prompt: `Answer only from the supplied documents. If unsupported, say it was not found. ${guidance[documentKind] || guidance.general}\n\n${context}\n\nQuestion: ${question}`,
      providerOptions: { gateway: { user: userId, tags: ['feature:document-qa'] } },
    });
    return NextResponse.json({ answer: text, sources: documents.map((document) => ({ source: document.filename })) });
  } catch (error) {
    return apiError(error);
  }
}
