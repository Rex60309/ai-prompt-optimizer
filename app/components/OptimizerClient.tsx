// app/components/OptimizerClient.tsx

'use client';

import { useState } from 'react';
import PromptForm from './PromptForm';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default function OptimizerClient() {
  // 所有狀態管理 (useState) 都移到這裡
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [optimizedPrompt, setOptimizedPrompt] = useState('');
  const [originalResult, setOriginalResult] = useState('');
  const [optimizedResult, setOptimizedResult] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // 所有 API 呼叫和事件處理函式也都移到這裡
  const callApi = async (endpoint: string, prompt: string) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
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
    setOptimizedPrompt('');
    setOriginalResult('');
    setOptimizedResult('');

    try {
      setLoadingStage('Optimizing prompt...');
      const optimizeData = await callApi('/api/optimize', inputPrompt);
      const newOptimizedPrompt = optimizeData.optimizedPrompt;
      setOptimizedPrompt(newOptimizedPrompt);

      setLoadingStage('Generating AI responses...');
      const [originalResponse, optimizedResponse] = await Promise.all([
        callApi('/api/generate', inputPrompt),
        callApi('/api/generate', newOptimizedPrompt),
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

  // JSX 佈局也全部移到這裡
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
      {errorMessage && (
        <div className="mt-8 w-full max-w-6xl p-4 bg-red-100 text-red-700 border border-red-300 rounded-lg text-center">
          <p>Error: {errorMessage}</p>
        </div>
      )}
    </>
  );
}