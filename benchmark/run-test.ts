// npx ts-node benchmark/run-test.ts

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';

// --- 1. 修復 __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 設定 ---
const BASE_URL = 'http://localhost:3000/api';
const INPUT_FILE = path.join(__dirname, 'test-dataset.json');
const OUTPUT_DIR = path.join(__dirname, 'results');

// *** 修改這裡：設定休息時間 (毫秒) ***
// 建議設為 5000 ~ 10000 (5~10秒) 以避免免費版 API 限制
const DELAY_MS = 15000;

const CONFIG = {
  optimizerModel: 'gemini-2.5-flash',
  generatorModel: 'gemini-2.5-flash-lite',
  judgeModel: 'gemini-2.5-pro',
};

// --- 評分面向對照表 (Key Mapping) ---
const CRITERIA_KEYS: { [key: string]: string } = {
  '內容完整度': 'completeness',
  '需求符合度': 'requirement',
  '結構清晰度': 'structure',
  '創意與洞察力': 'creativity',
  '實用性': 'practicality',
};

// --- 型別定義 ---
interface TestItem {
  id: string;
  category: string;
  prompt: string;
}

interface TestResult extends TestItem {
  optimizedPrompt: string;
  originalOutput: string;
  optimizedOutput: string;
  judgeSummary: string;
  timestamp: string;
  avg_comparison: string;
  win_count: string;
  [key: string]: any;
}

