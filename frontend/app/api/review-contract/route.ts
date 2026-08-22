import { generateText, Output } from 'ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiError, requireUser } from '@/lib/api';
import { ensureSchema, getDb } from '@/lib/db';

export const maxDuration = 60;

const referenced = z.object({ label: z.string(), value: z.string(), explanation: z.string(), page: z.number().optional() });
const reviewSchema = z.object({
  document_type: z.string(), plain_summary: z.string(), parties: z.array(z.string()),
  key_terms: z.array(referenced), important_dates: z.array(referenced),
  obligations: z.array(z.object({ who: z.string(), must_do: z.string(), when: z.string(), page: z.number().optional() })),
  concerns: z.array(z.object({ severity: z.enum(['low', 'medium', 'high']), title: z.string(), explanation: z.string(), question_to_ask: z.string(), page: z.number().optional() })),
  questions_to_ask: z.array(z.string()), missing_or_unclear: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const userId = await requireUser();
    const { source } = await request.json();
    await ensureSchema();
    const sql = getDb();
    const rows = await sql`SELECT filename, content FROM documents WHERE user_id = ${userId} AND filename = ${source} LIMIT 1`;
    if (!rows.length) return NextResponse.json({ detail: 'Document not found' }, { status: 404 });
    const { output } = await generateText({
      model: 'openai/gpt-5.4-mini',
      output: Output.object({ schema: reviewSchema }),
      prompt: `Explain this document for an everyday person. Use plain English, remain neutral, do not give legal advice, and do not invent facts. Keep each list concise.\n\nDocument: ${rows[0].filename}\n\n${String(rows[0].content).slice(0, 50000)}`,
      providerOptions: { gateway: { user: userId, tags: ['feature:document-review'] } },
    });
    return NextResponse.json({ source, review: output, pages_reviewed: [], disclaimer: 'This is an AI-generated explanation, not legal advice. Important decisions should be reviewed with a qualified professional.' });
  } catch (error) {
    return apiError(error);
  }
}
