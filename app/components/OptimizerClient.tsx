// app/components/OptimizerClient.tsx

'use client';

import { useLanguage } from './Language';
import React, { useState, useRef } from 'react';
import ContentDialog from './ContentDialog';
import PromptForm from './PromptForm';
import ModelSelector from './ModelSelector';
import StrategySelector, { StrategyType } from './StrategySelector';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkLineBreaks from '../lib/remark-line-breaks';
import rehypeKatex from 'rehype-katex';
import {
    Settings2, Sparkles, Zap,
    X, Gavel, BarChart3, Bot, Trophy, Wand2, Play
} from 'lucide-react';

// Evaluation is available only through the backend experiment runner.
const SHOW_EVALUATION = false;

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
    truncated?: boolean;
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
    const { t } = useLanguage();
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

    const [optimizerModel, setOptimizerModel] = useState('gemini-2.5-flash-lite');
    const [generationModel, setGenerationModel] = useState('gemini-2.5-flash-lite');
    const [optimizationStrategy, setOptimizationStrategy] = useState<StrategyType>('role-play');

    const usageLog = useRef<unknown[]>([]);
    const [iterationCount, setIterationCount] = useState(0);
    const [history, setHistory] = useState<object[]>([]);
    const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);
    const [expandedContent, setExpandedContent] = useState<{ title: string; content: string; plain?: boolean } | null>(null);

    const calculateTotal = (scores: number[]): number => {
        const sum = scores.reduce((acc, score) => acc + score, 0);
        return Math.round(sum * 10) / 10;
    };

    const totalScoreA = judgeResult ? calculateTotal(judgeResult.criteria.map(c => c.scoreA)) : 0;
    const totalScoreB = judgeResult ? calculateTotal(judgeResult.criteria.map(c => c.scoreB)) : 0;
    const maxTotal = judgeResult ? judgeResult.criteria.length * 10 : 0;

    // 改進的泛型 callApi 函式
    const callApi = async <T,>(
        endpoint: string,
        body: object
    ): Promise<T> => {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(70000),
        });
        if (!response.ok) {
            const errorData = await response.json() as ErrorResponse;
            throw new Error(errorData.error || 'API call failed');
        }
        const data = await response.json();
        if (data.usage) usageLog.current.push({ endpoint, ...data.usage });
        return data as T;
    };

    // 步驟 1: 僅優化 Prompt
    const handleOptimize = async (inputPrompt: string) => {
        setIsOptimizing(true);
        setErrorMessage('');
        usageLog.current = [];
        setIterationCount(0);
        setOriginalPrompt(inputPrompt);
        setOptimizedPrompt('');
        setOriginalResult('');
        setOptimizedResult('');
        setJudgeResult(null);

        try {
            setLoadingStage(t('正在優化提示詞…', 'Refining your prompt…'));
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

        setJudgeResult(null);
        setIsGenerating(true);
        setErrorMessage('');
        setOptimizedResult('');

        try {
            setLoadingStage(t('1/2 正在生成原始回答…', '1/2 Generating original answer…'));
            const originalRes = originalResult
                ? { generatedContent: originalResult, truncated: false }
                : await callApi<GenerateResponse>('/api/generate', { prompt: originalPrompt, model: generationModel });
            setOriginalResult(originalRes.generatedContent);
            if (originalRes.truncated) setErrorMessage(t('原始回答已達模型輸出上限，內容可能不完整。', 'The original answer reached the model output limit and may be incomplete.'));

            setLoadingStage(t('2/2 正在生成優化回答…', '2/2 Generating optimized answer…'));
            const optimizedRes = await callApi<GenerateResponse>('/api/generate', { prompt: optimizedPrompt, model: generationModel });
            setOptimizedResult(optimizedRes.generatedContent);
            if (optimizedRes.truncated) setErrorMessage(t('優化回答已達模型輸出上限，內容可能不完整。', 'The optimized answer reached the model output limit and may be incomplete.'));

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
                outputA: originalResult,
                outputB: optimizedResult,
            });
            setJudgeResult(result);
            setHistory(h => [...h, { timestamp: new Date().toISOString(), originalPrompt, optimizedPrompt, originalResult, optimizedResult, optimizerModel, generationModel, optimizationStrategy, iterationCount, usage: [...usageLog.current], evaluation: result }]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error occurred';
            setErrorMessage(message);
        } finally {
            setIsJudging(false);
        }
    };

    const handleIterate = async () => {
        if (!judgeResult || !originalPrompt) return;

        setIterationCount(c => c + 1);
        const currentFeedback = judgeResult.weaknesses;

        // 清空所有相關狀態
        setJudgeResult(null);
        setOptimizedPrompt('');
        setOptimizedResult('');

        setIsOptimizing(true);
        setLoadingStage("Iterating based on feedback...");
        setErrorMessage('');

        try {
            // 只進行優化，不生成內容
            const optimizeData = await callApi<OptimizeResponse>('/api/optimize', {
                prompt: originalPrompt,
                feedback: currentFeedback,
                previousPrompt: optimizedPrompt,
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
            {expandedContent && <ContentDialog {...expandedContent} onClose={() => setExpandedContent(null)} />}
            <StatusBadge stage={loadingStage} />
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-slate-400" aria-label={t("操作步驟", "Workflow")}>
                <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-indigo-200">{t('01 輸入需求', '01 Write')}</span><span className="px-1 py-2">→</span><span className={`rounded-full border px-4 py-2 ${optimizedPrompt ? 'border-indigo-500/40 text-indigo-200' : 'border-slate-800'}`}>{t('02 優化提示詞', '02 Refine')}</span><span className="px-1 py-2">→</span><span className={`rounded-full border px-4 py-2 ${optimizedResult ? 'border-indigo-500/40 text-indigo-200' : 'border-slate-800'}`}>{t('03 比較回答', '03 Compare')}</span>
            </div>
            <div className="mb-7 grid gap-4 lg:grid-cols-3">
                <section className="min-w-0 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.04] p-4 sm:p-5 lg:col-span-2" aria-label={t('模型', 'Models')}>
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Settings2 className="h-4 w-4 text-indigo-400" />{t('模型', 'Models')}</h2>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="min-w-0"><h3 className="mb-1 text-sm text-slate-200">{t('優化模型', 'Optimizer')}</h3><p className="mb-3 text-xs text-slate-400">{t('負責改寫你的提示詞', 'Refines your original prompt')}</p><ModelSelector value={optimizerModel} onChange={setOptimizerModel} disabled={isOptimizing || isGenerating || isJudging} /></div>
                        <div className="min-w-0 border-t border-slate-700/60 pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0"><h3 className="mb-1 text-sm text-slate-200">{t('生成模型', 'Generator')}</h3><p className="mb-3 text-xs text-slate-400">{t('回答原始與優化後的提示詞', 'Answers both versions of your prompt')}</p><ModelSelector value={generationModel} onChange={setGenerationModel} disabled={isOptimizing || isGenerating || isJudging} /></div>
                    </div>
                </section>
                <section className="min-w-0 rounded-2xl border border-violet-500/25 bg-violet-500/[0.04] p-4 sm:p-5" aria-label={t('優化策略', 'Optimize Strategy')}>
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-violet-400" />{t('優化策略', 'Optimize Strategy')}</h2>
                    <p className="mb-3 text-xs leading-6 text-slate-400">{t('選擇提示詞的改寫方式', 'Choose how your prompt is refined')}</p>
                    <StrategySelector value={optimizationStrategy} onChange={setOptimizationStrategy} disabled={isOptimizing || isGenerating || isJudging} />
                </section>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
                <div className="h-[330px] sm:h-[370px]"><PromptForm isLoading={isOptimizing || isGenerating || isJudging} onSubmit={handleOptimize} buttonText={t("優化提示詞", "Refine prompt")} /></div>
                <section className="h-[330px] sm:h-[370px] rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-5 flex flex-col">
                    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-indigo-400" /> {t('優化後提示詞', 'Optimized prompt')}</h2>{optimizedPrompt && <button onClick={() => setExpandedContent({ title: t("優化後提示詞", "Optimized prompt"), content: optimizedPrompt, plain: true })} className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">{t('展開', 'Expand')}</button>}</div>
                    <textarea aria-label={t("優化後提示詞", "Optimized prompt")} readOnly className="flex-1 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-7 text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={optimizedPrompt} placeholder={t("完成優化後，改寫的指令會顯示於此。", "Your refined prompt will appear here.")} />
                    <p className="mt-3 text-xs text-slate-500">{t('保留需求，透過所選策略重新組織指令。', 'Your intent, refined with the selected strategy.')}</p>
                </section>
            </div>
            <section className="mt-8" aria-labelledby="comparison-title">
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 id="comparison-title" className="text-lg font-semibold">{t('回答比較', 'Compare answers')}</h2><p className="mt-1 text-xs leading-6 text-slate-400">{t('以相同生成模型分別回答，直接比較內容與表達差異。', 'Same model. Two prompts. Compare the difference.')}</p></div>
                    <button onClick={handleGenerate} disabled={!optimizedPrompt || isGenerating || isOptimizing} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"><Play className="h-4 w-4" />{isGenerating ? t('正在生成兩組回答…', 'Generating answers…') : optimizedResult ? t('重新生成優化回答', 'Regenerate optimized answer') : t('生成兩組回答', 'Generate answers')}</button>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                    {[{ label: t('原始提示詞的回答', 'Original answer'), subtitle: 'BASELINE', content: originalResult, icon: <Bot className="h-4 w-4" /> }, { label: t('優化提示詞的回答', 'Optimized answer'), subtitle: 'OPTIMIZED', content: optimizedResult, icon: <Zap className="h-4 w-4 text-indigo-400" /> }].map(item => <article key={item.subtitle} className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40"><div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4"><h3 className="flex items-center gap-2 text-sm font-medium">{item.icon}{item.label}</h3><span className="text-[10px] tracking-widest text-slate-500">{item.subtitle}</span></div><div className="min-h-[240px] p-5 sm:p-6">{item.content ? <div><div className={`answer-content prose prose-invert prose-sm max-w-none break-words text-slate-300 ${item.content.length > 1200 ? 'answer-preview' : ''}`}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath, remarkLineBreaks]} rehypePlugins={[rehypeKatex]}>{item.content.length > 1200 ? Array.from(item.content).slice(0, 1200).join('') + '\n\n…' : item.content}</ReactMarkdown></div>{item.content.length > 1200 && <div className="preview-action relative flex flex-col items-center gap-2 pt-3 pb-1"><span className="text-xs tracking-[0.25em] text-slate-500" aria-hidden>…</span><button onClick={() => setExpandedContent({ title: item.label, content: item.content })} className="group inline-flex items-center justify-center gap-2 rounded-full border border-indigo-400/25 bg-slate-900 px-5 py-2.5 text-sm font-medium text-indigo-200 shadow-lg shadow-slate-950/40 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-400/60 hover:bg-indigo-500/15 hover:text-white active:translate-y-0">{t('展開完整回答', 'Read full answer')}<span className="text-indigo-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden>↗</span></button></div>}</div> : <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 text-center"><span className="rounded-xl border border-slate-800 p-3 text-slate-500">{item.icon}</span><p className="text-sm text-slate-500">{isGenerating ? t('模型正在準備回答…', 'Preparing your answers…') : t('完成提示詞優化後，點選「生成兩組回答」。', 'Refine your prompt, then select Generate answers.')}</p></div>}</div></article>)}
                </div>
            </section>
            <p className="mt-5 text-xs leading-6 text-slate-500">{t('生成內容請自行核實。', 'Please verify generated content.')}</p>
            {history.length > 0 && <button className="mt-3 text-xs text-slate-400 underline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'prompt-experiments.json'; a.click(); URL.revokeObjectURL(url); }}>{t('匯出紀錄', 'Export history')}</button>}
            <div>
                <div className="flex justify-center mb-10">
                    {SHOW_EVALUATION && !isOptimizing && !isGenerating && originalResult && optimizedResult && !judgeResult && (
                        <button onClick={handleJudge} disabled={isJudging} className="group px-10 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-full shadow-xl hover:-translate-y-1 transition-all flex items-center gap-3">
                            {isJudging ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" /> : <Gavel className="w-5 h-5" />}
                            {isJudging ? 'Analyzing...' : 'Execute Evaluation'}
                        </button>
                    )}
                </div>

                {SHOW_EVALUATION && judgeResult && !isJudging && (
                    <div className="bg-slate-900/80 backdrop-blur-md rounded-3xl border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-700">
                        <div className="bg-slate-950 p-8 text-center border-b border-slate-800"><h2 className="text-3xl font-bold text-white flex items-center justify-center gap-3"><BarChart3 className="w-8 h-8 text-indigo-400" /> Evaluation Report</h2></div>
                        <div className="p-8 md:p-10">
                            <div className="mb-10 p-6 bg-indigo-950/30 rounded-2xl border border-indigo-500/30">
                                <h3 className="text-indigo-300 font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5" /> 評審團摘要</h3>
                                <div className="prose prose-invert prose-sm max-w-none text-slate-300"><ReactMarkdown remarkPlugins={[remarkGfm]}>{judgeResult.summary}</ReactMarkdown></div>
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
                                        disabled={isOptimizing || isGenerating || isJudging}
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
