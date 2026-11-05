// app/components/OptimizerClient.tsx

'use client';

import React, { useState } from 'react';
import PromptForm from './PromptForm';
import ModelSelector from './ModelSelector';
import StrategySelector, { StrategyType } from './StrategySelector';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
    Settings2, Sparkles, ArrowRight, Zap, Copy,
    Maximize2, X, Gavel, BarChart3, Bot, Trophy, ArrowDown, Wand2, Play
} from 'lucide-react';

// --- 類型定義區 ---
interface JudgeCriterion {
    criterionName: string;
    scoreA: number;
    scoreB: number;
    justification: string;
}

interface JudgeResult {
    criteria: JudgeCriterion[];
    summary: string;
    weaknesses: string;
}

// API 回應類型
interface OptimizeResponse {
    optimizedPrompt: string;
}

interface GenerateResponse {
    generatedContent: string;
}

interface JudgeResponse {
    criteria: JudgeCriterion[];
    summary: string;
    weaknesses: string;
}

// 錯誤回應類型
interface ErrorResponse {
    error?: string;
}

function PromptModal({ isOpen, onClose, content }: { isOpen: boolean; onClose: () => void; content: string }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] border border-slate-700/50 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700/50 bg-slate-800/30">
                    <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                        Optimized Prompt
                    </h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-all"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 overflow-y-auto bg-slate-950/50">
                    <pre className="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{content}</pre>
                </div>
                <div className="px-6 py-4 border-t border-slate-700/50 bg-slate-900 flex justify-end gap-3">
                    <button onClick={() => navigator.clipboard.writeText(content)} className="flex items-center gap-2 px-4 py-2 text-slate-300 bg-slate-800 border border-slate-600 rounded-lg text-sm"><Copy className="w-4 h-4" /> Copy</button>
                    <button onClick={onClose} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm">Done</button>
                </div>
            </div>
        </div>
    );
}

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
    const [originalPrompt, setOriginalPrompt] = useState('');
    const [optimizedPrompt, setOptimizedPrompt] = useState('');
    const [originalResult, setOriginalResult] = useState('');
    const [optimizedResult, setOptimizedResult] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // 分離的加載狀態
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isJudging, setIsJudging] = useState(false);
    const [loadingStage, setLoadingStage] = useState('');

    const [optimizerModel, setOptimizerModel] = useState('gemini-2.5-flash');
    const [generationModel, setGenerationModel] = useState('gemini-2.5-flash');
    const [optimizationStrategy, setOptimizationStrategy] = useState<StrategyType>('role-play');

    const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const calculateTotal = (scores: number[]): number => {
        const sum = scores.reduce((acc, score) => acc + score, 0);
        return Math.round(sum * 10) / 10;
    };

    const totalScoreA = judgeResult ? calculateTotal(judgeResult.criteria.map(c => c.scoreA)) : 0;
    const totalScoreB = judgeResult ? calculateTotal(judgeResult.criteria.map(c => c.scoreB)) : 0;
    const maxTotal = judgeResult ? judgeResult.criteria.length * 10 : 0;

    // 改進的泛型 callApi 函式
    const callApi = async <T extends Record<string, unknown>>(
        endpoint: string,
        body: object
    ): Promise<T> => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json() as ErrorResponse;
            throw new Error(errorData.error || 'API call failed');
        }
        return response.json() as Promise<T>;
    };

    // 步驟 1: 僅優化 Prompt
    const handleOptimize = async (inputPrompt: string) => {
        setIsOptimizing(true);
        setErrorMessage('');
        setOriginalPrompt(inputPrompt);
        setOptimizedPrompt('');
        setOriginalResult('');
        setOptimizedResult('');
        setJudgeResult(null);

        try {
            setLoadingStage(`Optimizing Prompt...`);
            const optimizeData = await callApi<OptimizeResponse>('/api/optimize', {
                prompt: inputPrompt,
                model: optimizerModel,
                strategy: optimizationStrategy
            });
            setOptimizedPrompt(optimizeData.optimizedPrompt);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            setErrorMessage(message);
        } finally {
            setIsOptimizing(false);
            setLoadingStage('');
        }
    };

    // 步驟 2: 生成內容
    const handleGenerate = async () => {
        if (!originalPrompt || !optimizedPrompt) {
            setErrorMessage('Please optimize the prompt first');
            return;
        }

        setIsGenerating(true);
        setErrorMessage('');
        setOriginalResult('');
        setOptimizedResult('');

        try {
            setLoadingStage(`Generating results...`);
            const [originalRes, optimizedRes] = await Promise.all([
                callApi<GenerateResponse>('/api/generate', { prompt: originalPrompt, model: generationModel }),
                callApi<GenerateResponse>('/api/generate', { prompt: optimizedPrompt, model: generationModel }),
            ]);

            setOriginalResult(originalRes.generatedContent);
            setOptimizedResult(optimizedRes.generatedContent);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            setErrorMessage(message);
        } finally {
            setIsGenerating(false);
            setLoadingStage('');
        }
    };

    const handleJudge = async () => {
        if (!originalResult || !optimizedResult) return;
        setIsJudging(true);
        setErrorMessage('');
        try {
            const result = await callApi<JudgeResponse>('/api/judge', {
                originalPrompt,
                outputA: originalResult.substring(0, 4000),
                outputB: optimizedResult.substring(0, 4000),
            });
            setJudgeResult(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            setErrorMessage(message);
        } finally {
            setIsJudging(false);
        }
    };

    const handleIterate = async () => {
        if (!judgeResult || !originalPrompt) return;

        const currentFeedback = judgeResult.weaknesses;

        // 清空所有相關狀態
        setJudgeResult(null);
        setOptimizedPrompt('');
        setOriginalResult('');
        setOptimizedResult('');

        setIsOptimizing(true);
        setLoadingStage("Iterating based on feedback...");
        setErrorMessage('');

        try {
            // 只進行優化，不生成內容
            const optimizeData = await callApi<OptimizeResponse>('/api/optimize', {
                prompt: originalPrompt,
                feedback: currentFeedback,
                model: optimizerModel,
                strategy: optimizationStrategy
            });

            setOptimizedPrompt(optimizeData.optimizedPrompt);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            setErrorMessage(message);
        } finally {
            setIsOptimizing(false);
            setLoadingStage('');
        }
    };

    return (
        <div className="w-full animate-in fade-in duration-500">
            <PromptModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} content={optimizedPrompt} />
            <StatusBadge stage={loadingStage} />

            <div className="sticky top-4 z-40 mx-auto max-w-7xl mb-8 px-2">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg"><Settings2 className="w-5 h-5" /></div>
                        <div className="flex flex-col"><span className="font-bold text-slate-200 text-sm">AI Settings</span><span className="text-[10px] text-slate-400 tracking-widest">v2.0 Iterative</span></div>
                    </div>
                    <div className="flex flex-1 flex-col md:flex-row gap-4 justify-end items-center">
                        <div className="flex items-center gap-2 w-full md:w-auto"><label className="text-[10px] font-bold text-slate-500 uppercase">Optimizer</label><ModelSelector value={optimizerModel} onChange={setOptimizerModel} disabled={isOptimizing || isGenerating} /></div>
                        <div className="hidden md:block h-8 w-px bg-slate-700/50"></div>
                        <div className="flex items-center gap-2 w-full md:w-auto"><label className="text-[10px] font-bold text-slate-500 uppercase">Generator</label><ModelSelector value={generationModel} onChange={setGenerationModel} disabled={isOptimizing || isGenerating} /></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-12">
                <div className="space-y-6">
                    <div className="h-[420px] w-full"><PromptForm isLoading={isOptimizing} setIsLoading={setIsOptimizing} onSubmit={handleOptimize} buttonText="Optimize" /></div>
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 min-h-[300px] flex flex-col">
                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Bot className="w-4 h-4" /> Baseline Result</h3>
                        <div className="flex-1 bg-slate-950/50 rounded-xl p-5 prose prose-invert prose-sm max-w-none text-slate-300">
                            {originalResult ? <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{originalResult}</ReactMarkdown> : <div className="h-full flex items-center justify-center text-slate-600 italic">Waiting...</div>}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-3 py-4 xl:h-[420px]">
                    <div className="w-full max-w-[280px] xl:w-[200px] relative z-20"><StrategySelector value={optimizationStrategy} onChange={setOptimizationStrategy} disabled={isOptimizing || isGenerating} /></div>
                    <ArrowRight className="hidden xl:block w-6 h-6 text-indigo-500/50" />
                    <ArrowDown className="xl:hidden w-6 h-6 text-indigo-500/50 animate-bounce" />
                </div>

                <div className="space-y-6">
                    <div className="h-[420px] bg-slate-900/80 rounded-2xl border border-indigo-500/30 p-6 flex flex-col group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-xl font-bold text-indigo-100 flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-400" /> Optimized Prompt</h2>
                            {optimizedPrompt && <button onClick={() => setIsModalOpen(true)} className="text-[10px] px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full hover:bg-indigo-500/20">Expand</button>}
                        </div>
                        <textarea readOnly className="flex-1 w-full p-4 bg-slate-950/80 border border-indigo-900/50 rounded-xl text-indigo-100 font-mono text-sm leading-relaxed resize-none outline-none" value={optimizedPrompt} placeholder="Optimized text will appear here..." />
                    </div>
                    <div className="bg-slate-900 rounded-2xl border border-indigo-500/20 p-6 min-h-[300px] flex flex-col">
                        <h3 className="text-xs font-bold text-indigo-400 uppercase mb-4 flex items-center gap-2"><Zap className="w-4 h-4" /> Optimized Result</h3>
                        <div className="flex-1 bg-slate-950/50 rounded-xl p-5 prose prose-invert prose-sm max-w-none text-slate-300">
                            {optimizedResult ? <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{optimizedResult}</ReactMarkdown> : <div className="h-full flex items-center justify-center text-indigo-300/20 italic">Waiting...</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* 步驟 2 按鈕 */}
            <div className="mb-20">
                <div className="flex justify-center mb-10 gap-4">
                    {optimizedPrompt && !originalResult && (
                        <button onClick={handleGenerate} disabled={isGenerating} className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-full shadow-xl hover:-translate-y-1 transition-all flex items-center gap-3">
                            {isGenerating ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <Play className="w-5 h-5" />}
                            {isGenerating ? 'Generating...' : 'Generate Content'}
                        </button>
                    )}
                </div>

                <div className="flex justify-center mb-10">
                    {!isOptimizing && !isGenerating && originalResult && optimizedResult && !judgeResult && (
                        <button onClick={handleJudge} disabled={isJudging} className="group px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-full shadow-xl hover:-translate-y-1 transition-all flex items-center gap-3">
                            {isJudging ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <Gavel className="w-5 h-5" />}
                            {isJudging ? 'Analyzing...' : 'Execute Evaluation'}
                        </button>
                    )}
                </div>

                {judgeResult && !isJudging && (
                    <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
                        <div className="bg-slate-950 p-8 text-center border-b border-slate-800"><h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3"><BarChart3 className="w-8 h-8 text-indigo-400" /> Evaluation Report</h2></div>
                        <div className="p-8 md:p-10">
                            <div className="mb-10 p-6 bg-indigo-950/30 rounded-2xl border border-indigo-500/30">
                                <h3 className="text-indigo-300 font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5" /> Executive Summary</h3>
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300"><ReactMarkdown>{judgeResult.summary}</ReactMarkdown></div>
                            </div>

                            {/* 迭代優化按鈕：只在優化分數較低時顯示 */}
                            {(totalScoreB < totalScoreA) && (
                                <div className="mb-10 p-5 bg-amber-900/20 border border-amber-500/30 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 flex-1">
                                        <Zap className="w-6 h-6 text-amber-400 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-amber-100">Optimization Space Detected</p>
                                            <p className="text-xs text-amber-200/60">The optimized version scored lower. Iterate to improve further.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleIterate}
                                        disabled={isOptimizing || isGenerating}
                                        className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center gap-2 flex-shrink-0 ${
                                            isOptimizing || isGenerating
                                                ? 'bg-amber-800 text-amber-300 cursor-not-allowed opacity-60'
                                                : 'bg-amber-600 hover:bg-amber-500 text-white hover:shadow-amber-500/50 hover:-translate-y-0.5'
                                        }`}
                                    >
                                        {isOptimizing || isGenerating ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-300/30 border-t-amber-300" />
                                                Iterating...
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 className="w-4 h-4" />
                                                Iterate Again
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {judgeResult.criteria.map((c, index) => {
                                    const winA = c.scoreA > c.scoreB;
                                    const winB = c.scoreB > c.scoreA;
                                    return (
                                        <div key={index} className="flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-5">
                                            <h4 className="font-bold text-slate-200 text-sm mb-4">{c.criterionName}</h4>
                                            <div className="space-y-4 mb-4 flex-1">
                                                <div>
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className={winA ? 'text-slate-100 font-bold' : 'text-slate-500'}>Original</span>
                                                        <span className={winA ? 'text-slate-100 font-bold' : 'text-slate-500'}>{c.scoreA.toFixed(1)} / 10.0</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${winA ? 'bg-slate-300 shadow-[0_0_8px_rgba(255,255,255,0.3)]' : 'bg-slate-600'}`} style={{ width: `${c.scoreA * 10}%` }}></div></div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className={winB ? 'text-amber-400 font-bold' : 'text-slate-500'}>Optimized</span>
                                                        <span className={winB ? 'text-amber-400 font-bold' : 'text-slate-500'}>{c.scoreB.toFixed(1)} / 10.0</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${winB ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-700'}`} style={{ width: `${c.scoreB * 10}%` }}></div></div>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-500 italic mt-auto border-t border-slate-800 pt-3 whitespace-pre-wrap">{c.justification}</p>
                                        </div>
                                    );
                                })}

                                <div className={`flex flex-col rounded-xl border p-5 relative overflow-hidden ${totalScoreB >= totalScoreA ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-800/40 border-slate-500/30'}`}>
                                    <Trophy className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-10 ${totalScoreB >= totalScoreA ? 'text-amber-500' : 'text-slate-200'}`} />
                                    <h4 className="font-bold text-sm flex items-center gap-2 mb-6"><Trophy className={`w-4 h-4 ${totalScoreB >= totalScoreA ? 'text-amber-400' : 'text-slate-200'}`} /> Scoreboard</h4>
                                    <div className="space-y-6 flex-1">
                                        <div>
                                            <div className="flex justify-between text-[10px] mb-1">
                                                <span className="text-slate-400">Original Total</span>
                                                <span className={totalScoreA >= totalScoreB ? 'text-slate-100 font-bold' : 'text-slate-500'}>{totalScoreA.toFixed(1)} / {maxTotal.toFixed(1)}</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden"><div className={`h-full ${totalScoreA >= totalScoreB ? 'bg-slate-300' : 'bg-slate-700'}`} style={{ width: `${(totalScoreA / maxTotal) * 100}%` }}></div></div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[10px] mb-1">
                                                <span className="text-slate-400">Optimized Total</span>
                                                <span className={totalScoreB > totalScoreA ? 'text-amber-400 font-bold' : 'text-slate-500'}>{totalScoreB.toFixed(1)} / {maxTotal.toFixed(1)}</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden"><div className={`h-full ${totalScoreB > totalScoreA ? 'bg-amber-500' : 'bg-slate-700'}`} style={{ width: `${(totalScoreB / maxTotal) * 100}%` }}></div></div>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-800 text-center"><span className="text-[10px] text-slate-500 uppercase">Winner</span><div className={`text-lg font-black mt-1 ${totalScoreB >= totalScoreA ? 'text-amber-400' : 'text-slate-100'}`}>{totalScoreB > totalScoreA ? 'OPTIMIZED' : totalScoreA > totalScoreB ? 'ORIGINAL' : 'TIE'}</div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {errorMessage && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-950/90 text-red-200 px-6 py-4 rounded-xl border border-red-500/50 shadow-xl flex items-center gap-3 z-50 backdrop-blur-md">
                    <X className="w-5 h-5 text-red-400" />
                    <span className="font-medium text-sm">{errorMessage}</span>
                    <button onClick={() => setErrorMessage('')} className="ml-2 hover:bg-red-900/50 rounded-full p-1"><X className="w-4 h-4" /></button>
                </div>
            )}
        </div>
    );
}