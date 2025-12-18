// app/api/generate/route.ts

// app/api/generate/route.ts

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
    const { prompt, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 });
    }

    // 預設模型
    const targetModel = model || 'gemini-2.5-flash';
    let generatedContent = '';

    // --- 分流邏輯：根據模型名稱決定使用哪家供應商 ---

    // A. Google Gemini
    if (targetModel.includes('gemini')) {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) {
        throw new Error("Server config error: GOOGLE_API_KEY is missing.");
      }

      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: targetModel });

      const result = await aiModel.generateContent(prompt);
      generatedContent = result.response.text();
    }

        // B. Groq (Llama, Mixtral)
    // 這裡只攔截 Llama 和 Mixtral，避免 DeepSeek/Qwen 被錯誤路由到 Groq (如果 Groq 不支援該 ID)
    else if (targetModel.includes('llama') || targetModel.includes('mixtral')) {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        throw new Error("Server config error: GROQ_API_KEY is missing.");
      }

      const chatCompletion = await groqClient.chat.completions.create({
        messages: [
          { role: "user", content: prompt },
        ],
        model: targetModel,
        temperature: 0.7,
      });

      generatedContent = chatCompletion.choices[0]?.message?.content || "";
    }

        // C. Hugging Face (DeepSeek, Qwen, Mistral, Gemma 等)
    // 只要有 "/" 的模型 ID，且不是 Llama (Groq)，都交給 Hugging Face
    else if (targetModel.includes('/')) {
      if (!process.env.HUGGINGFACE_API_KEY) throw new Error("Missing HF API Key");

      // 使用 chatCompletion 介面 (大多數現代 Instruct 模型都支援)
      const result = await hf.chatCompletion({
        model: targetModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.7,
      });

      generatedContent = result.choices[0].message.content || "";

      // [特殊處理] DeepSeek R1 系列
      // 如果使用的是 DeepSeek R1 模型，它會輸出 <think>...</think> 思考過程
      // 為了讓 Generator 的回答乾淨直接，我們這裡將其過濾掉
      if (targetModel.toLowerCase().includes('deepseek')) {
        generatedContent = generatedContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      }
    }

    // D. Error: Unknown Model
    else {
      // 如果遇到未知的模型 ID，您可以選擇報錯，或是 fallback 到預設模型
      console.warn(`Unknown model ${targetModel}, falling back to Gemini`);
      const googleApiKey = process.env.GOOGLE_API_KEY!;
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await aiModel.generateContent(prompt);
      generatedContent = result.response.text();
    }

    // 統一回傳格式
    return NextResponse.json({ generatedContent });

  } catch (error: any) {
    console.error('Error in /api/generate:', error);
    return NextResponse.json(
        { error: error.message || 'Failed to generate content.' },
        { status: 500 }
    );
  }
}