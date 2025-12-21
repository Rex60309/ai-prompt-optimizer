// app/components/ModelSelector.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Cpu, Zap, Box, Layers, Flame, BrainCircuit } from 'lucide-react';

interface ModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// 定義模型資料結構
interface ModelOption {
  id: string;
  name: string;
  description: string;
}

interface ModelGroup {
  groupName: string;
  items: ModelOption[];
}

// 模型列表設定 (Updated with Trending Qwen Models)
const MODEL_GROUPS: ModelGroup[] = [
  {
    groupName: 'DeepSeek',
    items: [
      {
        id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B',
        name: 'DeepSeek R1 Distill (Qwen 32B)',
        description: 'Best for CoT & Optimization',
      },
      {
        id: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B',
        name: 'DeepSeek R1 Distill (Qwen 14B)',
        description: 'Lightweight Reasoning',
      },
    ]
  },
  {
    groupName: 'Qwen Series',
    items: [
      {
        id: 'Qwen/Qwen2.5-72B-Instruct',
        name: 'Qwen 2.5 72B',
        description: 'Flagship model, high intelligence',
      },
      {
        id: 'Qwen/Qwen2.5-7B-Instruct',
        name: 'Qwen 2.5 7B',
        description: 'Fast & Efficient',
      },
    ]
  },
  {
    groupName: 'Google DeepMind',
    items: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast, efficient, low latency',
      },
      {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        description: 'Reasoning & complex tasks',
      },
    ]
  },
  {
    groupName: 'Meta AI',
    items: [
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B',
        description: 'Super fast open model',
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B',
        description: 'Balanced performance',
      },
    ]
  },
    /*
  {
    groupName: 'OpenAI',
    items: [
      {
        id: 'gpt-5.2',
        name: 'GPT 5.2',
        description: 'Smart',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT 4o mini',
        description: 'Faster, cost-efficient',
      },
    ]
  },
     */
];

export default function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 找出當前選中的模型物件
  const selectedModel = MODEL_GROUPS.flatMap(g => g.items).find(m => m.id === value) || MODEL_GROUPS[0].items[0];

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
          {/* 修改處：這裡加入了 w-full 確保內容寬度 */}
          <div className="flex items-center gap-3 overflow-hidden w-full">
            {/* 修改處：加入 min-w-0 與 flex-1 來強制文字截斷 */}
            <div className="flex flex-col items-start min-w-0 flex-1">
              <span className="truncate w-full text-left text-slate-200">{selectedModel?.name || 'Select Model'}</span>
              <span className="truncate w-full text-left text-[10px] text-slate-500 font-normal">
              {selectedModel?.description}
            </span>
            </div>
          </div>

          <ChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform duration-300 shrink-0 ml-2 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
          />
        </button>

        {isOpen && (
            <div className="
          absolute top-full left-0 mt-2 w-auto min-w-full max-w-[320px]
          bg-slate-900/95 backdrop-blur-xl
          border border-slate-700/80
          rounded-xl shadow-2xl shadow-black/50
          z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200
        ">
              <div className="max-h-[320px] overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {MODEL_GROUPS.map((group) => (
                    <div key={group.groupName} className="mb-2 last:mb-0">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                        {group.groupName}
                      </div>

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
                                {/* 修改處：這裡也加入了 w-full */}
                                <div className="flex items-center gap-3 overflow-hidden w-full">
                                  {/* 修改處：加入 min-w-0 與 flex-1 來強制文字截斷 */}
                                  <div className="flex flex-col min-w-0 flex-1">
                             <span className={`text-sm font-medium truncate w-full text-left ${isSelected ? 'text-indigo-200' : 'text-slate-300 group-hover:text-slate-100'}`}>
                               {model.name}
                             </span>
                                    <span className="text-[10px] text-slate-500 truncate w-full text-left group-hover:text-slate-400">
                               {model.description}
                             </span>
                                  </div>
                                </div>

                                {isSelected && (
                                    <Check className="w-4 h-4 text-indigo-400 animate-in zoom-in spin-in-45 duration-300 shrink-0 ml-2" />
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