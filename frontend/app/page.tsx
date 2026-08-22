'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Check,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  FileCheck2,
  FolderOpen,
  HelpCircle,
  Library,
  LoaderCircle,
  MessagesSquare,
  LogOut,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sparkles,
  Upload,
  WifiOff,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ContractReviewPanel } from '@/components/contract-review';
import { AuthScreen } from '@/components/auth-screen';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type DocumentItem = { filename: string };
type SourceItem = { source?: string; page?: number };
type HistoryItem = {
  question: string;
  answer: string;
  document?: string | null;
  sources?: SourceItem[];
};
type ToastState = { title: string; description: string; tone: 'success' | 'error' };
type User = { id: string; name: string; email: string; is_owner: boolean };
type DocumentKind = 'legal' | 'everyday' | 'general';

const suggestions = [
  'What does this mean in plain English?',
  'What actions do I need to take?',
  'What dates or costs should I notice?',
];

function BrandMark() {
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
      <Sparkles className="h-4 w-4" strokeWidth={2.2} />
    </div>
  );
}

function Sidebar({ documentCount, user, onLogout }: { documentCount: number; user: User; onLogout: () => void }) {
  const initials = user.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <aside className="hidden w-[244px] shrink-0 border-r border-slate-200/80 bg-white px-4 py-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-3 px-2">
        <BrandMark />
        <div>
          <p className="text-[15px] font-semibold tracking-tight text-slate-950">ReadBefore</p>
          <p className="text-[11px] font-medium text-slate-400">The fine print in plain English</p>
        </div>
      </div>

      <Button className="mt-7 h-10 justify-start gap-2 rounded-xl bg-slate-950 px-3.5 text-sm text-white shadow-sm hover:bg-slate-800">
        <Plus className="h-4 w-4" />
        New search
      </Button>

      <nav className="mt-6 space-y-1" aria-label="Main navigation">
        <NavItem icon={Search} label="Ask documents" active />
        <NavItem icon={FileCheck2} label="Contract reviews" />
        <NavItem icon={Library} label="My documents" badge={documentCount || undefined} />
        <NavItem icon={Clock3} label="Recent" />
      </nav>

      <div className="mt-7 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Workspace
      </div>
      <nav className="mt-2 space-y-1" aria-label="Workspace navigation">
        <NavItem icon={FolderOpen} label="All documents" />
        <NavItem icon={Database} label="Private library" />
      </nav>

      <div className="mt-auto space-y-1 pt-8">
        <NavItem icon={HelpCircle} label="Help & feedback" />
        <NavItem icon={Settings} label="Settings" />
        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-800">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400">{user.email}</p>
          </div>
          <button type="button" onClick={onLogout} title="Sign out" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut className="h-4 w-4" /></button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  icon: Icon,
  label,
  active = false,
  badge,
}: {
  icon: typeof Search;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
        active ? 'bg-slate-100 text-slate-950' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
      type="button"
    >
      <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function SourcePill({ source }: { source: SourceItem }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
      <FileText className="h-3 w-3 text-indigo-500" />
      {source.source || 'Document'}
      {typeof source.page === 'number' ? ` · p. ${source.page + 1}` : ''}
    </span>
  );
}

