// app/components/PromptForm.tsx

'use client';

import { useState, FormEvent, useEffect } from 'react';

interface PromptFormProps {
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  onSubmit: (prompt: string) => void; // 新增：父元件傳入的提交處理函式
  initialPrompt?: string; // 新增：可選的初始 Prompt 值
  buttonText?: string; // 新增：按鈕文字
}

export default function PromptForm({
  isLoading,
  setIsLoading,
  onSubmit,
  initialPrompt = '',
  buttonText = 'Submit Prompt',
}: PromptFormProps) {
  const [currentPrompt, setCurrentPrompt] = useState(initialPrompt);

  // 確保 initialPrompt 改變時，currentPrompt 也會更新
  useEffect(() => {
    setCurrentPrompt(initialPrompt);
  }, [initialPrompt]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPrompt.trim()) {
      // 這裡簡單處理，實際應用中可傳回錯誤給父元件
      alert('Please enter a prompt.');
      return;
    }
    onSubmit(currentPrompt); // 調用父元件傳入的提交函式
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex flex-col gap-4">
        <label htmlFor="prompt-input" className="text-lg font-semibold text-gray-800 sr-only">
          Enter Prompt
        </label>
        <textarea
          id="prompt-input"
          className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-800 bg-white"
          rows={6}
          value={currentPrompt}
          onChange={(e) => setCurrentPrompt(e.target.value)}
          placeholder="e.g., explain black holes in simple terms"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="px-6 py-3 font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : buttonText}
        </button>
      </div>
    </form>
  );
}