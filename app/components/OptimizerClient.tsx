// app/components/OptimizerClient.tsx

'use client';

import { useState } from 'react';
import PromptForm from './PromptForm';
import ModelSelector from './ModelSelector';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// 定義評分報告的 TypeScript 型別
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

// --- 新增：彈出視窗元件 (Modal) ---
function PromptModal({ isOpen, onClose, content }: { isOpen: boolean; onClose: () => void; content: string }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-fade-in border border-gray-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
          <h3 className="text-lg font-bold text-indigo-800 flex items-center gap-2">
            <span>✨</span> Optimized Prompt (Full View)
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto bg-gray-50 font-mono text-sm leading-relaxed text-indigo-900 whitespace-pre-wrap">
          {content}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={() => navigator.clipboard.writeText(content).then(() => alert('Copied!'))}
            className="mr-3 px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-medium transition-colors text-sm"
          >
            Copy Text
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OptimizerClient() {
  // --- 狀態管理 ---
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [originalResult, setOriginalResult] = useState('');
  const [optimizedResult, setOptimizedResult] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // --- 模型選擇狀態 ---
  const [optimizerModel, setOptimizerModel] = useState('gemini-2.5-flash');
  const [generationModel, setGenerationModel] = useState('gemini-2.5-flash');

  // --- AI 評審狀態 ---
  const [isJudging, setIsJudging] = useState(false);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);

  // --- Modal 狀態 (新增) ---
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 通用 API 呼叫函式
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
      // 步驟 1: 優化 Prompt
      setLoadingStage(`Optimizing prompt using ${optimizerModel}...`);
      const optimizeData = await callApi('/api/optimize', {
        prompt: inputPrompt,
        model: optimizerModel
      });
      const newOptimizedPrompt = optimizeData.optimizedPrompt;
      setOptimizedPrompt(newOptimizedPrompt);

      // 步驟 2: 生成內容
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
    <>
      {/* 整合 Modal 元件 */}
      <PromptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        content={optimizedPrompt}
      />

      {isLoading && (
        <div className="my-4 text-lg font-semibold text-purple-700 animate-pulse text-center">
          {loadingStage}
        </div>
      )}

      {/* --- 全域模型設定區塊 --- */}
      <div className="w-full max-w-6xl mb-8 p-6 bg-white rounded-xl shadow-md border border-gray-200">
        <h3 className="text-lg font-bold text-gray-700 mb-4 border-b pb-2">⚙️ Experiment Settings</h3>
        <div className="flex flex-col md:flex-row gap-8 justify-around">

          <div className="flex flex-col gap-2 w-full">
             <label className="text-sm font-semibold text-indigo-600">
              Optimizer Model
             </label>
             <ModelSelector
               value={optimizerModel}
               onChange={setOptimizerModel}
               disabled={isLoading}
             />
             <p className="text-xs text-gray-500">此模型將用來優化使用者的 Prompt</p>
          </div>

          <div className="flex flex-col gap-2 w-full">
             <label className="text-sm font-semibold text-green-600">
              Generator Model
             </label>
             <ModelSelector
               value={generationModel}
               onChange={setGenerationModel}
               disabled={isLoading}
             />
             <p className="text-xs text-gray-500">此模型將用來同時回答兩個 Prompt 以確保公平</p>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl items-stretch">

        {/* --- 左半邊 (原始) --- */}
        <div className="flex flex-col gap-6 p-6 md:p-8 rounded-xl shadow-lg bg-gray-50 border border-gray-200 h-full">
          <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-3">Original Prompt</h2>

          <PromptForm
            isLoading={isLoading}
            onSubmit={handleOptimizeSubmit}
            buttonText="Optimize & Compare"
          />

          <div className="mt-6 flex-1 flex flex-col">
            <h3 className="text-xl font-bold text-gray-700 mb-3">AI Output (Original):</h3>
            <div className={`p-4 bg-white border border-gray-300 rounded-lg shadow-sm min-h-[250px] h-full transition-all ${originalResult ? '' : 'flex items-center justify-center'}`}>
              {originalResult ? (
                <article className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {originalResult}
                  </ReactMarkdown>
                </article>
              ) : (
                <p className="text-gray-400 italic">
                    {isLoading ? 'Generating response...' : 'Response for \'input prompt\' will shown here...'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* --- 右半邊 (優化) --- */}
        <div className="flex flex-col gap-6 p-6 md:p-8 rounded-xl shadow-lg bg-indigo-50 border border-indigo-200 h-full">
          <h2 className="text-2xl font-bold text-indigo-800 border-b pb-3 mb-3">Optimized Prompt</h2>

          {/* === Optimized Prompt Box === */}
          <div className="relative flex flex-col w-full bg-white rounded-xl border border-gray-200 shadow-sm h-full max-h-[380px] transition-all duration-300 hover:border-indigo-300">

            {/* Header with View Button */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl shrink-0">
              <label className="flex items-center gap-2 text-sm font-bold text-indigo-700 uppercase tracking-wide">
                <span className="text-lg">✨</span>
                <span>Optimized Prompt</span>
              </label>

              <div className="flex items-center gap-2">
                {optimizedPrompt && (
                  <>
                    <span className="text-xs text-indigo-400 font-mono hidden sm:inline-block">
                      {optimizedPrompt.length} chars
                    </span>
                    {/* 檢視完整內容按鈕 */}
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-indigo-500 rounded-full hover:bg-indigo-600 transition-colors shadow-sm"
                      title="View Full Content"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content (Textarea) */}
            <div className="relative flex-1 min-h-[160px]">
              <textarea
                readOnly
                className="w-full h-full p-5 bg-transparent border-none focus:ring-0 text-indigo-900 font-mono text-sm leading-relaxed resize-none placeholder:text-indigo-300"
                value={optimizedPrompt}
                placeholder={isLoading ? 'Optimizing prompt...' : 'Your optimized prompt will shown here...'}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100 rounded-b-xl shrink-0">
              <div className="text-xs text-indigo-400 italic">
                {isLoading ? 'AI is working magic...' : 'AI Generated Content'}
              </div>
            </div>
          </div>

          <div className="mt-6 flex-1 flex flex-col">
            <h3 className="text-xl font-bold text-indigo-700 mb-3">AI Output (Optimized):</h3>
            <div className={`p-4 bg-white border border-indigo-300 rounded-lg shadow-sm min-h-[250px] h-full transition-all ${optimizedResult ? '' : 'flex items-center justify-center'}`}>
              {optimizedResult ? (
                <article className="prose prose-sm max-w-none text-gray-800">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {optimizedResult}
                  </ReactMarkdown>
                </article>
              ) : (
                 <p className="text-indigo-300 italic">
                    {isLoading ? 'Generating response...' : 'Response for \'optimized prompt\' will shown here...'}
                 </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- 評分按鈕和結果顯示 --- */}
      <div className="w-full max-w-6xl mt-8 flex flex-col items-center">
        {!isLoading && originalResult && optimizedResult && !judgeResult && (
          <button
            onClick={handleJudge}
            disabled={isJudging}
            className="px-8 py-4 bg-purple-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-purple-700 transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed animate-pulse"
          >
            {isJudging ? '評分中...' : '🤖 請求 AI 評審評分'}
          </button>
        )}

        {isJudging && <div className="mt-6 text-lg font-semibold text-purple-700">評分中，請稍候...</div>}

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