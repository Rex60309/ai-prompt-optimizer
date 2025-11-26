// app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk'; // 引入 Groq SDK

// 初始化 Groq 客戶端 (放在函式外避免重複初始化)
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY || '', // 即使沒設定，這裡先給空字串，後面再檢查
});

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

    // 1. 處理 Google Gemini 系列
    if (targetModel.includes('gemini')) {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) {
        throw new Error("Server config error: GOOGLE_API_KEY is missing.");
      }

      const genAI = new GoogleGenerativeAI(googleApiKey);

      // 注意：有時候前端選單 ID 與 API 真實 ID 會有細微差異，
      // 如果完全一致則直接使用 targetModel
      const aiModel = genAI.getGenerativeModel({ model: targetModel });
      const result = await aiModel.generateContent(prompt);
      generatedContent = result.response.text();
    }

    // 2. 處理 Groq 系列 (Llama, Mixtral)
    else if (targetModel.includes('llama') || targetModel.includes('mixtral')) {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        throw new Error("Server config error: GROQ_API_KEY is missing.");
      }

      // Groq 的呼叫方式與 OpenAI 非常相似
      const chatCompletion = await groqClient.chat.completions.create({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: targetModel, // 例如 'llama3-8b-8192'
        temperature: 0.7,   // 可選：控制創意度
      });

      // 取得 Groq 的回應內容
      generatedContent = chatCompletion.choices[0]?.message?.content || "";
    }

    // 3. 未知模型
    else {
      throw new Error(`Unsupported model selected: ${targetModel}`);
    }

    // 統一回傳格式
    return NextResponse.json({ generatedContent });

  } catch (error: any) {
    console.error('Error in /api/generate:', error);
    // 讓前端能看到具體的錯誤訊息 (例如 API Key 沒設定)
    return NextResponse.json(
      { error: error.message || 'Failed to generate content.' },
      { status: 500 }
    );
  }
}