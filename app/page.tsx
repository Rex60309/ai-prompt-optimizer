"use client";
import { Languages, ArrowLeftRight } from 'lucide-react';
import OptimizerClient from './components/OptimizerClient';
import { LanguageProvider, useLanguage } from './components/Language';
function Workspace() {
  const { t, toggle, language } = useLanguage();
  return <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
    <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_65%)]" />
    <div className="relative mx-auto max-w-7xl px-4 sm:px-8 py-5 sm:py-7">
      <nav className="mb-8 flex items-center justify-between gap-4 border-b border-slate-800/80 pb-5"><span className="text-2xl sm:text-3xl font-semibold tracking-tight">AI Prompt <span className="text-indigo-400">Optimizer</span></span><button onClick={toggle} aria-label={t('切換為英文介面', 'Switch to Chinese')} className="group inline-flex shrink-0 items-center gap-2.5 rounded-xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 px-3.5 py-2.5 text-sm font-medium text-indigo-100 shadow-sm transition-all duration-200 hover:border-indigo-400/70 hover:from-indigo-500/25 hover:to-violet-500/20 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-95"><Languages className="h-4 w-4 text-indigo-300" aria-hidden /><span>{language === 'zh' ? 'English' : '繁體中文'}</span><ArrowLeftRight className="h-3.5 w-3.5 text-indigo-400 transition-transform group-hover:translate-x-0.5" aria-hidden /></button></nav>
      <header className="mb-7"><h1 className="w-fit bg-gradient-to-r from-sky-200 via-indigo-300 to-violet-400 bg-clip-text text-2xl sm:text-3xl font-semibold leading-relaxed tracking-tight text-transparent">{t('更清楚的指令，更好的回答。', 'Clearer prompts. Better answers.')}</h1></header>
      <OptimizerClient />
      <footer className="mt-16 border-t border-slate-800/80 py-7 text-center text-sm text-slate-600"><p>© {new Date().getFullYear()} Hyh</p></footer>
    </div>
  </main>;
}
export default function HomePage() { return <LanguageProvider><Workspace /></LanguageProvider>; }
