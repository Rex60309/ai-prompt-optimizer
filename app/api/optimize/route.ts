// app/api/optimize/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 導出 POST 函式，所有的邏輯都在這裡面
export async function POST(request: Request) {
  // --- 把檢查邏輯移到函式內部最前面 ---
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: Google API key is not set." },
      { status: 500 }
    );
  }
  // --- 檢查結束 ---

  // 只有在金鑰存在時，才繼續執行後面的程式碼
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const metaPrompt = `
      You are a world-class Prompt Engineer. Your task is to take a user's prompt and meticulously rewrite it to be more effective for a large language model.

      Consider the following techniques for improvement:
      1.  **Role-Playing:** Assign a specific, expert persona to the AI (e.g., "You are a senior copywriter...").
      2.  **Chain of Thought (CoT):** Instruct the AI to break down the problem and think step-by-step.
      3.  **Clarity and Specificity:** Add details, constraints, and context to remove ambiguity.
      4.  **Format Specification:** Define the desired output format (e.g., Markdown table, JSON, bullet points).

      Rewrite the following user prompt. Return ONLY the new, optimized prompt, without any explanations or extra text.
      Do not use MARKDOWN to build the optimized prompt.
      Unless otherwise specified, Traditional Chinese will be used as the default language for the response.

      Original Prompt: "${prompt}"

      Optimized Prompt:
    `;

    const result = await model.generateContent(metaPrompt);
    const optimizedPrompt = result.response.text();

    return NextResponse.json({ optimizedPrompt });

  } catch (error) {
    console.error('Error in /api/optimize:', error);
    return NextResponse.json({ error: 'Failed to optimize prompt.' }, { status: 500 });
  }
}