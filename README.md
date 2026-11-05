# AI Prompt Optimizer

提示詞自動優化專題：四種策略改寫、雙版本回答比較，以及後台批次評分。

## 啟動

需要 Node.js 22.18+。執行 `npm ci`，將 `.env.example` 複製為 `.env.local`，填入 `GOOGLE_API_KEY` 或 `GROQ_API_KEY`，執行 `npm run dev`。

開啟 http://127.0.0.1:3100 。使用 3100 避開本機 Windows 保留的 3000 埠。金鑰只存於伺服器環境檔，勿提交至版本控制。

## 模型

- Google：`gemini-2.5-flash-lite`
- Groq：`openai/gpt-oss-20b`、`openai/gpt-oss-120b`、`qwen/qwen3.8-27b`

使用供應商的免費方案帳戶；相同模型在付費帳戶可能收費，程式無法查核帳戶計費狀態。模型與額度可能變動。不自動切換其他模型或供應商。`FREE_TIER_CONFIRMED` 保留於設定範例，但目前不作為呼叫門檻。

官方資訊：https://ai.google.dev/gemini-api/docs/pricing 、https://console.groq.com/docs/rate-limits 。

## 前台

支援繁體中文／英文介面切換與語言記憶。選擇優化模型、生成模型及角色扮演／結構化／CoT／混合策略。優化提示規則沿用原始版本，包括繁體中文、意圖保留及輸出清理。

兩組回答依序生成；先顯示原始回答，再生成優化回答。重新生成時沿用原始回答。約 1200 字以上顯示收合預覽，完整內容可透過閱讀彈窗查看與複製。支援 Markdown 表格、數學公式與 HTML br 換行；不執行任意 HTML。彈窗支援開關動畫、Esc、背景點擊、焦點回復與減少動態效果設定。

未額外設定模型輸出 Token 上限，模型仍有自身上限。收到部分回答時保留文字並提示；前端預覽不會改變後端內容。

## 後台實驗

前台不提供評分入口，`/api/judge` 與 `npm run benchmark` 保留。評審沿用原始三評審、五維度、不得同分、小數一位及平均彙整規則。預設使用同一免費 GPT-OSS 120B 模型三次評估，不宣稱異質模型評審。三次請求依序執行。

先啟動網站，再執行 `npm run benchmark`。環境變數：`DATASET`（預設 `benchmark/test-dataset.json`）、`STRATEGY`（預設 `role-play`）、`API_URL`（預設 `http://localhost:3100/api`）。固定原始回答，最多兩次回饋迭代，保存每輪輸出、評分、用量與設定雜湊。

結果逐題寫入 `benchmark/results/v3-*.jsonl`；重跑略過完成題目，失敗寫入 errors 並停止。歷史報告保留，不代表新版能直接重現原實驗。評審偏差、版本差異與統計驗證仍是後續研究事項。

目前為本機研究工具，公開部署前需加入驗證與共享額度限制。模型連線逾時為 60 秒；未設定每日呼叫次數或並行數限制。

## 檢查

`npm run typecheck`、`npm run lint`、`npm test`、`npm run build`。現有單元測試針對評估解析輔助函式，尚未涵蓋完整前後端及供應商 API 流程。
