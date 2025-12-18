// app/components/OptimizerClient.tsx

'use client';

import { useState } from 'react';
import PromptForm from './PromptForm';
import ModelSelector from './ModelSelector';
import StrategySelector, { StrategyType } from './StrategySelector';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
    Settings2, Sparkles, ArrowRight, Zap, Copy,
    Maximize2, X, Gavel, BarChart3, Bot, Trophy, ArrowDown
} from 'lucide-react';

// --- TypeScript Interfaces ---
interface JudgeCriterion {
    criterionName: string;
    scoreA: number;
    scoreB: number;
    justification: string;
}
interface JudgeResult {
    criteria: JudgeCriterion[];
    summary: string;
}

// --- Component: Modal ---
function PromptModal({ isOpen, onClose, content }: { isOpen: boolean; onClose: () => void; content: string }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative bg-slate-900 rounded-2xl shadow-2xl shadow-black/50 w-full max-w-3xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-700/50 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 bg-slate-800/30">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        Optimized Prompt Content
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-0 overflow-y-auto bg-slate-950/50">
           <pre className="p-6 font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap selection:bg-indigo-500/30">
             {content}
           </pre>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-900 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={() => navigator.clipboard.writeText(content).then(() => alert('Copied!'))}
                        className="flex items-center gap-2 px-4 py-2 text-slate-300 bg-slate-800 border border-slate-600 hover:bg-slate-700 hover:border-slate-500 rounded-lg font-medium transition-all text-sm shadow-sm"
                    >
                        <Copy className="w-4 h-4" /> Copy
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 transition-all text-sm shadow-lg shadow-indigo-500/20"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Component: Status Badge ---
function StatusBadge({ stage }: { stage: string }) {
    if (!stage) return null;
    return (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/90 backdrop-blur border border-slate-700 text-slate-100 px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-ping" />
            <span className="font-medium text-sm tracking-wide">{stage}</span>
        </div>
    );
}

export default function OptimizerClient() {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState('');
    const [originalPrompt, setOriginalPrompt] = useState('');
    const [optimizedPrompt, setOptimizedPrompt] = useState('');
    const [originalResult, setOriginalResult] = useState('');
    const [optimizedResult, setOptimizedResult] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // 模型選擇狀態
    const [optimizerModel, setOptimizerModel] = useState('gemini-2.5-flash');
    const [generationModel, setGenerationModel] = useState('gemini-2.5-flash');

    // 策略選擇狀態
    const [optimizationStrategy, setOptimizationStrategy] = useState<StrategyType>('zero-shot');

    const [isJudging, setIsJudging] = useState(false);
    const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const calculateTotal = (scores: number[]) => {
        const sum = scores.reduce((acc, score) => acc + score, 0);
        return Math.round(sum * 10) / 10;
    };

    const totalScoreA = judgeResult ? calculateTotal(judgeResult.criteria.map(c => c.scoreA)) : 0;
    const totalScoreB = judgeResult ? calculateTotal(judgeResult.criteria.map(c => c.scoreB)) : 0;
    const maxTotal = judgeResult ? judgeResult.criteria.length * 10 : 0;

    const callApi = async (endpoint: string, body: object) => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API call to ${endpoint} failed`);
        }
        return response.json();
    };

    const handleOptimizeSubmit = async (inputPrompt: string) => {
        setIsLoading(true);
        setErrorMessage('');
        setOriginalPrompt(inputPrompt);
        setOptimizedPrompt('');
        setOriginalResult('');
        setOptimizedResult('');
        setJudgeResult(null);

        try {
            setLoadingStage(`Optimizing prompt using ${optimizerModel} with ${optimizationStrategy} strategy...`);

            const optimizeData = await callApi('/api/optimize', {
                prompt: inputPrompt,
                model: optimizerModel,
                strategy: optimizationStrategy
            });
            const newOptimizedPrompt = optimizeData.optimizedPrompt;
            setOptimizedPrompt(newOptimizedPrompt);

            setLoadingStage(`Generating responses using ${generationModel}...`);
            const [originalResponse, optimizedResponse] = await Promise.all([
                callApi('/api/generate', {
                    prompt: inputPrompt,
                    model: generationModel
                }),
                callApi('/api/generate', {
                    prompt: newOptimizedPrompt,
                    model: generationModel
                }),
            ]);

            setOriginalResult(originalResponse.generatedContent);
            setOptimizedResult(optimizedResponse.generatedContent);
        } catch (error: any) {
            console.error('An error occurred:', error);
            setErrorMessage(error.message);
        } finally {
            setIsLoading(false);
            setLoadingStage('');
        }
    };

    const handleJudge = async () => {
        setIsJudging(true);
        setErrorMessage('');
        try {
            const snippetA = originalResult.substring(0, 3000);
            const snippetB = optimizedResult.substring(0, 3000);

            const result = await callApi('/api/judge', {
                originalPrompt: originalPrompt,
                outputA: snippetA,
                outputB: snippetB,
            });
            setJudgeResult(result);
        } catch (error: any) {
            console.error('Judging failed:', error);
            setErrorMessage(error.message);
        } finally {
            setIsJudging(false);
        }
    };

    return (
        <div className="w-full animate-in fade-in duration-500">
            <PromptModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} content={optimizedPrompt} />
            <StatusBadge stage={loadingStage} />

            {/* --- Settings Toolbar (Modified: Only Models) --- */}
            <div className="sticky top-4 z-40 mx-auto max-w-7xl mb-8">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-2xl shadow-black/20 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-6 transition-all">

                    {/* 左側標題 */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                            <Settings2 className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-200 text-sm">Model Settings</span>
                            <span className="text-xs text-slate-300">Choose your AI brains</span>
                        </div>
                    </div>

                    {/* 右側控制區：Optimizer | Generator */}
                    <div className="flex flex-1 flex-col md:flex-row gap-4 w-full md:w-auto justify-end items-center">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Optimizer</label>
                            <div className="flex-1 md:flex-none min-w-[200px]">
                                <ModelSelector value={optimizerModel} onChange={setOptimizerModel} disabled={isLoading} />
                            </div>
                        </div>

                        <div className="hidden md:block h-8 w-px bg-slate-700/50"></div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Generator</label>
                            <div className="flex-1 md:flex-none min-w-[200px]">
                                <ModelSelector value={generationModel} onChange={setGenerationModel} disabled={isLoading} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Main Workspace (Changed Grid Layout) --- */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-12">

                {/* === Left Column: Original Prompt === */}
                <div className="space-y-6">
                    <div className="h-[420px] w-full">
                        <PromptForm
                            isLoading={isLoading}
                            setIsLoading={setIsLoading}
                            onSubmit={handleOptimizeSubmit}
                            buttonText="Optimize"
                        />
                    </div>

                    {/* 下方箭頭 (手機版顯示) */}
                    {originalResult && (
                        <div className="flex justify-center text-slate-500 xl:hidden">
                            <ArrowDown className="w-6 h-6" />
                        </div>
                    )}

                    {/* AI Output (Baseline) */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 min-h-[300px] flex flex-col shadow-inner bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-800/20 to-transparent">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Bot className="w-4 h-4" /> AI Output (Baseline)
                        </h3>
                        <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-700/50 p-5 shadow-sm prose prose-invert prose-sm max-w-none text-slate-300">
                            {originalResult ? (
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{originalResult}</ReactMarkdown>
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                                    Waiting for generation...
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* === Middle Column: Strategy Selector & Arrows === */}
                <div className="flex flex-col items-center justify-center gap-3 py-2 xl:h-[420px] xl:py-0">
                    {/* 上方/左方 箭頭 */}
                    <div className="hidden xl:flex items-center gap-2 text-indigo-500/50">
                        <div className="h-px w-8 bg-gradient-to-r from-transparent to-indigo-500/50"></div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400/80">Process</span>
                        <div className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-500/50"></div>
                    </div>
                    <ArrowDown className="xl:hidden text-indigo-500/50 animate-bounce" />

                    {/* 策略選單 (限制寬度) */}
                    <div className="w-full max-w-[280px] xl:w-[220px] relative z-20">
                        <div className="text-center mb-2">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400">Optimization Strategy</span>
                        </div>
                        <StrategySelector
                            value={optimizationStrategy}
                            onChange={setOptimizationStrategy}
                            disabled={isLoading}
                        />
                    </div>

                    {/* 下方/右方 箭頭 */}
                    <ArrowDown className="xl:hidden text-indigo-500/50 animate-bounce" />
                    <div className="hidden xl:block">
                        <ArrowRight className={`w-6 h-6 text-indigo-500 ${isLoading ? 'animate-pulse' : ''}`} />
                    </div>
                </div>

                {/* === Right Column: Optimized Prompt === */}
                <div className="space-y-6">
                    <div className="h-[420px] bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/5 p-6 relative overflow-hidden group hover:border-indigo-500/50 transition-all flex flex-col">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>

                        <div className="flex justify-between items-start mb-4 shrink-0">
                            <h2 className="text-xl font-bold text-indigo-100 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                                Optimized Prompt
                            </h2>
                            {optimizedPrompt && (
                                <button onClick={() => setIsModalOpen(true)} className="text-xs flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full hover:bg-indigo-500/20 transition-colors font-medium">
                                    <Maximize2 className="w-3 h-3" /> Expand
                                </button>
                            )}
                        </div>

                        <div className="relative flex-1 min-h-0">
                            <textarea
                                readOnly
                                className="w-full h-full p-4 bg-slate-950/80 border border-indigo-900/50 rounded-xl text-indigo-100 font-mono text-sm leading-relaxed resize-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none placeholder:text-slate-500"
                                value={optimizedPrompt}
                                placeholder="Optimized prompt will appear here..."
                            />
                            {!optimizedPrompt && isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-[1px] rounded-xl">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
                                        <span className="animate-pulse text-indigo-400 font-medium text-sm">Optimizing...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-3 text-xs text-indigo-300/80 flex justify-end shrink-0">
                            {optimizedPrompt ? 'Generated by AI' : 'Waiting for input'}
                        </div>
                    </div>

                    {/* 下方箭頭 (手機版顯示) */}
                    {optimizedResult && (
                        <div className="flex justify-center text-indigo-900/50 xl:hidden">
                            <ArrowDown className="w-6 h-6" />
                        </div>
                    )}

                    {/* AI Output (Optimized) */}
                    <div className="bg-slate-900 rounded-2xl border border-indigo-500/20 p-6 min-h-[300px] flex flex-col shadow-inner bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 to-transparent">
                        <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4" /> AI Output (Optimized)
                        </h3>
                        <div className="flex-1 bg-slate-950/50 rounded-xl border border-indigo-500/20 p-5 shadow-sm prose prose-invert prose-sm max-w-none text-slate-300">
                            {optimizedResult ? (
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{optimizedResult}</ReactMarkdown>
                            ) : (
                                <div className="h-full flex items-center justify-center text-indigo-300/60 italic text-sm">
                                    Waiting for generation...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Judgment Section --- */}
            <div className="mb-20">
                <div className="flex justify-center mb-8">
                    {!isLoading && originalResult && optimizedResult && !judgeResult && (
                        <button
                            onClick={handleJudge}
                            disabled={isJudging}
                            className="group relative px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-lg rounded-full shadow-lg shadow-indigo-900/50 hover:shadow-indigo-600/50 hover:-translate-y-1 transition-all disabled:bg-slate-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed disabled:transform-none overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                {isJudging ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <Gavel className="w-5 h-5" />}
                                {isJudging ? 'Analyzing Results...' : 'Run AI Evaluation'}
                            </span>
                        </button>
                    )}
                </div>

                {judgeResult && !isJudging && (
                    <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
                        {/* Report Header */}
                        <div className="bg-gradient-to-r from-slate-950 to-indigo-950 text-white p-8 md:p-10 text-center border-b border-indigo-900/30">
                            <h2 className="text-3xl font-bold flex items-center justify-center gap-3 mb-2 text-indigo-100">
                                <BarChart3 className="w-8 h-8 text-indigo-400" />
                                Evaluation Report
                            </h2>
                            <p className="text-indigo-200/60">Comparative Analysis: Baseline vs Optimized</p>
                        </div>

                        <div className="p-8 md:p-10">
                            {/* Summary Box */}
                            <div className="mb-10 p-6 bg-indigo-950/30 rounded-2xl border border-indigo-500/30">
                                <h3 className="text-indigo-300 font-bold mb-3 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5" /> Executive Summary
                                </h3>
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300">
                                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {judgeResult.summary}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Criteria Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {judgeResult.criteria.map((c, index) => {
                                    const winA = c.scoreA > c.scoreB;
                                    const winB = c.scoreB > c.scoreA;
                                    const tie = c.scoreA === c.scoreB;

                                    return (
                                        <div key={index} className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 transition-all p-5">
                                            <div className="mb-4">
                                                <h4 className="font-bold text-slate-200 text-lg">{c.criterionName}</h4>
                                            </div>

                                            <div className="space-y-4 mb-4 flex-1">
                                                {/* A Score */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="font-semibold text-slate-400">Original</span>
                                                        <span className="font-bold text-slate-400">{c.scoreA}/10</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${winA ? 'bg-gradient-to-r from-slate-400 to-slate-200' : 'bg-slate-600'}`} style={{ width: `${c.scoreA * 10}%` }}></div>
                                                    </div>
                                                </div>

                                                {/* B Score */}
                                                <div>
                                                    <div className="flex justify-between text-xs mb-1">
                                                        <span className="font-semibold text-indigo-400">Optimized</span>
                                                        <span className="font-bold text-indigo-300">{c.scoreB}/10</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] ${winB ? 'bg-gradient-to-r from-indigo-500 to-purple-400' : tie ? 'bg-slate-500' : 'bg-indigo-900'}`} style={{ width: `${c.scoreB * 10}%` }}></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-400 italic mt-auto border-t border-slate-800 pt-3 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">
                                                "{c.justification}"
                                            </p>
                                        </div>
                                    );
                                })}

                                {/* --- Total Score Comparison --- */}
                                <div className="flex flex-col bg-gradient-to-br from-amber-950/40 to-slate-950 rounded-xl border border-amber-500/30 hover:border-amber-400/50 hover:shadow-lg hover:shadow-amber-500/10 transition-all p-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-3 opacity-10">
                                        <Trophy className="w-24 h-24 text-amber-500" />
                                    </div>

                                    <div className="mb-6 relative z-10">
                                        <h4 className="font-bold text-amber-100 text-lg flex items-center gap-2">
                                            <Trophy className="w-5 h-5 text-amber-400" />
                                            Overall Comparison
                                        </h4>
                                    </div>

                                    <div className="space-y-6 mb-4 flex-1 relative z-10">
                                        {/* A Total */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold text-amber-100/80">Original Total</span>
                                                <span className="font-bold text-amber-100">{totalScoreA} <span className="text-amber-200/40">/ {maxTotal}</span></span>
                                            </div>
                                            <div className="h-3 w-full bg-slate-900/80 rounded-full overflow-hidden border border-amber-900/30">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${totalScoreA > totalScoreB ? 'bg-gradient-to-r from-amber-400 to-yellow-200 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'bg-slate-600'}`}
                                                    style={{ width: `${(totalScoreA / maxTotal) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* B Total */}
                                        <div>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="font-semibold text-amber-100/80">Optimized Total</span>
                                                <span className="font-bold text-amber-100">{totalScoreB} <span className="text-amber-200/40">/ {maxTotal}</span></span>
                                            </div>
                                            <div className="h-3 w-full bg-slate-900/80 rounded-full overflow-hidden border border-amber-900/30">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${totalScoreB > totalScoreA ? 'bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_15px_rgba(245,158,11,0.6)]' : totalScoreA === totalScoreB ? 'bg-slate-500' : 'bg-indigo-900'}`}
                                                    style={{ width: `${(totalScoreB / maxTotal) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-amber-500/20 text-center relative z-10">
                                        <span className="text-xs text-amber-100/80 uppercase tracking-widest">Winner</span>
                                        <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-400 mt-1">
                                            {totalScoreB > totalScoreA ? 'OPTIMIZED PROMPT' : (totalScoreA > totalScoreB ? 'ORIGINAL PROMPT' : 'IT\'S A TIE')}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                )}
            </div>

            {errorMessage && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-950/90 text-red-200 px-6 py-4 rounded-xl border border-red-500/50 shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50 backdrop-blur-md">
                    <X className="w-5 h-5 text-red-400" />
                    <span className="font-medium">{errorMessage}</span>
                    <button onClick={() => setErrorMessage('')} className="ml-2 hover:bg-red-900/50 rounded-full p-1"><X className="w-4 h-4" /></button>
                </div>
            )}

        </div>
    );
}