import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// --- 強力 JSON 解析器 ---
function aggressiveJsonParse(text: string) {
  // 1. 基本清理：移除 Markdown 標記
  let cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

  // 2. 提取最外層的大括號 (防止前後有雜訊文字)
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');

  if (firstOpen !== -1 && lastClose !== -1) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  } else {
    throw new Error("No JSON brackets {} found in response");
  }

  try {
    // 3. 嘗試標準解析
    return JSON.parse(cleaned);
  } catch (e) {
    // 4. 如果失敗，嘗試修復常見錯誤：
    // 很多時候 LLM 會在字串裡直接換行，這是 JSON 不允許的。
    // 我們嘗試把字串內的「實際換行」替換成「\n」
    // 注意：這是一個簡單的 heuristic 修復，無法涵蓋所有情況
    try {
      const fixed = cleaned.replace(/\n/g, "\\n").replace(/\r/g, "");
      return JSON.parse(fixed);
    } catch (e2) {
      // 如果還是失敗，拋出原始內容以便除錯
      throw new Error(`Parse failed. Content snippet: ${cleaned.substring(0, 50)}...`);
    }
  }
}

// --- 輔助函式：交換文字中的「前者」與「後者」 ---
function swapTerminology(text: string): string {
  if (!text) return "";
  return text.replace(/前者/g, "___TEMP___")
      .replace(/後者/g, "前者")
      .replace(/___TEMP___/g, "後者");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set." }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const { originalPrompt, outputA, outputB } = await request.json();

    if (!originalPrompt || !outputA || !outputB) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // ★★★ 建議先改回 gpt-4o 測試，確認是否為模型問題 ★★★
    const JUDGE_MODEL = 'gpt-5-mini';

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
      - Don't let scores get too inflated.
      - 兩者的分數不能相同，可以到小數點後第一位，且允許差距大
      - Please replace Output A with the term "前者" when using output; replace Output B with the term "後者" when using output.
      - 評語不要有Output A或Output B的詞彙出現
      - 請無視是否有回答截斷的部分，請就已產出的內容作評分比較
      - **CRITICAL**: The "summary" field MUST start with a bold statement indicating the winner, followed by a newline. Example: "**前者:表現較好!**\\n\\n(Rest of the summary...)"
      - Do not output markdown code blocks. Output raw JSON only.
    
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
    `;

    const response = await openai.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [
        { role: "system", content: "You are a JSON generator. output valid JSON only." },
        { role: "user", content: judgeMetaPrompt }
      ],
      response_format: { type: "json_object" }, // 強制 JSON
    });

    const textResponse = response.choices[0].message.content || "";

    // --- 解析與錯誤處理 ---
    let judgeResult;
    try {
      judgeResult = aggressiveJsonParse(textResponse);
    } catch (parseError: any) {
      // ★★★ 關鍵除錯點 ★★★
      // 請在你的 VS Code / Terminal 看這裡印出的內容
      console.error("=============== JSON PARSE ERROR ===============");
      console.error("Error Message:", parseError.message);
      console.error("Raw AI Response:", textResponse);
      console.error("================================================");

      return NextResponse.json({
        error: "AI response was not in a valid JSON format.",
        details: parseError.message,
        raw_snippet: textResponse.substring(0, 100) // 回傳部分內容給前端顯示
      }, { status: 500 });
    }

    // --- 位置偏差還原 ---
    if (isSwapped) {
      if (judgeResult.criteria) {
        judgeResult.criteria = judgeResult.criteria.map((item: any) => ({
          ...item,
          scoreA: item.scoreB,
          scoreB: item.scoreA,
          justification: swapTerminology(item.justification)
        }));
      }
      if (judgeResult.summary) {
        judgeResult.summary = swapTerminology(judgeResult.summary);
      }
    }

    // --- 美化輸出 ---
    if (judgeResult.summary) {
      judgeResult.summary = judgeResult.summary
          .replace(/前者[:：]/, "**前者(原始)**：")
          .replace(/後者[:：]/, "**後者(優化)**：");
    }

    return NextResponse.json(judgeResult);

  } catch (error: any) {
    console.error('Error in /api/judge:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}