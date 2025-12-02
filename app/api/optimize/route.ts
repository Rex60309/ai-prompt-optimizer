// app/api/optimize/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';

// 初始化 Groq 客戶端
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// 初始化 HF
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

export async function POST(request: Request) {
  try {
    // 1. 接收 model 參數
    const { prompt, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 2. 設定預設值 (如果前端沒傳)
    const targetModel = model || 'gemini-2.5-flash';
    let optimizedPrompt = '';

    // --- Meta Prompt (提示工程師的核心指令) ---
    const metaPrompt = `
      You are a world-class Prompt Engineer. Your task is to take a user's prompt and meticulously rewrite it to be more effective for a large language model.

      Consider the following techniques for improvement:
      1.  **Role-Playing:** Assign a specific, expert persona to the AI (e.g., "You are a senior copywriter...").
      2.  **Chain of Thought (CoT):** Instruct the AI to break down the problem and think step-by-step.
      3.  **Clarity and Specificity:** Add details, constraints, and context to remove ambiguity.
      4.  **Format Specification:** Define the desired output format (e.g., Markdown table, JSON, bullet points).

      Rewrite the following user prompt. Return ONLY the new, optimized prompt, without any explanations or extra text.
      Do not use MARKDOWN to build the optimized prompt.
      Unless otherwise specified, use Traditional Chinese for the response.
      若原始的prompt為詢問教學的內容，請一次回答完所有內容
      若回答過長會導致有截斷部分的話，請在一定程度上限制回覆字數
      列點時不用使用**包起來

      Original Prompt: "${prompt}"

      Optimized Prompt:
    `;

    // --- 分流邏輯：根據模型名稱決定使用哪家供應商 ---

    // A. Google Gemini 系列
    if (targetModel.includes('gemini')) {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) {
        throw new Error("Server config error: GOOGLE_API_KEY is missing.");
      }
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: targetModel });
      const result = await aiModel.generateContent(metaPrompt);
      optimizedPrompt = result.response.text();
    }
    // B. Groq 系列 (Llama, Mixtral)
    else if (targetModel.includes('llama') || targetModel.includes('mixtral')) {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        throw new Error("Server config error: GROQ_API_KEY is missing.");
      }
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: metaPrompt }],
        model: targetModel,
        temperature: 0.7,
      });
      optimizedPrompt = chatCompletion.choices[0]?.message?.content || "";
    }

    // Hugging Face
    else if (targetModel.includes('/')) {
       if (!process.env.HUGGINGFACE_API_KEY) throw new Error("Missing HF API Key");

       const result = await hf.chatCompletion({
          model: targetModel,
          messages: [{ role: "user", content: metaPrompt }],
          max_tokens: 2048,
          temperature: 0.7,
       });
       optimizedPrompt = result.choices[0].message.content || "";
    }

    // C. 未知模型
    else {
      // 如果遇到未知的模型，退回到預設的 Gemini (或拋出錯誤)
      console.warn(`Unknown model ${targetModel}, falling back to gemini-2.5-flash`);
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