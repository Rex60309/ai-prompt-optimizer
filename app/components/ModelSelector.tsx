'use client';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

// Model list
const AVAILABLE_MODELS = [
  // --- Google Models ---
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },

  // --- Groq Models ---
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
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