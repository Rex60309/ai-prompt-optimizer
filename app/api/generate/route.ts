import { NextResponse } from 'next/server';
import { body, complete, failure, text } from '../../lib/server';
export async function POST(request: Request) {
  try { const data = await body(request); const result = await complete(text(data.prompt, 'prompt'), data.model, false, request.signal, { temperature: 0.7 }); return NextResponse.json({ generatedContent: result.content, usage: result.usage, truncated: result.truncated, finishReason: result.finishReason }); }
  catch (error) { return failure(error); }
}
