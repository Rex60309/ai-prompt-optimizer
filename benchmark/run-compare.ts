// npx ts-node benchmark/run-compare.ts

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { fileURLToPath } from 'url';

// --- 1. 路徑設定 ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 2. 測試設定 ---
const BASE_URL = 'http://localhost:3000/api';
const INPUT_FILE = path.join(__dirname, 'test-dataset.json');
const OUTPUT_DIR = path.join(__dirname, 'results');

// 題與題之間的冷卻時間 (毫秒)
const DELAY_MS = 10000;

// *** 核心設定：比較哪兩個策略 ***
// 可選值: 'original' (原始輸入) | 'role-play' | 'structured' | 'cot' | 'hybrid'
const STRATEGY_A = 'original';   // 設定 A 為原始輸入 (Baseline)
const STRATEGY_B = 'role-play';     // 設定 B 為優化策略 (Experiment)

// 更新模型配置
const CONFIG = {
    optimizerModel: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', // 優化prompt
    generatorModel: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B', // 輸出回答
    judgeModel: 'Qwen/Qwen2.5-72B-Instruct', // 評審
};

// --- 評分面向對照表 ---
const CRITERIA_KEYS: { [key: string]: string } = {
    '內容完整度': 'completeness',
    '需求符合度': 'requirement',
    '結構清晰度': 'structure',
    '創意與洞察力': 'creativity',
    '語氣風格': 'tone_style'  // 針對新版 Judge Prompt 增加這個 mapping
};

// --- 型別定義 ---
interface TestItem {
    id: string;
    category: string;
    prompt: string;
}

interface StrategyResult extends TestItem {
    promptA: string;
    promptB: string;
    outputA: string;
    outputB: string;
    judgeSummary: string;
    comparison: string;
    win_count: string;
    timestamp: string;
    [key: string]: any;
}

// 輔助函式：等待
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// 輔助函式：四捨五入到小數點後第一位 (回傳數字)
const roundTo1Decimal = (num: number) => Math.round(num * 10) / 10;

// 輔助函式：帶有重試機制的 API 呼叫
async function callApiWithRetry(url: string, data: any, retries = 3, delay = 2000): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            return await axios.post(url, data);
        } catch (error: any) {
            const isLastAttempt = i === retries - 1;
            const status = error.response?.status;

            // 如果是 503 (Overloaded) 或 429 (Too Many Requests)，顯示黃色警告並重試
            if (status === 503 || status === 429) {
                console.warn(`    ⚠️  API 忙線中 (${status})，等待 ${delay / 1000}秒後重試 (${i + 1}/${retries})...`);
                if (isLastAttempt) throw error;
                await sleep(delay);
                delay *= 2; // 指數退避
            } else {
                throw error;
            }
        }
    }
}

// 核心邏輯：取得 Prompt (如果是 original 則不優化)
async function getPromptForStrategy(strategy: string, userPrompt: string, modelName: string): Promise<string> {
    // 若策略設為 'original'，直接回傳原始輸入
    if (strategy === 'original') {
        return userPrompt;
    }

    // 否則呼叫優化 API
    const res = await callApiWithRetry(`${BASE_URL}/optimize`, {
        prompt: userPrompt,
        model: modelName,
        strategy: strategy
    });
    return res.data.optimizedPrompt;
}

