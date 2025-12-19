// app/api/judge/route.ts

import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

// --- 輔助函式：清洗 JSON 字串 ---
function sanitizeJsonString(str: string): string {
  let inString = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inString = !inString;
    }
    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        // ignore
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

// --- 輔助函式：交換文字中的「前者」與「後者」 (僅負責交換) ---
function swapTerminology(text: string): string {
  if (!text) return "";
  // 1. 前者 -> ___TEMP___
  // 2. 後者 -> 前者
  // 3. ___TEMP___ -> 後者
  return text.replace(/前者/g, "___TEMP___")
      .replace(/後者/g, "前者")
      .replace(/___TEMP___/g, "後者");
}

export async function POST(request: Request) {
  const hfApiKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfApiKey) {
    return NextResponse.json({ error: "Server configuration error: HUGGINGFACE_API_KEY is not set." }, { status: 500 });
  }

  const hf = new HfInference(hfApiKey);

  try {
    const { originalPrompt, outputA, outputB } = await request.json();

    if (!originalPrompt || !outputA || !outputB) {
      return NextResponse.json({ error: 'Missing required fields for judgment.' }, { status: 400 });
    }

    const JUDGE_MODEL = 'Qwen/Qwen2.5-72B-Instruct';

    // --- Step 1: 位置偏差處理 (Blind Test) ---
    const isSwapped = Math.random() > 0.5;

    const promptContentA = isSwapped ? outputB : outputA;
    const promptContentB = isSwapped ? outputA : outputB;

    const judgeMetaPrompt = `
      You are a meticulous and impartial AI Output Evaluator. Your task is to analyze and compare two outputs (Output A and Output B).
      Your evaluation must be based on the following five criteria, scoring each from 1 (worst) to 10 (best).
    
      Here are the inputs you will receive:
      - **Original User Prompt**: The initial request from the user.
      - **Output A**: Candidate Response A.
      - **Output B**: Candidate Response B.
    
      Here are the evaluation criteria:
      1.  **內容完整度 Completeness & Detail**: Does the response cover all key aspects of the topic with sufficient depth?
      2.  **需求符合度 Adherence to Instructions**: Does the output strictly follow all explicit constraints?
      3.  **結構清晰度 Clarity & Structure**: Is the logic flow coherent? Does it effectively use formatting?
      4.  **創意與洞察力 Creativity & Insight**: Does the content offer unique perspectives or deep analysis?
      5.  **語氣風格 Tone & Style**: Is the tone engaging and appropriate for the context?
    
      Please provide your response ONLY in a valid JSON format. Do not include any text, explanations, or markdown formatting outside of the JSON object. The JSON object should have two keys: "criteria" and "summary".
      - The "criteria" key should be an array of objects, where each object represents one evaluation criterion and contains: "criterionName", "scoreA", "scoreB", and a brief "justification".
      - The "summary" key should contain a concise overall analysis, comparing the two outputs and declaring which one is superior and why.
    
      Please note the following:
      - Use "traditional chinese" to response.
      - Use Markdown to demonstrate inside the JSON strings if needed.
      - Don't let scores get too inflated.
      - 兩者的分數不能相同，可以到小數點後第一位，且允許差距大
      - Please replace Output A with the term "前者" when using output; replace Output B with the term "後者" when using output.
      - 評語不要有Output A或Output B的詞彙出現
      - 請無視是否有回答截斷的部分，請就已產出的內容作評分比較
      - **CRITICAL**: The "summary" field MUST start with a bold statement indicating the winner, followed by a newline. Example: "**前者:表現較好!**\\n\\n(Rest of the summary...)"
      - IMPORTANT: Ensure all newlines inside string values are escaped (use \\n, do not use literal line breaks).
      - Do not output markdown code blocks (like \`\`\`json). Output raw JSON only.
    
      **INPUTS:**
      **Original User Prompt:**
      """
      ${originalPrompt}
      """
      **Output A:**
      """
      ${promptContentA}
      """
      **Output B:**
      """
      ${promptContentB}
      """
      **JSON OUTPUT:**
    `;

    const response = await hf.chatCompletion({
      model: JUDGE_MODEL,
      messages: [
        { role: "user", content: judgeMetaPrompt }
      ],
      max_tokens: 4096,
      temperature: 0.5,
    });

    const textResponse = response.choices[0].message.content || "";

    // --- JSON 解析 ---
    let judgeResult;
    try {
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON object found in AI response.");
      }
      let jsonString = jsonMatch[0];
      jsonString = sanitizeJsonString(jsonString);
      judgeResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON. Raw:", textResponse);
      throw new Error("AI response was not in a valid JSON format after sanitization.");
    }

    // --- Step 2: 位置偏差處理 - 校正回歸 (Restore Order) ---
    if (isSwapped) {
      // 1. 交換分數
      if (judgeResult.criteria && Array.isArray(judgeResult.criteria)) {
        judgeResult.criteria = judgeResult.criteria.map((item: any) => ({
          ...item,
          scoreA: item.scoreB,
          scoreB: item.scoreA,
          justification: swapTerminology(item.justification) // 交換評語中的指涉
        }));
      }

      // 2. 交換 Summary 中的指涉
      if (judgeResult.summary) {
        judgeResult.summary = swapTerminology(judgeResult.summary);
      }
    }

    // --- Step 3: 美化標籤 (無論是否交換，最後統一執行) ---
    // 這一步確保無論 isSwapped 是 true 還是 false，"前者:" 都會變成 "前者(原始prompt)的"
    if (judgeResult.summary) {
      judgeResult.summary = judgeResult.summary
          .replace(/前者[:：]/, "前者(原始prompt)的") // 支援半形或全形冒號
          .replace(/後者[:：]/, "後者(優化prompt)的");
    }

    return NextResponse.json(judgeResult);

  } catch (error: any) {
    console.error('Error in /api/judge:', error);
    return NextResponse.json({ error: error.message || 'Failed to get judgment from AI.' }, { status: 500 });
  }
}