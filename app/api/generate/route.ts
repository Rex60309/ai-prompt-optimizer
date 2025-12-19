// app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';
import OpenAI from 'openai'; // 1. 新增 OpenAI 導入

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

    // C. OpenAI (GPT-5.2, GPT-5-mini, GPT-4.1 etc.)
    // 新增邏輯：捕捉所有以 'gpt-' 開頭的模型
    else if (targetModel.toLowerCase().startsWith('gpt-')) {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) throw new Error("Server config error: OPENAI_API_KEY is missing.");

      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });

      // [FIX] 針對 mini 模型 (通常是 Reasoning 模型) 強制設定 temperature 為 1
      // 許多新模型不支援非 1 的 temperature
      const isReasoningModel = targetModel.includes('mini') || targetModel.includes('o1');

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: targetModel,
        // 如果是 mini 模型，設為 1；否則維持 0.7
        temperature: isReasoningModel ? 1 : 0.7,
      });

      generatedContent = completion.choices[0].message.content || "";
    }

        // D. Hugging Face (DeepSeek, Qwen, Mistral, Gemma 等)
    // 只要有 "/" 的模型 ID (例如 deepseek-ai/DeepSeek-R1)，都交給 Hugging Face
    else if (targetModel.includes('/')) {
      if (!process.env.HUGGINGFACE_API_KEY) throw new Error("Missing HF API Key");

      const result = await hf.chatCompletion({
        model: targetModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.7,
      });

      generatedContent = result.choices[0].message.content || "";

      // [特殊處理] DeepSeek R1 系列過濾 <think> 標籤
      if (targetModel.toLowerCase().includes('deepseek')) {
        generatedContent = generatedContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      }
    }

    // E. Error: Unknown Model (Fallback)
    else {
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