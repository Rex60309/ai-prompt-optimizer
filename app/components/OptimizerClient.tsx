// app/components/OptimizerClient.tsx

'use client';

import { useState } from 'react';
import PromptForm from './PromptForm';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// --- (新增) 定義評分報告的 TypeScript 型別，確保資料結構一致 ---
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

export default function OptimizerClient() {
  // --- 現有的狀態管理 ---
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState(''); // 新增：儲存原始 Prompt 以便傳給評審
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [originalResult, setOriginalResult] = useState('');
  const [optimizedResult, setOptimizedResult] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- (新增) AI 評審相關的狀態 ---
  const [isJudging, setIsJudging] = useState(false);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);

  // --- (修改) 將 callApi 函式變得更通用，可以接受任意 body 物件 ---
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
    setOriginalPrompt(inputPrompt); // 儲存原始 prompt
    setOptimizedPrompt('');
    setOriginalResult('');
    setOptimizedResult('');
    setJudgeResult(null); // (重要) 清除上一次的評分結果

    try {
      setLoadingStage('Optimizing prompt...');
      const optimizeData = await callApi('/api/optimize', { prompt: inputPrompt });
      const newOptimizedPrompt = optimizeData.optimizedPrompt;
      setOptimizedPrompt(newOptimizedPrompt);

      setLoadingStage('Generating AI responses...');
      const [originalResponse, optimizedResponse] = await Promise.all([
        callApi('/api/generate', { prompt: inputPrompt }),
        callApi('/api/generate', { prompt: newOptimizedPrompt }),
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

  // --- (新增) 處理「請求評分」按鈕點擊事件的函式 ---
  const handleJudge = async () => {
    setIsJudging(true);
    setErrorMessage('');
    try {
      const result = await callApi('/api/judge', {
        originalPrompt: originalPrompt,
        outputA: originalResult,
        outputB: optimizedResult,
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
    <>
      {isLoading && (
        <div className="my-4 text-lg font-semibold text-purple-700">
          {loadingStage}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
        {/* 左半邊 */}
        <div className="flex flex-col gap-6 p-6 md:p-8 rounded-xl shadow-lg bg-gray-50 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-3">Original Prompt</h2>
          <PromptForm isLoading={isLoading} onSubmit={handleOptimizeSubmit} buttonText="Optimize & Compare ✨" />
          {originalResult && !isLoading && (
            <div className="mt-6">
              <h3 className="text-xl font-bold text-gray-700 mb-3">AI Output (Original):</h3>
              <div className="p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
                <article className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {originalResult}
                  </ReactMarkdown>
                </article>
              </div>
            </div>
          )}
        </div>
        {/* 右半邊 */}
        <div className="flex flex-col gap-6 p-6 md:p-8 rounded-xl shadow-lg bg-indigo-50 border border-indigo-200">
          <h2 className="text-2xl font-bold text-indigo-800 border-b pb-3 mb-3">Optimized Prompt</h2>
          {!isLoading && optimizedPrompt ? (
            <>
              <div className="p-4 bg-white border border-indigo-300 rounded-lg shadow-sm font-mono text-sm text-indigo-900 leading-relaxed">
                <p className="whitespace-pre-wrap">{optimizedPrompt}</p>
              </div>
              {optimizedResult && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-indigo-700 mb-3">AI Output (Optimized):</h3>
                  <div className="p-4 bg-white border border-indigo-300 rounded-lg shadow-sm">
                    <article className="prose prose-sm max-w-none text-gray-800">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {optimizedResult}
                      </ReactMarkdown>
                    </article>
                  </div>
                </div>
              )}
            </>
          ) : !isLoading ? (
            <div className="flex items-center justify-center h-full text-center text-indigo-500 p-10">
              Your optimized prompt and its result will appear here.
            </div>
          ) : null}
        </div>
      </div>

      {/* --- (新增) 評分按鈕和結果顯示的完整區塊 --- */}
      <div className="w-full max-w-6xl mt-8 flex flex-col items-center">
        {/* 按鈕只在兩個結果都產生、且尚未評分時顯示 */}
        {!isLoading && originalResult && optimizedResult && !judgeResult && (
          <button
            onClick={handleJudge}
            disabled={isJudging}
            className="px-8 py-4 bg-purple-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-purple-700 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed animate-pulse"
          >
            {isJudging ? '評分中...' : '🤖 請求 AI 評審評分'}
          </button>
        )}

        {/* 顯示評分中的讀取提示 */}
        {isJudging && <div className="mt-6 text-lg font-semibold text-purple-700">評分中，請稍候...</div>}

        {/* 顯示評分結果報告 */}
        {judgeResult && !isJudging && (
          <div className="w-full mt-6 p-8 bg-white rounded-2xl shadow-2xl border border-gray-200 animate-fade-in">
            <h2 className="text-3xl font-extrabold text-center mb-6 text-gray-800">評分報告 📋</h2>

            <div className="space-y-4 mb-8">
              {judgeResult.criteria.map((c, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200 transition-all hover:shadow-md">
                  <h4 className="text-lg font-bold text-gray-700">{c.criterionName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2 items-center">
                    <div className={`p-3 rounded-md text-center ${c.scoreA >= c.scoreB ? 'bg-blue-100 border-2 border-blue-300' : 'bg-gray-100'}`}>
                      <span className="font-semibold text-sm text-gray-600">原始輸出</span><br/>
                      <span className="text-2xl font-bold text-blue-600">{c.scoreA} / 10</span>
                    </div>
                    <div className={`p-3 rounded-md text-center ${c.scoreB > c.scoreA ? 'bg-indigo-100 border-2 border-indigo-300' : 'bg-gray-100'}`}>
                      <span className="font-semibold text-sm text-gray-600">優化輸出</span><br/>
                      <span className="text-2xl font-bold text-indigo-600">{c.scoreB} / 10</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-3 italic">評語：{c.justification}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-2xl font-bold text-gray-800 mb-3">🏆 總結分析</h3>
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">{judgeResult.summary}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-8 w-full max-w-6xl p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg text-center">
          <p>錯誤: {errorMessage}</p>
        </div>
      )}
    </>
  );
}