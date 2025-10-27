// app/api/generate/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  // --- 同樣把檢查邏輯移到函式內部最前面 ---
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error: Google API key is not set." },
      { status: 500 }
    );
  }
  // --- 檢查結束 ---

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'A prompt is required to generate content.' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent(prompt);
    const generatedContent = result.response.text();

    return NextResponse.json({ generatedContent });

  } catch (error) {
    console.error('Error in /api/generate:', error);
    return NextResponse.json({ error: 'Failed to generate content from AI.' }, { status: 500 });
  }
}