// 輔助函式：等待 (Promise)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- 主程式 ---
async function runBenchmark() {
  console.log('🚀 開始執行自動化測試 (含緩衝冷卻)...');
  console.log(`📋 設定: [Opt: ${CONFIG.optimizerModel}] -> [Gen: ${CONFIG.generatorModel}] -> [Judge: ${CONFIG.judgeModel}]`);
  console.log(`⏳ 每題間隔冷卻時間: ${DELAY_MS / 1000} 秒`);

  const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
  const dataset: TestItem[] = JSON.parse(rawData);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
  }

  const results: TestResult[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // 逐題執行
  for (const [index, item] of dataset.entries()) {
    console.log(`\n---------------------------------------------------------`);
    console.log(`[${index + 1}/${dataset.length}] 正在測試 ID: ${item.id} (${item.category})...`);

    try {
      // Step A: 優化
      process.stdout.write('  - Step 1: 優化 Prompt... ');
      const optimizeRes = await axios.post(`${BASE_URL}/optimize`, {
        prompt: item.prompt,
        model: CONFIG.optimizerModel
      });
      const optimizedPrompt = optimizeRes.data.optimizedPrompt;
      console.log('OK');

      // Step B: 生成
      process.stdout.write('  - Step 2: 生成回答... ');
      const [origGenRes, optGenRes] = await axios.all([
        axios.post(`${BASE_URL}/generate`, { prompt: item.prompt, model: CONFIG.generatorModel }),
        axios.post(`${BASE_URL}/generate`, { prompt: optimizedPrompt, model: CONFIG.generatorModel })
      ]);
      const originalOutput = origGenRes.data.generatedContent;
      const optimizedOutput = optGenRes.data.generatedContent;
      console.log('OK');

      // Step C: 評審
      process.stdout.write('  - Step 3: AI 評審中... ');
      const judgeRes = await axios.post(`${BASE_URL}/judge`, {
        originalPrompt: item.prompt,
        outputA: originalOutput,
        outputB: optimizedOutput,
        model: CONFIG.judgeModel
      });

      const judgeData = judgeRes.data;
      console.log('OK');

      // --- 統計計算 ---
      let totalOrigScore = 0;
      let totalOptScore = 0;
      let winsOrig = 0;
      let winsOpt = 0;
      let countCriteria = 0;
      const scoresMap: {[key: string]: {orig: number, opt: number}} = {};

      if (judgeData.criteria && Array.isArray(judgeData.criteria)) {
        countCriteria = judgeData.criteria.length;
        judgeData.criteria.forEach((c: any) => {
            totalOrigScore += c.scoreA;
            totalOptScore += c.scoreB;
            if (c.scoreB > c.scoreA) winsOpt++;
            else if (c.scoreA > c.scoreB) winsOrig++;

            let key = 'other';
            for (const [zhName, engKey] of Object.entries(CRITERIA_KEYS)) {
                if (c.criterionName.includes(zhName)) {
                    key = engKey;
                    break;
                }
            }
            if (key !== 'other') {
                scoresMap[key] = { orig: c.scoreA, opt: c.scoreB };
            }
        });
      }

      const avgOrig = countCriteria > 0 ? totalOrigScore / countCriteria : 0;
      const avgOpt = countCriteria > 0 ? totalOptScore / countCriteria : 0;
      const diff = Math.abs(avgOpt - avgOrig).toFixed(1);

      let avgCompStr = "Tie";
      if (avgOpt > avgOrig) avgCompStr = `Optimized (+${diff})`;
      else if (avgOrig > avgOpt) avgCompStr = `Original (+${diff})`;

      let winCountStr = "Tie";
      if (winsOpt > winsOrig) winCountStr = `Optimized (${winsOpt}/${countCriteria})`;
      else if (winsOrig > winsOpt) winCountStr = `Original (${winsOrig}/${countCriteria})`;
      else winCountStr = `Tie (${winsOpt}-${winsOrig})`;

      const resultEntry: TestResult = {
        ...item,
        optimizedPrompt,
        originalOutput,
        optimizedOutput,
        judgeSummary: judgeData.summary || 'No summary',
        timestamp: new Date().toISOString(),
        avg_comparison: avgCompStr,
        win_count: winCountStr,
      };

      for (const [key, scores] of Object.entries(scoresMap)) {
          resultEntry[`${key}_orig`] = scores.orig;
          resultEntry[`${key}_opt`] = scores.opt;
      }

      results.push(resultEntry);
      console.log(`  ✅ 完成! [${winCountStr}], Avg: ${avgCompStr}`);

    } catch (error: any) {
      console.error(`\n  ❌ 測試失敗 ID: ${item.id}`);
      if (error.response) {
          console.error(`     Server Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      } else {
          console.error(`     Error: ${error.message}`);
      }
    }

    // *** 這裡修改：加入倒數計時顯示 ***
    if (index < dataset.length - 1) { // 最後一題做完不用等
        process.stdout.write(`  ⏳ 冷卻中 (${DELAY_MS/1000}s): `);
        const steps = 5;
        for (let i = 0; i < steps; i++) {
            process.stdout.write('.');
            await sleep(DELAY_MS / steps);
        }
        console.log(' 繼續');
    }
  }

  // --- CSV Header ---
  const header = [
    { id: 'id', title: 'ID' },
    { id: 'category', title: 'Category' },
    { id: 'avg_comparison', title: '平均分比較' },
    { id: 'win_count', title: '勝場數統計' },
    { id: 'completeness_orig', title: '內容完整度(原)' },
    { id: 'completeness_opt', title: '內容完整度(優)' },
    { id: 'requirement_orig', title: '需求符合度(原)' },
    { id: 'requirement_opt', title: '需求符合度(優)' },
    { id: 'structure_orig', title: '結構清晰度(原)' },
    { id: 'structure_opt', title: '結構清晰度(優)' },
    { id: 'creativity_orig', title: '創意洞察(原)' },
    { id: 'creativity_opt', title: '創意洞察(優)' },
    { id: 'practicality_orig', title: '實用性(原)' },
    { id: 'practicality_opt', title: '實用性(優)' },
    { id: 'judgeSummary', title: 'AI 總評' },
    { id: 'prompt', title: 'Original Prompt' },
    { id: 'optimizedPrompt', title: 'Optimized Prompt' },
    { id: 'originalOutput', title: 'Original Output' },
    { id: 'optimizedOutput', title: 'Optimized Output' },
  ];

  const csvPath = path.join(OUTPUT_DIR, `benchmark_result_${timestamp}.csv`);
  const csvWriter = createObjectCsvWriter({
    path: csvPath,
    header: header
  });

  await csvWriter.writeRecords(results);

  const jsonPath = path.join(OUTPUT_DIR, `benchmark_result_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

  console.log(`\n🎉 測試完成！`);
  console.log(`📂 CSV 報告: ${csvPath}`);
}

runBenchmark();