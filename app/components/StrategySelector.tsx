// app/components/StrategySelector.tsx

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Lightbulb, Layers, BrainCircuit, Sparkles } from 'lucide-react';

export type StrategyType = 'role-play' | 'structured' | 'cot' | 'hybrid';

interface StrategySelectorProps {
    value: StrategyType;
    onChange: (value: StrategyType) => void;
    disabled?: boolean;
}

// 定義策略資料結構
const STRATEGIES: { id: StrategyType; name: string; icon: React.ReactNode }[] = [
    {
        id: 'role-play',
        name: 'Role Play',
        icon: <Lightbulb className="w-3 h-3" />
    },
    {
        id: 'structured',
        name: 'Structured',
        icon: <Layers className="w-3 h-3" />
    },
    {
        id: 'cot',
        name: 'Chain of Thought',
        icon: <BrainCircuit className="w-3 h-3" />
    },
    {
        id: 'hybrid',
        name: 'Hybrid',
        icon: <Sparkles className="w-3 h-3" />
    },
];

export default function StrategySelector({ value, onChange, disabled }: StrategySelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedStrategy = STRATEGIES.find(s => s.id === value) || STRATEGIES[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (id: StrategyType) => {
        onChange(id);
        setIsOpen(false);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {/* Trigger Button */}
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
          focus:outline-none focus:ring-2 focus:ring-purple-500/50
          ${isOpen
                    ? 'border-purple-500/60 shadow-[0_0_15px_rgba(168,85,247,0.15)] bg-slate-900'
                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-900/50'
                }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
            >
                <div className="flex items-center gap-3 overflow-hidden w-full">
                    <div className={`
            p-1.5 rounded-lg transition-colors shrink-0
            ${isOpen ? 'bg-purple-500 text-white' : 'bg-slate-800 text-purple-400'}
          `}>
                        {selectedStrategy.icon}
                    </div>

                    <div className="flex flex-col items-start min-w-0 flex-1">
                        <span className="truncate w-full text-left">{selectedStrategy.name}</span>
                    </div>
                </div>

                <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform duration-300 shrink-0 ml-2 ${isOpen ? 'rotate-180 text-purple-400' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="
          absolute top-full left-0 mt-2 w-full min-w-[200px]
          bg-slate-900/95 backdrop-blur-xl
          border border-slate-700/80
          rounded-xl shadow-2xl shadow-black/50
          z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200
        ">
                    <div className="p-1.5 space-y-1">
                        <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                            Optimization Strategy
                        </div>

                        {STRATEGIES.map((strategy) => {
                            const isSelected = strategy.id === value;
                            return (
                                <button
                                    key={strategy.id}
                                    type="button"
                                    onClick={() => handleSelect(strategy.id)}
                                    className={`
                    w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between group transition-all
                    ${isSelected
                                        ? 'bg-purple-600/10 border border-purple-500/30'
                                        : 'hover:bg-slate-800 border border-transparent'
                                    }
                  `}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden w-full">
                                        <div className={`
                        p-1.5 rounded-md flex-shrink-0 transition-colors
                        ${isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-700'}
                      `}>
                                            {strategy.icon}
                                        </div>

                                        <div className="flex flex-col min-w-0 flex-1">
                        <span className={`text-sm font-medium truncate w-full text-left ${isSelected ? 'text-purple-200' : 'text-slate-300 group-hover:text-slate-100'}`}>
                          {strategy.name}
                        </span>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <Check className="w-4 h-4 text-purple-400 animate-in zoom-in spin-in-45 duration-300 shrink-0 ml-2" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}