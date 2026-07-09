'use client';

import { useState, useEffect } from 'react';

export default function ResearchAssistant() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      const res = await fetch('http://localhost:8000/documents');
      const data = await res.json();
      setDocuments(data);
    } catch (_) {}
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
      await fetch('http://localhost:8000/upload', { method: 'POST', body: formData });
      alert(`✅ Uploaded: ${file.name}`);
      loadDocuments();
    } catch (err) {
      alert('Upload failed');
    }
    setUploading(false);
  };

  const askQuestion = async () => {
    if (!question.trim()) return;
    setLoading(true);

    let fullQuestion = question;
    if (selectedDocument) {
      fullQuestion = `From document "${selectedDocument}": ${question}`;
    }

    try {
      const res = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: fullQuestion }),
      });
      const data = await res.json();
      setHistory(prev => [...prev, { 
        question, 
        answer: data.answer,
        document: selectedDocument 
      }]);
    } catch (err) {
      setHistory(prev => [...prev, { question, answer: "Error connecting to assistant." }]);
    }

    setLoading(false);
    setQuestion('');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-semibold text-white">Research Assistant</h1>
            <p className="text-zinc-400 mt-1">Targeted Document Search</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6">
              <h3 className="font-semibold mb-3">Target Document</h3>
              <select 
                value={selectedDocument || ''}
                onChange={(e) => setSelectedDocument(e.target.value || null)}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-2xl mb-6"
              >
                <option value="">All Documents</option>
                {documents.map((doc, i) => (
                  <option key={i} value={doc.filename}>{doc.filename}</option>
                ))}
              </select>

              <label className="block w-full border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-zinc-950">
                <div className="text-4xl mb-3">📄</div>
                <div className="font-medium">{uploading ? 'Uploading...' : 'Upload New Document'}</div>
                <input type="file" className="hidden" onChange={uploadFile} accept=".pdf,.txt" />
              </label>
            </div>
          </div>

          <div className="col-span-9">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-xl h-[620px] flex flex-col">
              <div className="p-6 border-b border-zinc-800 flex-1 overflow-auto">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-center">
                    Select a document above and ask questions
                  </div>
                ) : (
                  history.map((item, index) => (
                    <div key={index} className="mb-8">
                      <div className="flex justify-end mb-2">
                        <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl max-w-[70%]">
                          {item.question}
                        </div>
                      </div>
                      <div className="bg-zinc-800 px-5 py-5 rounded-3xl">
                        {item.answer}
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
                    onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                    placeholder="Ask about the selected document..."
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