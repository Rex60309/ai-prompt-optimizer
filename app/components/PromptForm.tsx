// app/components/PromptForm.tsx

'use client';

import { useState, FormEvent, useEffect } from 'react';
import { Wand2, PenLine } from 'lucide-react';

interface PromptFormProps {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  onSubmit: (prompt: string) => void;
  initialPrompt?: string;
  buttonText?: string;
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      if (currentPrompt.trim()) {
        onSubmit(currentPrompt);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full h-full flex flex-col">
      {/* 卡片容器：強制撐滿高度 h-full */}
      <div
        className={`
          relative flex flex-col w-full h-full bg-slate-900/50 backdrop-blur-sm rounded-2xl border transition-all duration-300 ease-in-out shadow-lg overflow-hidden
          ${isFocused 
            ? 'border-indigo-500/50 ring-2 ring-indigo-500/20 shadow-indigo-500/10' 
            : 'border-slate-700/50 hover:border-slate-600'
          }
        `}
      >

        {/* --- 頂部工具列 (Header) --- */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50 bg-slate-800/30 shrink-0">
          <label
            htmlFor="prompt-input"
            className="flex items-center gap-2 text-sm font-bold text-slate-200 uppercase tracking-wide cursor-pointer group"
          >
            <PenLine className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
            <span>Input Prompt</span>
          </label>
        </div>

        {/* --- 中間輸入區 (Textarea) --- */}
        <div className="relative flex-1 min-h-0">
          <textarea
            id="prompt-input"
            className="w-full h-full p-5 bg-transparent border-none focus:ring-0 text-slate-200 text-base leading-relaxed resize-none placeholder:text-slate-500 font-sans"
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Describe your task here... (Ctrl + Enter to submit)"
            disabled={isLoading}
          />

          {/* 字數統計 */}
          <div className="absolute bottom-3 right-5 text-xs text-slate-400 font-mono pointer-events-none">
            {currentPrompt.length} chars
          </div>
        </div>

        {/* --- 底部行動列 (Footer) --- */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900/80 border-t border-slate-700/50 shrink-0">
          <div className="text-xs text-slate-400 italic flex items-center gap-2">
            {isLoading ? (
              <span className="animate-pulse text-indigo-400">AI is thinking...</span>
            ) : (
              'Ready to optimize'
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !currentPrompt.trim()}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg transition-all duration-200
              ${isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0 border border-transparent'
              }
            `}
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div>
                Processing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                {buttonText}
              </>
            )}
          </button>
        </div>

      </div>
    </form>
  );
}