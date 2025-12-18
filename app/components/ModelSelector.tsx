// app/components/ModelSelector.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Cpu, Zap, Box, Layers } from 'lucide-react';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// 定義模型資料結構，包含分組與描述
interface ModelOption {
  id: string;
  name: string;
  description: string; // 新增：簡短描述增加質感
  icon?: React.ReactNode;
}

interface ModelGroup {
  groupName: string;
  items: ModelOption[];
}

// 豐富的模型列表資料
const MODEL_GROUPS: ModelGroup[] = [
  {
    groupName: 'Google DeepMind',
    items: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast, efficient, low latency'},
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Cost-effective lightweight'},
      // { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Reasoning & complex tasks', icon: <Cpu className="w-3 h-3" /> },
    ]
  },
  {
    groupName: 'Meta AI',
    items: [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Super fast open model'},
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Balanced performance'},
    ]
  },
  {
    groupName: 'Alibaba Cloud',
    items: [
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', description: 'Strong multi-language'},
    ]
  }
];

export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 找出當前選中的模型物件，以便顯示在按鈕上
  const selectedModel = MODEL_GROUPS.flatMap(g => g.items).find(m => m.id === value);

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (modelId: string) => {
    onChange(modelId);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* --- Trigger Button --- */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          relative w-full flex items-center justify-between
          bg-slate-950 text-slate-200 
          border transition-all duration-300
          rounded-xl px-4 py-2.5
          text-sm font-medium
          focus:outline-none focus:ring-2 focus:ring-indigo-500/50
          ${isOpen 
            ? 'border-indigo-500/60 shadow-[0_0_15px_rgba(99,102,241,0.15)] bg-slate-900' 
            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-900/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          {/* 左側圖示區塊 */}
          <div className={`
            p-1.5 rounded-lg transition-colors
            ${isOpen ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-indigo-400'}
          `}>
             {selectedModel?.icon || <Cpu className="w-4 h-4" />}
          </div>
          
          <div className="flex flex-col items-start truncate">
            <span className="truncate">{selectedModel?.name || 'Select Model'}</span>
            {/* 顯示極簡描述 (可選) */}
            {selectedModel && (
              <span className="text-[10px] text-slate-500 font-normal truncate">
                {selectedModel.description}
              </span>
            )}
          </div>
        </div>

        <ChevronDown 
          className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`} 
        />
      </button>

      {/* --- Dropdown Menu (Custom) --- */}
      {isOpen && (
        <div className="
          absolute top-full left-0 mt-2 w-full min-w-[280px]
          bg-slate-900/95 backdrop-blur-xl 
          border border-slate-700/80 
          rounded-xl shadow-2xl shadow-black/50 
          z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200
        ">
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-1.5 space-y-1">
            {MODEL_GROUPS.map((group) => (
              <div key={group.groupName} className="mb-2 last:mb-0">
                {/* Group Header */}
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                  {group.groupName}
                </div>
                
                {/* Group Items */}
                <div className="space-y-1">
                  {group.items.map((model) => {
                    const isSelected = model.id === value;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleSelect(model.id)}
                        className={`
                          w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between group transition-all
                          ${isSelected 
                            ? 'bg-indigo-600/10 border border-indigo-500/30' 
                            : 'hover:bg-slate-800 border border-transparent'
                          }
                        `}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                           {/* Icon Box */}
                           <div className={`
                             p-1.5 rounded-md flex-shrink-0 transition-colors
                             ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-700'}
                           `}>
                             {model.icon}
                           </div>

                           <div className="flex flex-col truncate">
                             <span className={`text-sm font-medium truncate ${isSelected ? 'text-indigo-200' : 'text-slate-300 group-hover:text-slate-100'}`}>
                               {model.name}
                             </span>
                             <span className="text-[10px] text-slate-500 truncate group-hover:text-slate-400">
                               {model.description}
                             </span>
                           </div>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-indigo-400 animate-in zoom-in spin-in-45 duration-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}