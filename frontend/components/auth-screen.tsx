'use client';

import { FormEvent, useState } from 'react';
import { FileSearch, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';

type User = { id: string; name: string; email: string; is_owner: boolean };

export function AuthScreen({ apiUrl, onAuthenticated }: { apiUrl: string; onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/auth/${mode}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to continue');
      onAuthenticated(data.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-[#f6f7f9] lg:grid-cols-[1.05fr_.95fr]">
      <section className="hidden flex-col justify-between bg-slate-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950"><Sparkles className="h-5 w-5" /></div>
          <div><p className="font-semibold">ReadBefore</p><p className="text-xs text-slate-400">The fine print in plain English</p></div>
        </div>
        <div className="max-w-lg">
          <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300"><FileSearch className="h-7 w-7" /></div>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.04em]">Understand what you&apos;re reading before you agree.</h1>
          <p className="mt-5 text-base leading-7 text-slate-400">Upload legal agreements, bills, policies, letters, and everyday documents. Get explanations grounded in your own files.</p>
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="h-4 w-4" />Every account has its own private document library.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-9 lg:hidden"><p className="text-xl font-semibold">ReadBefore</p><p className="text-sm text-slate-500">The fine print in plain English</p></div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{mode === 'register' ? 'Create your private workspace' : 'Welcome back'}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{mode === 'register' ? 'Your documents and answers stay separate from every other account.' : 'Sign in to return to your documents.'}</p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            {mode === 'register' ? <Field label="Your name" value={name} onChange={setName} autoComplete="name" /> : null}
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
            <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">{error}</p> : null}
            <Button className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800" disabled={loading}>
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {loading ? (mode === 'register' ? 'Preparing your workspace…' : 'Signing in…') : mode === 'register' ? 'Create account' : 'Sign in'}
            </Button>
          </form>
          <button className="mt-5 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-900" type="button" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>
            {mode === 'register' ? 'Already have an account? Sign in' : 'New to ReadBefore? Create an account'}
          </button>
        </div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = 'text', autoComplete }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete: string }) {
  return <label className="block text-xs font-semibold text-slate-700">{label}<input required minLength={type === 'password' ? 8 : undefined} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-normal outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" /></label>;
}
