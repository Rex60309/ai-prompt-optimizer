// app/api/optimize/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// 初始化客戶端
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// --- 1. 定義共用約束 (Base Constraints) ---
// 這是您要求「每個 Prompt 都要保留」的部分
const BASE_CONSTRAINTS = `
Please notice the following things carefully:
1. Rewrite the user prompt based on the strategy above. Return ONLY the new, optimized prompt content. Do NOT include any introductory text (like "Here is the optimized prompt:"), explanations, or reasoning in your final output.
** 2. 若沒指定回答語言，請指定以繁體中文回答. **
3. If the question is about learning-related topics, please ensure the prompt asks for a comprehensive answer.
4. When optimizing, do NOT use ** to wrap the content when listing items (keep the format clean).
5. Please examine your own response first. If the response is too long and would require truncation, please limit the number of characters effectively.
6. Do NOT use phrases like "Please provide the following information..." inside the optimized prompt unless necessary. The optimized prompt should be ready to use.
`;

// --- 2. 定義不同策略的 Prompt 模板 (Strategy Instructions) ---
const getStrategyInstruction = (strategy: string): string => {
  switch (strategy) {
    case 'few-shot':
      return `
      STRATEGY: Few-Shot Prompting.
      
      I will provide you with examples of "Original Prompts" and their "Optimized Versions" to show you the standard of quality I expect. Learn from these examples and optimize the target prompt accordingly.

      <Example 1>
      Original: "幫我寫一個賣咖啡的文案"
      Optimized: "你是一位擁有 10 年經驗的資深社群行銷專家。請為一款新推出的『冷萃深焙咖啡』撰寫一篇適合 Instagram 的行銷文案。
      目標受眾：25-35 歲的忙碌上班族。
      語氣：充滿活力、現代感、稍微帶點文青風。
      內容要求：
      1. 強調『醒腦』與『滑順口感』。
      2. 包含 3 個相關的 Hashtag。
      3. 結尾加入具備號召力（Call to Action）的購買連結引導。"
      </Example 1>

      <Example 2>
      Original: "教我 Python 迴圈"
      Optimized: "你是一位精通 Python 的資深程式設計導師，擅長用淺顯易懂的比喻教學。請向一位完全沒有程式背景的初學者解釋 Python 中的『For 迴圈』與『While 迴圈』。
      請包含以下內容：
      1. 核心概念：用生活中的例子（如排隊、數數）來比喻。
      2. 程式碼範例：提供兩個簡單的 Code Snippet。
      3. 常見錯誤：初學者常犯的無窮迴圈陷阱。"
      </Example 2>

      Now, apply this level of detail and structure to the user's prompt below.
      `;

    case 'cot':
      return `
      STRATEGY: Chain of Thought (CoT) Optimization.
      
      Before generating the final optimized prompt, I want you to "think" internally about the user's request.
      
      Step 1: Analyze the user's original intent. What is the core goal?
      Step 2: Identify missing information (Who is the persona? What is the format? Who is the audience?).
      Step 3: Determine the best constraints to prevent hallucinations or vague answers.
      Step 4: Construct the optimized prompt based on this analysis.

      Important: Although you perform this reasoning, DO NOT output your internal thought process. ONLY output the final optimized prompt.
      `;

    case 'structured':
      return `
      STRATEGY: Structured Prompting (CO-STAR Framework).
      
      You must rewrite the user's prompt using the CO-STAR framework to ensure maximum clarity and performance.
      
      Structure the optimized prompt using these specific sections (you can combine them naturally but ensure all elements are present):
      1. (C) Context: Provide background information.
      2. (O) Objective: Define the task clearly.
      3. (S) Style: Specify the writing style (e.g., professional, humorous).
      4. (T) Tone: Set the emotional tone.
      5. (A) Audience: Define who the response is intended for.
      6. (R) Response Format: Specify the output format (e.g., Markdown, List, JSON).
      `;

    case 'zero-shot':
    default:
      return `
      STRATEGY: Role-Playing & Direct Refinement (Zero-Shot).
      
      1. Assign a specific, expert persona to the AI relevant to the task (e.g., "You are a senior copywriter...", "You are a Python expert...").
      2. Clarity and Specificity: Add details, constraints, and context to remove ambiguity from the original prompt.
      3. Format Specification: Define the desired output format clearly.
      `;
  }
};

export async function POST(request: Request) {
  try {
    const { prompt, model, strategy = 'zero-shot' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const targetModel = model || 'gemini-2.5-flash';
    let optimizedPrompt = '';

    const metaPrompt = `
      You are a world-class Prompt Engineer. Your task is to take a user's prompt and meticulously rewrite it to be more effective for a large language model.

      ${getStrategyInstruction(strategy)}

      --------------------------------------------------
      Original User Prompt: "${prompt}"
      --------------------------------------------------

      ${BASE_CONSTRAINTS}

      Optimized Prompt:
    `;

    // --- A. Google Gemini ---
    if (targetModel.includes('gemini')) {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) throw new Error("Server config error: GOOGLE_API_KEY is missing.");

      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: targetModel });
      const result = await aiModel.generateContent(metaPrompt);
      optimizedPrompt = result.response.text();
    }
        // --- B. Groq (Llama, Mixtral) ---
    // 注意：這裡只攔截 Llama 和 Mixtral，避免 DeepSeek/Qwen 被錯誤路由
    else if (targetModel.includes('llama') || targetModel.includes('mixtral')) {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) throw new Error("Server config error: GROQ_API_KEY is missing.");

      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: metaPrompt }],
        model: targetModel,
        temperature: 0.7,
      });
      optimizedPrompt = chatCompletion.choices[0]?.message?.content || "";
    }
        // --- C. Hugging Face (DeepSeek, Qwen, Mistral, Gemma) ---
    // 只要有 "/" 的模型 ID，且不是 Llama (Groq)，都交給 Hugging Face
    else if (targetModel.includes('/')) {
      if (!process.env.HUGGINGFACE_API_KEY) throw new Error("Missing HF API Key");

      // 大多數現代 Instruct 模型 (包含 DeepSeek R1 Distill, Qwen 2.5) 都支援 chatCompletion
      const result = await hf.chatCompletion({
        model: targetModel,
        messages: [{ role: "user", content: metaPrompt }],
        max_tokens: 2048,
        temperature: 0.7,
      });

      optimizedPrompt = result.choices[0].message.content || "";

      // [特殊處理] DeepSeek R1 系列
      // 這些模型通常會輸出 <think>...</think>，我們需要將其過濾掉，只保留優化後的結果
      if (targetModel.toLowerCase().includes('deepseek')) {
        // 移除 <think> 標籤及其內容，並修剪空白
        optimizedPrompt = optimizedPrompt.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      }
    }
    // --- D. Fallback ---
    else {
      console.warn(`Unknown model ${targetModel}, falling back to Gemini`);
      const googleApiKey = process.env.GOOGLE_API_KEY!;
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await aiModel.generateContent(metaPrompt);
      optimizedPrompt = result.response.text();
    }

    return NextResponse.json({ optimizedPrompt });

  } catch (error: any) {
    console.error('Error in /api/optimize:', error);
    return NextResponse.json({ error: error.message || 'Failed to optimize prompt.' }, { status: 500 });
  }
}