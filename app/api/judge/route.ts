// app/api/judge/route.ts

import { NextResponse } from 'next/server';

import { complete } from '../../lib/server';
interface Criterion {
  criterionName: string;
  scoreA: number;
  scoreB: number;
  justification: string;
}

// --- 強力 JSON 解析器 (防護 LLM 輸出格式錯誤) ---

function aggressiveJsonParse(text: string) {
  let cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  const firstOpen = cleaned.indexOf('{');

  const lastClose = cleaned.lastIndexOf('}');

  if (firstOpen !== -1 && lastClose !== -1) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  } else {
    throw new Error('No JSON brackets {} found in response');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const fixed = cleaned.replace(/\n/g, '\\n').replace(/\r/g, '');

      return JSON.parse(fixed);
    } catch {
      throw new Error(`Parse failed. Content snippet: ${cleaned.substring(0, 50)}...`);
    }
  }
}

// --- 輔助函式：交換文字中的「前者」與「後者」 (處理位置偏差) ---

function swapTerminology(text: string): string {
  if (!text) return '';

  return text
    .replace(/前者/g, '___TEMP___')

    .replace(/後者/g, '前者')

    .replace(/___TEMP___/g, '後者');
}

const JUDGE_PANEL = [
  {
    id: 'logic',

    persona: '嚴格的評審',

    focus: '所有面向揭完成評估並給出具體評分與建設性回饋',

    temperature: 0.2,

    prefix: 'JudgeA:',
  },

  {
    id: 'creative',

    persona: '嚴格的評審',

    focus: '所有面向揭完成評估並給出具體評分與建設性回饋',

    temperature: 0.6,

    prefix: 'JudgeB:',
  },

  {
    id: 'practical',

    persona: '嚴格的評審',

    focus: '所有面向揭完成評估並給出具體評分與建設性回饋',

    temperature: 0.4,

    prefix: 'JudgeC:',
  },
];

export async function POST(request: Request) {
  try {
    const { originalPrompt, outputA, outputB, model } = await request.json();

    const JUDGE_MODEL = model || 'openai/gpt-oss-20b';

    const isSwapped = Math.random() > 0.5;

    const promptContentA = isSwapped ? outputB : outputA;

    const promptContentB = isSwapped ? outputA : outputB;

    const evaluationPromises = JUDGE_PANEL.map((judge) => async () => {
      // 修改重點：強化具體對比要求，禁止抽象詞彙

      const judgeMetaPrompt = `

        You are a "${judge.persona}". ${judge.focus}

        Analyze and compare Output A and Output B in Traditional Chinese.

        ### 評分與評語原則：

        1. **禁止抽象與概括**：嚴禁使用「表現較好」、「更全面」、「更實用」、「略勝一籌」、「基本符合」等模糊詞彙。

        2. **實質性對比**：必須具體說明差異。例如：「前者僅給出清單，而後者則為每一項增加了具體的執行步驟與風險提示」或「後者在語氣上比前者多使用了引導式提問」。

        3. **引用證據**：請從 A 或 B 中引用關鍵字句來支持你的分析。

        4. **不要提及維度名稱**：在評語中不要說「在內容完整度方面...」，請直接描述內容本身的優劣。

        5. **評分精確度**：評分必須到小數點後第一位 (例如 8.4)。兩者分數不能相同。

        ### 輸出格式 (僅限 JSON):

        {

          "criteria": [

            { "criterionName": "內容完整度", "scoreA": 8.1, "scoreB": 9.2, "justification": "前者漏掉了關於...的具體數據；後者則補足了...並在結尾增加了...的延伸建議。" },

            { "criterionName": "需求符合度", "scoreA": 7.2, "scoreB": 8.5, "justification": "前者忽視了原始需求中...的要求；後者則精確捕捉了...這一核心目標。" },

            { "criterionName": "結構清晰度", "scoreA": 8.0, "scoreB": 7.3, "justification": "前者使用了層次分明的 Markdown 標題，導航感強；後者的段落過長，缺乏清晰的層級劃分。" },

            { "criterionName": "創意與洞察力", "scoreA": 6.2, "scoreB": 8.8, "justification": "前者內容流於表面；後者提出了關於...的獨特視角，且這種觀點在前者中完全未被提及。" },

            { "criterionName": "語氣風格", "scoreA": 7.5, "scoreB": 9.3, "justification": "前者語氣生硬機械；後者展現了強烈的...風格，並使用了如『...』等感性詞彙。" }

          ],

          "summary": "直接進入具體的對比總結。描述後者如何透過具體的改進行為（例如：增加了 Persona 設定、明確了 CoT 步驟）解決了前者的哪些實際缺陷。",

          "weaknesses": "列出 2-3 個針對『後者』的具體修正建議，必須具體到可以被 Prompt 工程師拿來修正指令。"

        }

        Rules: Replace Output A with "前者", Output B with "後者".

        **Original User Prompt:** """${originalPrompt}"""

        **前者 (A):** """${promptContentA}"""

        **後者 (B):** """${promptContentB}"""

      `;

      const response = await complete(judgeMetaPrompt, JUDGE_MODEL, true, request.signal, {
        temperature: judge.temperature,
        system: 'You are a precise analyzer. Answer in Traditional Chinese. Output JSON only.',
      });
      const parsed = aggressiveJsonParse(response.content);

      if (isSwapped) {
        parsed.criteria = parsed.criteria.map((item: Criterion) => ({
          ...item,
          scoreA: item.scoreB,
          scoreB: item.scoreA,
          justification: swapTerminology(item.justification),
        }));

        parsed.summary = swapTerminology(parsed.summary);
      }

      return { success: true, judgeId: judge.id, prefix: judge.prefix, data: parsed };
    });

    const results: Awaited<ReturnType<(typeof evaluationPromises)[number]>>[] = [];
    for (const evaluate of evaluationPromises) results.push(await evaluate());

    const CRITERIA_NAMES = ['內容完整度', '需求符合度', '結構清晰度', '創意與洞察力', '語氣風格'];

    const aggregatedCriteria = CRITERIA_NAMES.map((name, index) => {
      let sumA = 0,
        sumB = 0,
        combinedJ = '';

      results.forEach((res) => {
        const crit =
          res.data.criteria.find((c: Criterion) => c.criterionName.includes(name.split(' ')[0])) ||
          res.data.criteria[index];

        if (crit) {
          sumA += crit.scoreA;
          sumB += crit.scoreB;

          combinedJ += `【${res.prefix}】：${crit.justification}\n`;
        }
      });

      return {
        criterionName: name,

        scoreA: Number((sumA / results.length).toFixed(1)),

        scoreB: Number((sumB / results.length).toFixed(1)),

        justification: combinedJ.trim(),
      };
    });

    return NextResponse.json({
      criteria: aggregatedCriteria,

      summary: results
        .map((res) => `### ${res.prefix}\n${res.data.summary}`)
        .join('\n\n---\n\n')

        .replace(/前者[:：]/g, '**前者(原始)**：')
        .replace(/後者[:：]/g, '**後者(優化)**：'),

      weaknesses: results
        .map((res) => res.data.weaknesses)
        .filter(Boolean)
        .join(' '),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