// --- 主程式 ---
async function runStrategyBenchmark() {
    console.log('🚀 開始執行「策略對決」自動化測試 (支援 Original 模式)...');
    console.log(`⚔️  對決組合: [Strategy A: ${STRATEGY_A}] vs [Strategy B: ${STRATEGY_B}]`);
    console.log(`🤖 模型設定:\n    Opt:   ${CONFIG.optimizerModel}\n    Gen:   ${CONFIG.generatorModel}\n    Judge: ${CONFIG.judgeModel}`);

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ 找不到測試資料檔案: ${INPUT_FILE}`);
        return;
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const dataset: TestItem[] = JSON.parse(rawData);

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR);
    }

    const results: StrategyResult[] = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // --- 逐題執行 ---
    for (const [index, item] of dataset.entries()) {
        console.log(`\n---------------------------------------------------------`);
        console.log(`[${index + 1}/${dataset.length}] 測試題目 ID: ${item.id} (${item.category})...`);

        try {
            // ------------------------------------------------
            // Step 1: 準備 Prompt (優化 或 原始)
            // ------------------------------------------------
            process.stdout.write(`  - Step 1: 準備 Prompt (${STRATEGY_A} vs ${STRATEGY_B})... `);

            // 取得 Prompt A
            const promptA = await getPromptForStrategy(STRATEGY_A, item.prompt, CONFIG.optimizerModel);
            // 避免 API Rate Limit，中間稍微休息
            if (STRATEGY_A !== 'original') await sleep(1000);

            // 取得 Prompt B
            const promptB = await getPromptForStrategy(STRATEGY_B, item.prompt, CONFIG.optimizerModel);

            console.log('OK');

            // ------------------------------------------------
            // Step 2: 雙重生成 (使用 generatorModel)
            // ------------------------------------------------
            process.stdout.write('  - Step 2: 生成回答... ');

            const genResA = await callApiWithRetry(`${BASE_URL}/generate`, {
                prompt: promptA,
                model: CONFIG.generatorModel
            });
            const outputA = genResA.data.generatedContent;

            await sleep(1000);

            const genResB = await callApiWithRetry(`${BASE_URL}/generate`, {
                prompt: promptB,
                model: CONFIG.generatorModel
            });
            const outputB = genResB.data.generatedContent;

            console.log('OK');

            // ------------------------------------------------
            // Step 3: AI 評審
            // ------------------------------------------------
            process.stdout.write('  - Step 3: AI 評審對決中... ');

            const judgeRes = await callApiWithRetry(`${BASE_URL}/judge`, {
                originalPrompt: item.prompt,
                outputA: outputA,
                outputB: outputB,
                model: CONFIG.judgeModel
            });

            const judgeData = judgeRes.data;
            console.log('OK');

            // ------------------------------------------------
            // Step 4: 統計分數 (含四捨五入邏輯)
            // ------------------------------------------------
            let totalScoreA = 0;
            let totalScoreB = 0;
            let winsA = 0;
            let winsB = 0;
            let countCriteria = 0;
            const scoresMap: { [key: string]: { scoreA: string, scoreB: string } } = {};

            if (judgeData.criteria && Array.isArray(judgeData.criteria)) {
                countCriteria = judgeData.criteria.length;
                judgeData.criteria.forEach((c: any) => {
                    // 強制轉型並四捨五入至小數點後一位
                    const rawScoreA = Number(c.scoreA);
                    const rawScoreB = Number(c.scoreB);

                    const scoreA = roundTo1Decimal(rawScoreA);
                    const scoreB = roundTo1Decimal(rawScoreB);

                    totalScoreA += scoreA;
                    totalScoreB += scoreB;

                    if (scoreA > scoreB) winsA++;
                    else if (scoreB > scoreA) winsB++;

                    let key = 'other';
                    // 根據中文名稱 mapping 到英文 key (方便 CSV 閱讀)
                    for (const [zhName, engKey] of Object.entries(CRITERIA_KEYS)) {
                        if (c.criterionName.includes(zhName)) {
                            key = engKey;
                            break;
                        }
                    }
                    if (key !== 'other') {
                        scoresMap[key] = { scoreA: scoreA.toFixed(1), scoreB: scoreB.toFixed(1) };
                    } else {
                        // 處理未在 mapping 中的其他面向 (例如 tone_style 若名稱不符)
                        // 可以用 criterionName 作為 fallback key
                        const fallbackKey = c.criterionName.split(' ')[0]; // 取第一個詞
                        scoresMap[fallbackKey] = { scoreA: scoreA.toFixed(1), scoreB: scoreB.toFixed(1) };
                    }
                });
            }

            // 總分差
            const diffVal = Math.abs(totalScoreB - totalScoreA);
            const diff = roundTo1Decimal(diffVal).toFixed(1);

            let compStr = "Tie";
            if (totalScoreA > totalScoreB) compStr = `${STRATEGY_A} (+${diff})`;
            else if (totalScoreB > totalScoreA) compStr = `${STRATEGY_B} (+${diff})`;

            let winCountStr = "Tie";
            if (winsA > winsB) winCountStr = `${STRATEGY_A} wins (${winsA}/${countCriteria})`;
            else if (winsB > winsA) winCountStr = `${STRATEGY_B} wins (${winsB}/${countCriteria})`;
            else winCountStr = `Draw (${winsA}-${winsB})`;

            // ------------------------------------------------
            // Step 5: 儲存結果
            // ------------------------------------------------
            const resultEntry: StrategyResult = {
                ...item,
                promptA,
                promptB,
                outputA,
                outputB,
                judgeSummary: judgeData.summary || 'No summary',
                comparison: compStr,
                win_count: winCountStr,
                timestamp: new Date().toISOString()
            };

            for (const [key, scores] of Object.entries(scoresMap)) {
                resultEntry[`${key}_stratA`] = scores.scoreA;
                resultEntry[`${key}_stratB`] = scores.scoreB;
            }

            results.push(resultEntry);
            console.log(`  ✅ 評測完成! 結果: [${compStr}]`);

        } catch (error: any) {
            console.error(`\n  ❌ 測試失敗 ID: ${item.id}`);
            if (error.response) {
                console.error(`     Server Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else {
                console.error(`     Error: ${error.message}`);
            }
        }

        if (index < dataset.length - 1) {
            process.stdout.write(`  ⏳ 冷卻中 (${DELAY_MS / 1000}s): `);
            const steps = 5;
            for (let i = 0; i < steps; i++) {
                process.stdout.write('.');
                await sleep(DELAY_MS / steps);
            }
            console.log(' 繼續');
        }
    }

    // --- 3. 輸出 CSV ---
    const header = [
        { id: 'id', title: 'ID' },
        { id: 'category', title: 'Category' },
        { id: 'comparison', title: '總分比較' },
        { id: 'win_count', title: '勝場統計' },

        // 注意：這裡的 Header Title 會動態顯示策略名稱，例如 "結構清晰(original)" vs "結構清晰(structured)"
        { id: 'completeness_stratA', title: `內容完整(${STRATEGY_A})` },
        { id: 'completeness_stratB', title: `內容完整(${STRATEGY_B})` },
        { id: 'requirement_stratA', title: `需求符合(${STRATEGY_A})` },
        { id: 'requirement_stratB', title: `需求符合(${STRATEGY_B})` },
        { id: 'structure_stratA', title: `結構清晰(${STRATEGY_A})` },
        { id: 'structure_stratB', title: `結構清晰(${STRATEGY_B})` },
        { id: 'creativity_stratA', title: `創意洞察(${STRATEGY_A})` },
        { id: 'creativity_stratB', title: `創意洞察(${STRATEGY_B})` },
        { id: 'tone_style_stratA', title: `語氣風格(${STRATEGY_A})` },
        { id: 'tone_style_stratB', title: `語氣風格(${STRATEGY_B})` },

        { id: 'judgeSummary', title: 'AI 評語' },
        { id: 'prompt', title: 'Original User Prompt' },
        { id: 'promptA', title: `Prompt (${STRATEGY_A})` },
        { id: 'promptB', title: `Prompt (${STRATEGY_B})` },
        { id: 'outputA', title: `Output (${STRATEGY_A})` },
        { id: 'outputB', title: `Output (${STRATEGY_B})` },
    ];

    const csvFilename = `strategy_compare_${STRATEGY_A}_vs_${STRATEGY_B}_${timestamp}.csv`;
    const csvPath = path.join(OUTPUT_DIR, csvFilename);

    const csvWriter = createObjectCsvWriter({
        path: csvPath,
        header: header
    });

    await csvWriter.writeRecords(results);

    // 同時存一份 JSON 備份
    const jsonPath = path.join(OUTPUT_DIR, `strategy_compare_${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    console.log(`\n🎉 全部測試完成！`);
    console.log(`📂 CSV 報告: ${csvPath}`);
}

runStrategyBenchmark();