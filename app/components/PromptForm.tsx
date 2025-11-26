// app/components/PromptForm.tsx

'use client';

import { useState, FormEvent, useEffect } from 'react';
// import ModelSelector from './ModelSelector'; // 不再需要

interface PromptFormProps {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  onSubmit: (prompt: string) => void;
  initialPrompt?: string;
  buttonText?: string;
  // 移除了 selectedModel 和 onModelChange，因為這裡不再負責選擇模型
}

export default function PromptForm({
  isLoading,
  setIsLoading,
  onSubmit,
  initialPrompt = '',
  buttonText = 'Submit Prompt',
}: PromptFormProps) {
  const [currentPrompt, setCurrentPrompt] = useState(initialPrompt);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setCurrentPrompt(initialPrompt);
  }, [initialPrompt]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPrompt.trim()) {
      alert('Please enter a prompt.');
      return;
    }
    onSubmit(currentPrompt);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* 卡片容器 */}
      <div
        className={`
          relative flex flex-col w-full bg-white rounded-xl border transition-all duration-300 ease-in-out shadow-sm
          ${isFocused ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-md' : 'border-gray-200 hover:border-gray-300'}
        `}
      >

        {/* --- 頂部工具列 (Header) --- */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
          {/* 左側：標題與圖示 */}
          <label
            htmlFor="prompt-input"
            className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wide cursor-pointer"
          >
            <span className="text-lg">✍️</span>
            <span>Input Prompt</span>
          </label>

          {/* 右側：原本的模型選擇器已移除，保持乾淨 */}
        </div>

        {/* --- 中間輸入區 (Textarea) --- */}
        <div className="relative">
          <textarea
            id="prompt-input"
            className="w-full p-5 bg-transparent border-none focus:ring-0 text-gray-800 text-base leading-relaxed resize-y min-h-[160px] placeholder:text-gray-400"
            rows={6}
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Describe your task here... e.g., 'Explain quantum computing to a 5-year-old'"
            disabled={isLoading}
          />

          {/* 字數統計 */}
          <div className="absolute bottom-2 right-4 text-xs text-gray-300 pointer-events-none">
            {currentPrompt.length} chars
          </div>
        </div>

        {/* --- 底部行動列 (Footer) --- */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100 rounded-b-xl">
          <div className="text-xs text-gray-400 italic">
            {isLoading ? 'AI is thinking...' : 'Ready to optimize'}
          </div>

          <button
            type="submit"
            disabled={isLoading || !currentPrompt.trim()}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm shadow-md transition-all duration-200
              ${isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:scale-[1.02] active:scale-95'
              }
            `}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                {buttonText}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </>
            )}
          </button>
        </div>

      </div>
    </form>
  );
}