'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type DocumentItem = { filename: string };
type SourceItem = { source?: string; page?: number };
type HistoryItem = {
  question: string;
  answer: string;
  document?: string | null;
  sources?: SourceItem[];
};

export default function ResearchAssistant() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      const res = await fetch(`${API_URL}/documents`);
      if (!res.ok) throw new Error('Could not load documents');
      setDocuments(await res.json());
    } catch (_) {
      setDocuments([]);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Upload failed');
      alert(`Uploaded: ${data.filename} (${data.chunks} chunks indexed)`);
      await loadDocuments();
      setSelectedDocument(data.filename);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    const submittedQuestion = question.trim();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: submittedQuestion, source: selectedDocument }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Query failed');
      setHistory(prev => [...prev, {
        question: submittedQuestion,
        answer: data.answer,
        document: selectedDocument,
        sources: data.sources || [],
      }]);
      setQuestion('');
    } catch (err) {
      setHistory(prev => [...prev, {
        question: submittedQuestion,
        answer: err instanceof Error ? err.message : 'Error connecting to assistant.',
        document: selectedDocument,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold text-white">Research Assistant</h1>
          <p className="text-zinc-400 mt-1">Grounded document search with local RAG</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="font-semibold mb-3">Target Document</h3>
              <select
                value={selectedDocument || ''}
                onChange={(e) => setSelectedDocument(e.target.value || null)}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-2xl mb-3"
              >
                <option value="">All Documents</option>
                {documents.map((doc) => (
                  <option key={doc.filename} value={doc.filename}>{doc.filename}</option>
                ))}
              </select>
              <p className="text-xs text-zinc-500 mb-6">
                {selectedDocument ? `Retrieval is limited to ${selectedDocument}.` : 'Searching across all indexed documents.'}
              </p>

              <label className="block w-full border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-zinc-950">
                <div className="text-4xl mb-3">📄</div>
                <div className="font-medium">{uploading ? 'Uploading...' : 'Upload PDF or TXT'}</div>
                <input type="file" className="hidden" onChange={uploadFile} accept=".pdf,.txt" disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="lg:col-span-9">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-xl h-[620px] flex flex-col">
              <div className="p-6 border-b border-zinc-800 flex-1 overflow-auto">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-center">
                    Upload documents, choose a scope, and ask a question.
                  </div>
                ) : (
                  history.map((item, index) => (
                    <div key={index} className="mb-8">
                      <div className="flex justify-end mb-2">
                        <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl max-w-[70%]">{item.question}</div>
                      </div>
                      <div className="bg-zinc-800 px-5 py-5 rounded-3xl">
                        <div>{item.answer}</div>
                        {item.sources && item.sources.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-zinc-700 text-xs text-zinc-400">
                            Sources: {item.sources.map((source, i) => (
                              <span key={`${source.source}-${source.page}-${i}`} className="mr-3">
                                {source.source || 'document'}{typeof source.page === 'number' ? ` p.${source.page + 1}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-zinc-800">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && askQuestion()}
                    placeholder={selectedDocument ? `Ask about ${selectedDocument}...` : 'Ask across your documents...'}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-4 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={askQuestion}
                    disabled={loading || !question.trim()}
                    className="bg-blue-600 hover:bg-blue-700 px-10 rounded-3xl font-medium disabled:bg-zinc-700"
                  >
                    {loading ? 'Searching...' : 'Ask'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
