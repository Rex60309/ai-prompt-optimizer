// Official output-token ceilings, verified 2026-11-05. Tokens are not character counts.
// Google: https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite
// Groq: https://console.groq.com/docs/models
export const MODELS = [
  {
    provider: 'google',
    id: 'gemini-2.5-flash-lite',
    maxOutputTokens: 65536,
    name: 'Gemini 2.5 Flash-Lite',
    description: '免費方案 · 輕量文字模型',
  },
  {
    provider: 'groq',
    id: 'openai/gpt-oss-20b',
    maxOutputTokens: 65536,
    name: 'GPT-OSS 20B',
    description: 'Groq 免費方案 · 快速開源模型',
  },
  {
    provider: 'groq',
    id: 'openai/gpt-oss-120b',
    maxOutputTokens: 65536,
    name: 'GPT-OSS 120B',
    description: 'Groq 免費方案 · 大型推理模型',
  },
  {
    provider: 'groq',
    id: 'qwen/qwen3.8-27b',
    maxOutputTokens: 16384,
    name: 'Qwen 3.8 27B',
    description: 'Groq 免費方案 · 多語言模型',
  },
] as const;
export const DEFAULT_MODEL = MODELS[0].id;
export const STRATEGIES = ['minimal', 'role-play', 'structured', 'cot', 'hybrid'] as const;
export type Strategy = (typeof STRATEGIES)[number];
export const VERSION = '3.0.0';
