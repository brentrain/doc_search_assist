'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  FileSearch,
  ListChecks,
  LoaderCircle,
  Scale,
  ShieldAlert,
  Sparkles,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

type KeyTerm = { label: string; value: string; explanation: string; page?: number };
type ImportantDate = { label: string; value: string; explanation: string; page?: number };
type Obligation = { who: string; must_do: string; when: string; page?: number };
type Concern = {
  severity: 'low' | 'medium' | 'high';
  title: string;
  explanation: string;
  question_to_ask: string;
  page?: number;
};

type ContractReview = {
  document_type: string;
  plain_summary: string;
  parties: string[];
  key_terms: KeyTerm[];
  important_dates: ImportantDate[];
  obligations: Obligation[];
  concerns: Concern[];
  questions_to_ask: string[];
  missing_or_unclear: string[];
};

type ReviewResponse = {
  source: string;
  review: ContractReview;
  pages_reviewed: number[];
  disclaimer: string;
};

function PageReference({ page }: { page?: number }) {
  return typeof page === 'number' ? (
    <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
      Page {page}
    </span>
  ) : null;
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-slate-950">{title}</h3>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function severityStyle(severity: Concern['severity']) {
  if (severity === 'high') return 'border-rose-200 bg-rose-50/70 text-rose-700';
  if (severity === 'medium') return 'border-amber-200 bg-amber-50/70 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export function ContractReviewPanel({
  source,
  apiUrl,
  onConnectionChange,
}: {
  source: string | null;
  apiUrl: string;
  onConnectionChange: (online: boolean) => void;
}) {
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!source || analyzing) return;
    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/review-contract`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'The review could not be completed.');
      setResult(data);
      onConnectionChange(true);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'The review could not be completed.');
      onConnectionChange(false);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!source) {
    return (
      <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm">
          <FileSearch className="h-6 w-6" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-slate-950">See what matters before you act</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Select a legal document above. ReadBefore will explain the important language in everyday words.
        </p>
        <div className="mt-6 grid w-full grid-cols-2 gap-2 text-left">
          {['Key terms and dates', 'Your responsibilities', 'Things to look closer at', 'Questions worth asking'].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] font-medium text-slate-600 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              {item}
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
          <Scale className="h-3.5 w-3.5" />
          Explanations are informational and are not legal advice.
        </p>
      </div>
    );
  }

  if (!result || result.source !== source) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-indigo-100 blur-2xl" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-600 shadow-lg shadow-indigo-100">
            <ClipboardCheck className="h-6 w-6" />
          </div>
        </div>
        <span className="mt-6 rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">Selected document</span>
        <h1 className="mt-3 max-w-md truncate text-xl font-semibold tracking-[-0.025em] text-slate-950">{source}</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
          Get a plain-English overview of what this document says, what you may be agreeing to, and what deserves a closer look.
        </p>
        <Button
          className="mt-7 h-10 gap-2 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white hover:bg-slate-800"
          onClick={() => void analyze()}
          disabled={analyzing}
        >
          {analyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {analyzing ? 'Reading your document…' : 'Explain this document'}
        </Button>
        {analyzing ? <p className="mt-3 text-[11px] text-slate-400">This can take a minute with a local model.</p> : null}
        {error ? (
          <div className="mt-5 flex max-w-md items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-left text-[11px] leading-5 text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  const review = result.review;

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-7 sm:py-9">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-lg shadow-slate-200 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-300">Plain-English review</p>
            <h1 className="mt-2 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{review.document_type || 'Legal document'}</h1>
            <p className="mt-1 max-w-xl truncate text-xs text-slate-400">{result.source}</p>
          </div>
          <span className="rounded-lg border border-white/10 bg-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300">
            {result.pages_reviewed.length} pages referenced
          </span>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-200">{review.plain_summary}</p>
        {review.parties?.length ? (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <Users className="h-3.5 w-3.5 text-indigo-300" />
            {review.parties.map((party) => (
              <span key={party} className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-medium text-slate-200">{party}</span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader icon={ListChecks} title="Important terms" description="The main parts of the agreement and why they matter." />
          <div className="divide-y divide-slate-100">
            {review.key_terms?.map((term) => (
              <div key={`${term.label}-${term.page}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-900">{term.label}</p>
                  <PageReference page={term.page} />
                </div>
                <p className="mt-1 text-sm font-medium text-indigo-700">{term.value}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{term.explanation}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader icon={CalendarDays} title="Dates and deadlines" description="Timing that could affect your rights or responsibilities." />
          {review.important_dates?.length ? (
            <div className="space-y-2.5">
              {review.important_dates.map((date) => (
                <div key={`${date.label}-${date.page}`} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-slate-900">{date.label}</p>
                    <PageReference page={date.page} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-indigo-700">{date.value}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">{date.explanation}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-xs leading-5 text-slate-400">No specific dates were clearly identified.</p>}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader icon={ClipboardCheck} title="What each person must do" description="Responsibilities described in the document, translated into plain language." />
        <div className="grid gap-3 sm:grid-cols-2">
          {review.obligations?.map((obligation, index) => (
            <div key={`${obligation.who}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{obligation.who}</span>
                <PageReference page={obligation.page} />
              </div>
              <p className="mt-2 text-xs font-medium leading-5 text-slate-800">{obligation.must_do}</p>
              <p className="mt-2 text-[10px] font-medium text-indigo-600">When: {obligation.when}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader icon={ShieldAlert} title="Things to look at more closely" description="Not legal conclusions—just terms that may have an important practical effect." />
        {review.concerns?.length ? (
          <div className="space-y-3">
            {review.concerns.map((concern, index) => (
              <div key={`${concern.title}-${index}`} className={`rounded-xl border p-4 ${severityStyle(concern.severity)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p className="text-xs font-semibold">{concern.title}</p>
                  </div>
                  <PageReference page={concern.page} />
                </div>
                <p className="mt-2 text-[11px] leading-5 opacity-90">{concern.explanation}</p>
                <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-[11px] font-medium leading-5 text-slate-700">
                  Ask: “{concern.question_to_ask}”
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            No specific concerns were identified from the available text.
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader icon={CircleHelp} title="Questions worth asking" description="Useful conversation starters before you sign or take action." />
          <ol className="space-y-3">
            {review.questions_to_ask?.map((question, index) => (
              <li key={question} className="flex gap-3 text-xs leading-5 text-slate-600">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-600">{index + 1}</span>
                {question}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader icon={CircleHelp} title="Missing or unclear" description="Information the review could not confidently find or interpret." />
          {review.missing_or_unclear?.length ? (
            <ul className="space-y-2.5">
              {review.missing_or_unclear.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-5 text-slate-600">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                  {item}
                </li>
              ))}
            </ul>
          ) : <p className="text-xs leading-5 text-slate-400">Nothing significant was marked as missing or unclear.</p>}
        </section>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-[11px] leading-5 text-indigo-800">
        <Scale className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">A helpful explanation—not a legal opinion</p>
          <p className="mt-0.5 text-indigo-700/80">{result.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
