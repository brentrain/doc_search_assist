'use client';

import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';
import { FileSearch, LockKeyhole, Sparkles } from 'lucide-react';

export function AuthScreen() {
  const [mode, setMode] = useState<'register' | 'login'>('register');
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
        <div className="flex w-full max-w-md flex-col items-center">
          <div className="mb-6 flex rounded-xl bg-slate-200/70 p-1">
            <button type="button" onClick={() => setMode('register')} className={`rounded-lg px-4 py-2 text-xs font-semibold ${mode === 'register' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Create account</button>
            <button type="button" onClick={() => setMode('login')} className={`rounded-lg px-4 py-2 text-xs font-semibold ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Sign in</button>
          </div>
          {mode === 'register' ? <SignUp routing="hash" /> : <SignIn routing="hash" />}
        </div>
      </section>
    </main>
  );
}
