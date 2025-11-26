'use client';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

// 更新模型列表：移除舊版 Llama 3，改用 Llama 3.1 和 3.3
const AVAILABLE_MODELS = [
  // --- Google Models ---
  { id: 'gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash (最新快速)' },
  { id: 'gemini-1.5-pro', name: 'Google: Gemini 1.5 Pro (強大推理)' },

  // --- Groq Models (更新為目前支援的版本) ---
  // 舊的 llama3-8b-8192 已失效，改用這個：
  { id: 'llama-3.1-8b-instant', name: 'Groq: Llama 3.1 8B (極速)' },

  // 舊的 llama3-70b-8192 已失效，改用最新的 3.3 版本：
  { id: 'llama-3.3-70b-versatile', name: 'Groq: Llama 3.3 70B (均衡)' },

  // Mixtral 通常還支援，但建議確認 Groq 文件
  { id: 'mixtral-8x7b-32768', name: 'Groq: Mixtral 8x7B (長文本)' },
];

export default function ModelSelector({ value, onChange, disabled, label }: ModelSelectorProps) {
  // ... (下面的程式碼保持不變)
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-sm font-medium text-gray-600">{label}</span>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="appearance-none bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 text-sm font-medium cursor-pointer hover:border-indigo-400 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed max-w-[200px]"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}