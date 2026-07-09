'use client';

import { useState, useEffect } from 'react';

const AVAILABLE_MODELS = [
  { value: "llama3.2", label: "Llama 3.2 (Fast)" },
  { value: "qwen2.5", label: "Qwen2.5 (Strong)" },
  { value: "llama3.1:8b", label: "Llama 3.1 8B" },
];

export default function ResearchAssistant() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("llama3.2");

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
    try {
      const res = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, model: selectedModel }),
      });
      const data = await res.json();
      setHistory(prev => [...prev, { question, answer: data.answer, model: selectedModel }]);
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
            <p className="text-zinc-400 mt-1">Local AI • Document Intelligence</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-3">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl">
              <h3 className="font-semibold text-lg mb-4 text-zinc-100">AI Model</h3>
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-2xl mb-6 text-white"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              <h3 className="font-semibold text-lg mb-4 text-zinc-100">Documents ({documents.length})</h3>
              <label className="block w-full border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-2xl p-8 text-center cursor-pointer transition-colors mb-6 bg-zinc-950">
                <div className="text-4xl mb-3">📄</div>
                <div className="font-medium text-zinc-300">{uploading ? 'Uploading...' : 'Upload PDF or TXT'}</div>
                <input type="file" className="hidden" onChange={uploadFile} accept=".pdf,.txt" />
              </label>

              <div className="space-y-2 max-h-80 overflow-auto">
                {documents.map((doc, i) => (
                  <div key={i} className="p-3 bg-zinc-800 rounded-2xl text-sm flex items-center gap-2">
                    📘 {doc.filename}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-9">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl shadow-xl h-[620px] flex flex-col">
              <div className="p-6 border-b border-zinc-800 flex-1 overflow-auto">
                {history.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🔬</div>
                      <p className="text-xl">Upload documents and start researching</p>
                    </div>
                  </div>
                ) : (
                  history.map((item, index) => (
                    <div key={index} className="mb-8">
                      <div className="flex justify-end mb-3">
                        <div className="bg-blue-600 text-white px-5 py-3 rounded-3xl max-w-[70%]">
                          {item.question}
                        </div>
                      </div>
                      <div className="bg-zinc-800 px-5 py-5 rounded-3xl max-w-[85%]">
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
                    placeholder="Ask a research question..."
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-3xl px-6 py-4 focus:outline-none focus:border-blue-500 text-lg placeholder-zinc-500"
                  />
                  <button
                    onClick={askQuestion}
                    disabled={loading || !question.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 px-10 rounded-3xl font-medium transition"
                  >
                    {loading ? 'Thinking...' : 'Ask'}
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