function AnswerCard({ item }: { item: HistoryItem }) {
  const uniqueSources = item.sources?.filter(
    (source, index, all) =>
      all.findIndex((candidate) => candidate.source === source.source && candidate.page === source.page) === index,
  );

  return (
    <article className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mb-5 flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-tr-md bg-slate-950 px-4 py-3 text-sm leading-6 text-white shadow-sm">
          {item.question}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-semibold text-slate-900">ReadBefore answer</p>
          <div className="whitespace-pre-wrap text-[14px] leading-7 text-slate-600">{item.answer}</div>
          {uniqueSources?.length ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Sources">
              {uniqueSources.map((source, index) => (
                <SourcePill key={`${source.source}-${source.page}-${index}`} source={source} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (suggestion: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center px-5 py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 scale-150 rounded-full bg-indigo-100/60 blur-2xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-600 shadow-lg shadow-indigo-100/70">
          <Sparkles className="h-6 w-6" />
        </div>
      </div>
      <h1 className="text-balance text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[28px]">
        Understand the fine print
      </h1>
      <p className="mt-3 max-w-md text-pretty text-sm leading-6 text-slate-500">
        Ask what any document means in everyday language. Every response stays grounded in the document you choose.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950 hover:shadow-md"
            onClick={() => onSuggestion(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ResearchAssistant() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [documentKind, setDocumentKind] = useState<DocumentKind>('legal');
  const [activeMode, setActiveMode] = useState<'ask' | 'review'>('ask');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((nextToast: ToastState) => {
    setToast(nextToast);
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/documents`, { credentials: 'include' });
      if (!response.ok) throw new Error('Could not load documents');
      setDocuments(await response.json());
      setApiOnline(true);
    } catch {
      setDocuments([]);
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    void fetch(`${API_URL}/auth/me`, { credentials: 'include' })
      .then(async (response) => response.ok ? (await response.json()).user : null)
      .then((authenticatedUser) => setUser(authenticatedUser))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => { if (user) void loadDocuments(); }, [loadDocuments, user]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, loading]);

  const uploadFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      formData.append('document_kind', documentKind);
      const response = await fetch(`${API_URL}/upload`, { method: 'POST', credentials: 'include', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');
      await loadDocuments();
      setSelectedDocument(data.filename);
      setActiveMode('review');
      showToast({
        title: 'Document ready',
        description: `${data.filename} was indexed into ${data.chunks} searchable sections.`,
        tone: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'The document could not be uploaded.',
        tone: 'error',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const askQuestion = async (overrideQuestion?: string) => {
    const submittedQuestion = (overrideQuestion ?? question).trim();
    if (!submittedQuestion || loading) return;
    setQuestion('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/query`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: submittedQuestion, source: selectedDocument, document_kind: documentKind }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Query failed');
      setHistory((previous) => [
        ...previous,
        {
          question: submittedQuestion,
          answer: data.answer,
          document: selectedDocument,
          sources: data.sources || [],
        },
      ]);
      setApiOnline(true);
    } catch (error) {
      setHistory((previous) => [
        ...previous,
        {
          question: submittedQuestion,
          answer: error instanceof Error ? error.message : 'The assistant could not be reached.',
          document: selectedDocument,
        },
      ]);
      setApiOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const selectedLabel = selectedDocument || 'All documents';

  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null); setDocuments([]); setSelectedDocument(null); setHistory([]);
  };

  if (authLoading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]"><LoaderCircle className="h-6 w-6 animate-spin text-indigo-600" /></div>;
  if (!user) return <AuthScreen apiUrl={API_URL} onAuthenticated={setUser} />;

  return (
    <div className="flex min-h-screen bg-[#f6f7f9] text-slate-950">
      <Sidebar documentCount={documents.length} user={user} onLogout={() => void logout()} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" type="button" aria-label="Open navigation">
              <PanelLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-slate-950">Understand any document</h2>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${apiOnline === false ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                {apiOnline === false ? 'Backend offline' : apiOnline === null ? 'Connecting' : 'Local AI ready'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {apiOnline === false ? (
              <span className="hidden items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 sm:flex">
                <WifiOff className="h-3.5 w-3.5" />
                Offline
              </span>
            ) : null}
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept=".pdf,.txt"
              onChange={(event) => void uploadFile(event.target.files?.[0])}
            />
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-xl border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="hidden sm:inline">{uploading ? 'Indexing…' : 'Upload document'}</span>
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 justify-center p-3 sm:p-5 lg:p-7">
          <section className="flex min-h-[calc(100vh-124px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_14px_45px_-28px_rgba(15,23,42,0.35)]">
            <div className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 sm:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <div className="relative">
                <button
                  type="button"
                  onClick={() => setDocumentMenuOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  aria-expanded={documentMenuOpen}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Library className="h-3.5 w-3.5" />
                  </span>
                  <span className="max-w-[190px] truncate">{selectedLabel}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>
                {documentMenuOpen ? (
                  <div className="absolute left-0 top-11 z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/70">
                    <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Choose a document</p>
                    <ScopeOption
                      label="All documents"
                      selected={!selectedDocument}
                      onClick={() => {
                        setSelectedDocument(null);
                        setDocumentMenuOpen(false);
                      }}
                    />
                    {documents.map((document) => (
                      <ScopeOption
                        key={document.filename}
                        label={document.filename}
                        selected={selectedDocument === document.filename}
                        onClick={() => {
                          setSelectedDocument(document.filename);
                          setDocumentMenuOpen(false);
                        }}
                      />
                    ))}
                    {!documents.length ? <p className="px-2.5 py-3 text-xs text-slate-400">Upload a document to create your library.</p> : null}
                  </div>
                ) : null}
                </div>
                <div className="flex items-center rounded-xl bg-slate-100 p-1">
                  <ModeButton
                    active={activeMode === 'ask'}
                    icon={MessagesSquare}
                    label="Ask"
                    onClick={() => setActiveMode('ask')}
                  />
                  <ModeButton
                    active={activeMode === 'review'}
                    icon={FileCheck2}
                    label="Explain"
                    onClick={() => setActiveMode('review')}
                  />
                </div>
                <select aria-label="Document type" value={documentKind} onChange={(event) => setDocumentKind(event.target.value as DocumentKind)} className="h-8 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 outline-none">
                  <option value="legal">Legal</option>
                  <option value="everyday">Everyday</option>
                  <option value="general">General</option>
                </select>
              </div>
              <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'} indexed
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12">
              {activeMode === 'review' ? (
                <ContractReviewPanel source={selectedDocument} apiUrl={API_URL} onConnectionChange={setApiOnline} />
              ) : history.length === 0 ? (
                <EmptyState onSuggestion={(suggestion) => void askQuestion(suggestion)} />
              ) : (
                <div className="mx-auto max-w-3xl space-y-10 py-10">
                  {history.map((item, index) => (
                    <AnswerCard key={`${item.question}-${index}`} item={item} />
                  ))}
                  {loading ? (
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      </div>
                      Searching your document library…
                    </div>
                  ) : null}
                  <div ref={conversationEndRef} />
                </div>
              )}
            </div>

            {activeMode === 'ask' ? (
            <div className="shrink-0 border-t border-slate-100 bg-white p-3 sm:p-5">
              <div className="mx-auto max-w-3xl">
                <div className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_30px_-16px_rgba(15,23,42,0.3)] transition-shadow focus-within:border-slate-300 focus-within:shadow-[0_10px_35px_-15px_rgba(79,70,229,0.24)]">
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void askQuestion();
                      }
                    }}
                    rows={2}
                    placeholder={`Ask ${selectedDocument ? `about ${selectedDocument}` : 'across your documents'}…`}
                    className="max-h-32 min-h-[58px] w-full resize-none bg-transparent px-3 pb-2 pt-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <div className="flex items-center justify-between px-1">
                    <button
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Add document
                    </button>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-xl bg-slate-950 text-white shadow-sm hover:bg-slate-800"
                      onClick={() => void askQuestion()}
                      disabled={!question.trim() || loading}
                      aria-label="Ask question"
                    >
                      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
                  Plain-English explanations are informational, not legal advice. Verify important details in the cited source.
                </p>
              </div>
            </div>
            ) : null}
          </section>
        </div>
      </main>

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 flex w-[min(380px,calc(100vw-40px))] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-300/40">
          <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toast.tone === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {toast.tone === 'success' ? <Check className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">{toast.title}</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">{toast.description}</p>
          </div>
          <button className="rounded-md p-1 text-slate-400 hover:bg-slate-50" onClick={() => setToast(null)} type="button" aria-label="Dismiss notification">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Search;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
      }`}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ScopeOption({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
      onClick={onClick}
    >
      <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected ? <Check className="h-3.5 w-3.5 text-indigo-600" /> : null}
    </button>
  );
}
