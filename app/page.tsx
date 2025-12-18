// app/page.tsx

import OptimizerClient from './components/OptimizerClient';

export default function HomePage() {
    return (
        <main className="min-h-screen w-full bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden">

            {/* 背景光暈效果 (Ambient Background Effects) */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] opacity-40 mix-blend-screen animate-pulse" />
                <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] opacity-30 mix-blend-screen" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
            </div>

            <div className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                {/* Header Section */}
                <header className="mb-10 text-center space-y-3">
                    <div className="inline-flex items-center justify-center p-[1px] rounded-full bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-indigo-500/50 mb-4">
                        <div className="px-3 py-1 bg-slate-950 rounded-full">
              <span className="text-xs font-bold tracking-wider text-indigo-300 uppercase bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-purple-300">
                v2.0 Dark Mode
              </span>
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg">
                        AI Prompt <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Optimizer</span>
                    </h1>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        Refine, Generate, and Compare. The ultimate dark workbench for prompt engineering.
                    </p>
                </header>

                {/* Client Application */}
                <OptimizerClient />

                {/* Footer */}
                <footer className="mt-20 text-center text-slate-600 text-sm border-t border-slate-800/50 pt-8">
                    <p>© {new Date().getFullYear()} Hyh</p>
                </footer>
            </div>
        </main>
    );
}