// app/api/judge/route.ts

// app/api/judge/route.ts

import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

export async function POST(request: Request) {
  // 1. 改用 Hugging Face API Key
  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfApiKey) {
    return NextResponse.json({ error: "Server configuration error: HUGGINGFACE_API_KEY is not set." }, { status: 500 });
  }

  // 初始化 HF Client
  const hf = new HfInference(hfApiKey);

  try {
    const { originalPrompt, outputA, outputB } = await request.json();

    if (!originalPrompt || !outputA || !outputB) {
      return NextResponse.json({ error: 'Missing required fields for judgment.' }, { status: 400 });
    }

    // 2. 指定使用 Qwen 2.5 72B 模型
    const JUDGE_MODEL = 'Qwen/Qwen2.5-72B-Instruct';

    // Meta-Prompt (保持原樣，完全未更動)
    const judgeMetaPrompt = `
      You are a meticulous and impartial AI Output Evaluator. Your task is to analyze and compare two outputs (Output A and Output B).
      Your evaluation must be based on the following five criteria, scoring each from 1 (worst) to 10 (best).
      Here are the inputs you will receive:
      - **Original User Prompt**: The initial request from the user.
      - **Output A**: The result generated from the original, un-optimized prompt.
      - **Output B**: The result generated from an optimized version of the prompt.
      Here are the evaluation criteria:
      1.  **內容完整度 Completeness & Detail**: How comprehensive and detailed is the output?
      2.  **需求符合度 Adherence to Instructions**: How well does the output follow the user's original request?
      3.  **結構清晰度 Clarity & Structure**: How clear, well-organized, and easy to read is the output?
      4.  **創意與洞察力 Creativity & Insight**: Does the output offer creative or insightful perspectives?
      5.  **實用性 Practicality**: How practical and useful is the output for the user?
      Please provide your response ONLY in a valid JSON format. Do not include any text, explanations, or markdown formatting outside of the JSON object. The JSON object should have two keys: "criteria" and "summary".
      - The "criteria" key should be an array of objects, where each object represents one evaluation criterion and contains: "criterionName", "scoreA", "scoreB", and a brief "justification".
      - The "summary" key should contain a concise overall analysis, comparing the two outputs and declaring which one is superior and why.
      Please note the following:
      - Use "traditional chinese" to response.
      - Use Markdown to demonstrate.
      - Don't let scores get too inflated.
      - 兩者的分數要不相同，到小數點後一位
      - Please replace Output A with the term "前者" when using output; replace Output B with the term "後者" when using output.
      - 評語不要有Output A或Output B的詞彙出現
      - 請無視是否有回答截斷的部分，請就已產出的內容作評分比較
      - 第一行用較大的字體且粗體先寫出是 **前者:原始prompt的輸出比較好!** 還是 **後者:優化prompt的輸出比較好!** 並且記得換行
      - When evaluating, do not favor outputs solely because they are longer. Consider conciseness and relevance as part of quality.
      - Do not output markdown code blocks. Output raw JSON only.

      **INPUTS:**
      **Original User Prompt:**
      """
      ${originalPrompt}
      """
      **Output A:**
      """
      ${outputA}
      """
      **Output B:**
      """
      ${outputB}
      """
      **JSON OUTPUT:**
    `;

    // 3. 呼叫 Hugging Face Chat Completion
    const response = await hf.chatCompletion({
      model: JUDGE_MODEL,
      messages: [
        { role: "user", content: judgeMetaPrompt }
      ],
      max_tokens: 4096, // 給予足夠的空間產生完整的 JSON 報告
      temperature: 0.5, // 降低溫度以確保評分客觀穩定
    });

    const textResponse = response.choices[0].message.content || "";

    // --- JSON 解析邏輯 (保持不變) ---
    try {
      // 尋找被 `{` 和 `}` 包起來的第一個區塊
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON object found in AI response.");
      }
      const jsonString = jsonMatch[0];
      const judgeResult = JSON.parse(jsonString);
      return NextResponse.json(judgeResult);
    } catch (parseError) {
      console.error("Failed to parse JSON from AI response. Raw response:", textResponse);
      throw new Error("AI response was not in a valid JSON format.");
    }

  } catch (error) {
    console.error('Error in /api/judge:', error);
    return NextResponse.json({ error: 'Failed to get judgment from AI.' }, { status: 500 });
  }
}