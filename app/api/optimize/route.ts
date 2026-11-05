// app/api/optimize/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';
import OpenAI from 'openai';

// 初始化客戶端
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// --- 1. 定義共用約束 (Base Constraints) ---
// 這裡加入了更嚴厲的指令，防止 AI 輸出解釋性文字或將 feedback 內容直接貼入
const BASE_CONSTRAINTS = `
CRITICAL CONSTRAINTS (Must Follow):
1. **Strict Output Isolation**: Return ONLY the final optimized prompt text.
2. **Language Requirement**: Use Traditional Chinese (繁體中文).
3. **No Placeholders**: Output must be ready-to-use.
4. **Directness**: Start output immediately with prompt content.
`;

const PRESERVE_INTENT_CONSTRAINT = `
CRITICAL: DO NOT introduce new requirements not in Original User Intent.
- You may refine wording, clarify ambiguous instructions, or reorganize.
- DO NOT add new demands that change the user's intent.
`;

// --- 2. 定義迭代優化專用指令 ---
// 將 feedback 封裝在明確的指示中，要求 AI 進行邏輯修正而非複製文字
const getIterationInstruction = (feedback: string): string => {
  return `
  ITERATIVE OPTIMIZATION MODE:
  
  Judge Panel identified these specific weaknesses in the previous prompt:
  """
  ${feedback}
  """
  
  Your task: Rewrite the prompt to directly address these weaknesses.
  
  SPECIFIC RULES:
  1. Do NOT quote the weaknesses in your output.
  2. Do NOT add NEW requirements beyond the Original User Intent.
  3. ONLY modify the prompt's structure/wording to fix identified issues.
  4. Maintain the original task's core objective.
  
  Example: If feedback says "lacks step-by-step guidance", add explicit steps.
           If feedback says "too verbose", compress without losing requirements.
  `;
};

// --- 3. 定義不同策略的 Prompt 模板 (Strategy Instructions) ---
const getStrategyInstruction = (strategy: string): string => {
  switch (strategy) {
    case 'role-play':
    default:
      return `
      STRATEGY: Persona-Driven Optimization.
      Rewriting focus: Analyze the potential domains of user input and assign the most suitable expert identities ("You are...") and immerse the task in professional domain-specific terminology.
      `;
    case 'structured':
      return `
      STRATEGY: Structured Component Prompting.
      Rewriting focus: Decompose the user input into [Context & Role], [Core Task], [Constraints & Rules], [Output Format], and [Style & Tone]. Use clear headers.
      `;
    case 'cot':
      return `
      STRATEGY: Chain of Thought (CoT).
      Rewriting focus: Force the AI to "Think step-by-step" and outline specific logical reasoning phases before providing the final answer.
      `;
    case 'hybrid':
      return `
      STRATEGY: Hybrid Optimization.
      Rewriting focus: Dynamically synthesize multi-dimensional prompt frameworks. You must integrate professional identity, explicit structural constraints, and systematic reasoning pathways into a cohesive instructions set.
      
      Please rewrite the user input according to the following integrated framework:
    
      1. [Expert Persona & Tone]: 
         - Define the most authoritative expert identity ("You are...") suitable for the task.
         - Establish a professional, domain-specific terminology and tone.
    
      2. [Structured Execution & Constraints]:
         - Decompose the task into clear operational components: [Context], [Core Objective], [Strict Rules & Guardrails].
         - Define the precise [Output Format] (e.g., Markdown, specific headers, or JSON) to ensure scannability.
    
      3. [Cognitive Reasoning Pathway (CoT)]:
         - Explicitly embed a step-by-step thinking mandate ("Think step-by-step").
         - Define the precise logical sequence the AI must process (e.g., Analysis -> Evaluation -> Synthesis) before delivering the final output.
    
      4. [Adaptability Balancing]:
         - Ensure the prompt maintains high contextual flexibility while upholding rigid logical boundaries.
      `;
  }
};

export async function POST(request: Request) {
  try {
    const { prompt, model, strategy = 'role-play', feedback } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const targetModel = model || 'gemini-2.5-flash';
    let optimizedPrompt = '';

    // 構建 Meta Prompt
    const metaPrompt = `
      You are a world-class Prompt Engineer. 
      Your mission is to rewrite the user's prompt to achieve maximum effectiveness.

      ${getStrategyInstruction(strategy)}
      
      ${feedback ? getIterationInstruction(feedback) : ""}

      --------------------------------------------------
      Original User Intent: "${prompt}"
      --------------------------------------------------

      ${BASE_CONSTRAINTS}
      ${PRESERVE_INTENT_CONSTRAINT}

      Optimized Prompt (Output only the content, no chat):
    `;

    // --- 各模型呼叫邏輯 (保持原樣但套用新的 metaPrompt) ---
    if (targetModel.includes('gemini')) {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) throw new Error("GOOGLE_API_KEY is missing.");
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: targetModel });
      const result = await aiModel.generateContent(metaPrompt);
      optimizedPrompt = result.response.text();
    }
    else if (targetModel.includes('llama') || targetModel.includes('mixtral')) {
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: metaPrompt }],
        model: targetModel,
        temperature: 0.3, // 進一步降低溫度以確保穩定性
      });
      optimizedPrompt = chatCompletion.choices[0]?.message?.content || "";
    }
    else if (targetModel.toLowerCase().startsWith('gpt-')) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const isReasoningModel = targetModel.includes('mini') || targetModel.includes('o1') || targetModel.includes('gpt-5');
      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: metaPrompt }],
        model: targetModel,
        temperature: isReasoningModel ? 1 : 0.4,
      });
      optimizedPrompt = completion.choices[0].message.content || "";
    }
    else if (targetModel.includes('/')) {
      const result = await hf.chatCompletion({
        model: targetModel,
        messages: [{ role: "user", content: metaPrompt }],
        max_tokens: 2048,
        temperature: 0.4,
      });
      optimizedPrompt = result.choices[0].message.content || "";
      if (targetModel.toLowerCase().includes('deepseek')) {
        optimizedPrompt = optimizedPrompt.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      }
    }
    else {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
      const aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await aiModel.generateContent(metaPrompt);
      optimizedPrompt = result.response.text();
    }

    // --- 強力後處理清理 (Post-Processing Cleanup) ---
    // 移除 markdown 代碼塊
    optimizedPrompt = optimizedPrompt.replace(/^```[a-zA-Z]*\n/gm, "").replace(/```$/gm, "").trim();

    // 移除常見的 AI 廢話開頭 (Regex 強力清理)
    const cleanupRegex = /^(好的|當然|根據|為了滿足|這是|以下是|Sure|Here is|Based on).+?(\n|:)/gi;
    optimizedPrompt = optimizedPrompt.replace(cleanupRegex, "").trim();

    return NextResponse.json({ optimizedPrompt });

  } catch (error: any) {
    console.error('Error in /api/optimize:', error);
    return NextResponse.json({ error: error.message || 'Failed to optimize.' }, { status: 500 });
  }
}