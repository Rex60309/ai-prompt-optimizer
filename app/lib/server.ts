import { NextResponse } from 'next/server';
import { DEFAULT_MODEL, MODELS } from './models';
export class ApiError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function text(value: unknown, name: string, max = Infinity): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new ApiError(`${name} 必須為 1–${max} 字元的文字`);
  return value.trim();
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > 200000) throw new ApiError('請求過大', 413);
  const raw = await request.text();
  if (raw.length > 100000) throw new ApiError('請求過大', 413);
  try { const data: unknown = JSON.parse(raw); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data as Record<string, unknown>; }
  catch { throw new ApiError('請提供有效 JSON'); }
}
export function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof ApiError ? error.message : '服務暫時無法完成請求，請稍後重試' }, { status: error instanceof ApiError ? error.status : 500 });
}
export async function complete(prompt: string, model: unknown = DEFAULT_MODEL, json = false, signal?: AbortSignal, options: { temperature?: number; system?: string } = {}) {
  const selected = MODELS.find(m => m.id === model);
  if (!selected) throw new ApiError('不支援此模型；禁止切換到付費模型');
  const keyName = selected.provider === 'groq' ? 'GROQ_API_KEY' : 'GOOGLE_API_KEY';
  const key = process.env[keyName];
  if (!key) throw new ApiError(`尚未設定 ${keyName}`, 503);
  const start = Date.now();
  try {
    const isGroq = selected.provider === 'groq';
    const response = await fetch(isGroq ? 'https://api.groq.com/openai/v1/chat/completions' : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: isGroq ? { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` } : { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(60000)]) : AbortSignal.timeout(60000),
      body: JSON.stringify(isGroq ? { model, messages: [...(options.system ? [{ role: 'system', content: options.system }] : []), { role: 'user', content: prompt }], temperature: options.temperature ?? 0.3, ...(json ? { response_format: { type: 'json_object' } } : {}) } : { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { ...(json ? { responseMimeType: 'application/json' } : {}) } }),
    });
    if (!response.ok) throw new ApiError(response.status === 429 ? '免費 API 額度已用盡或請求過快；未切換付費模型' : '模型服務拒絕請求，請檢查免費專案金鑰及模型是否仍可用', response.status === 429 ? 429 : 502);
    const data = await response.json();
    if (isGroq) {
      const choice = data.choices?.[0];
      if (!choice?.message?.content?.trim()) {
        const reason = choice?.finish_reason ?? 'unknown';
        throw new ApiError(`模型未回傳答案文字（結束原因：${reason}）。請重試或改選其他免費模型`, 502);
      }
      if (json && choice.finish_reason === 'length') throw new ApiError('評審 JSON 超過模型輸出上限，請重試', 502);
      return { content: choice.message.content.trim() as string, finishReason: choice.finish_reason, truncated: choice.finish_reason === 'length', usage: { model, provider: selected.provider, inputTokens: data.usage?.prompt_tokens ?? null, outputTokens: data.usage?.completion_tokens ?? null, totalTokens: data.usage?.total_tokens ?? null, durationMs: Date.now() - start } };
    }
    const candidate = data.candidates?.[0];
    if (json && candidate?.finishReason === 'MAX_TOKENS') throw new ApiError('評審 JSON 超過模型輸出上限，請重試', 502);
    const content = candidate.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('').trim();
    if (!content) throw new ApiError(`模型未回傳答案文字（結束原因：${candidate?.finishReason ?? data.promptFeedback?.blockReason ?? 'unknown'}）。請重試或改選其他免費模型`, 502);
    return { content: content as string, finishReason: candidate.finishReason, truncated: candidate.finishReason === 'MAX_TOKENS', usage: { model, inputTokens: data.usageMetadata?.promptTokenCount ?? null, outputTokens: data.usageMetadata?.candidatesTokenCount ?? null, totalTokens: data.usageMetadata?.totalTokenCount ?? null, durationMs: Date.now() - start } };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('模型連線逾時或已取消', 504);
  }
}
