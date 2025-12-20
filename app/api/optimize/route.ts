// app/api/optimize/route.ts

import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { HfInference } from '@huggingface/inference';
import OpenAI from 'openai'; // 1. 新增 OpenAI 導入

// 初始化客戶端
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// --- 1. 定義共用約束 (Base Constraints) ---
const BASE_CONSTRAINTS = `
CRITICAL CONSTRAINTS (Must Follow):

1. **Output Isolation**: Return ONLY the new, optimized prompt content. Do NOT include introductory text (like "Here is the optimized prompt:"), explanations, reasoning, or markdown code blocks (\`\`\`).
2. **Language Requirement**: Unless the user *explicitly* requests a different language (e.g., "Write in English"), you MUST:
   - Write the optimized prompt itself in **Traditional Chinese (繁體中文)**.
   - Include an explicit instruction within the optimized prompt asking the target model to "Answer in Traditional Chinese (請用繁體中文回答)".
3. **No Placeholders**: The output must be a **ready-to-execute prompt**, NOT a template. Do NOT use phrases like "[Insert Text Here]" or "Please provide...". If details are missing, you must **infer reasonable context** based on the chosen strategy (e.g., assume a general audience if not specified).
4. **Formatting**: Keep the format clean. Do NOT use bolding (**) for list items. Use standard numbering or bullet points.
5. **Efficiency**: Keep the prompt concise but potent. Avoid unnecessary polite phrases (e.g., "If you wouldn't mind...").
`;

// --- 2. 定義不同策略的 Prompt 模板 (Strategy Instructions) ---
const getStrategyInstruction = (strategy: string): string => {
  switch (strategy) {
    case 'role-play':
    default:
      return `
      STRATEGY: Persona-Driven Optimization.
      
      Your goal is to rewrite the user's prompt by applying a deep, specific **Expert Persona**.
      
      Please follow these steps:
      1. **Domain Analysis**: Identify the underlying field of the request (e.g., Academic Writing, Python Engineering, Fitness Coaching).
      2. **Persona Assignment**: Start the optimized prompt with a powerful "You are..." statement. Assign a specific, high-authority role (e.g., instead of "You are a writer", use "You are an award-winning copywriter with a focus on viral marketing").
      3. **Voice & Tone**: Modify the instructions to reflect how such an expert would think and speak. Use professional or domain-specific terminology where appropriate to enhance the quality of the generation.
      4. **Task Immersion**: Frame the user's request as a specific assignment given to this expert.
      
      Focus heavily on **WHO** the AI is. Do not worry about creating complex Markdown structures (leave that for other strategies); focus on the **Expertise** and **Perspective**.
      `;

    case 'structured':
      return `
      STRATEGY: Structured Component Prompting (Prompt Programming).

      Your task is to rewrite the user's vague request into a highly structured, modular prompt. Treat the prompt not as a sentence, but as a "specification" with defined parameters.
      
      You MUST decompose the request into the following explicit, labeled components:
      ### 1. [Context & Role]
      Define the background scenario and the specific role the AI should adopt to ground the response.
      ### 2. [Core Task]
      Define the specific objective using clear action verbs (e.g., "Analyze", "Generate", "Compare").
      ### 3. [Constraints & Rules]
      List explicit boundaries (e.g., "Do not use...", "Must include...", "Word count limit"). This is crucial to reduce hallucinations.
      Unless length is specified, the minimum word count can be set at 500 words or more.
      ### 4. [Output Format]
      Define the exact structure of the desired response (e.g., "Markdown Table", "JSON", "Step-by-step list").
      ### 5. [Style & Tone]
      Define the register (e.g., "Academic", "Socratic", "Persuasive").

      **Requirement:** The final output must be a single, cohesive prompt that organizes the user's intent into these structured blocks using the headers above.
      `;

    case 'cot':
      return `
      STRATEGY: Chain of Thought (CoT) Optimization.

      Your goal is to rewrite the user's request into a prompt that forces the AI to perform **deep reasoning** and **step-by-step analysis** before answering.
      
      Please perform the following internal analysis (do not output this):
      1. **Identify the Logical Path**: What steps must be taken to solve this problem accurately?
      2. **Detect Potential Pitfalls**: Where might a standard model jump to conclusions too quickly?
      
      Then, generate an optimized prompt that:
      1. Explicitly instructs the model to "Think step by step" or "Analyze the problem logically".
      2. Outlines the specific **reasoning steps** the model should follow for THIS specific task (e.g., "First, analyze X... Second, compare Y... Finally, conclude Z").
      3. Demands that the model **explains its reasoning** before giving the final answer.
      
      **Output Requirement**: The final prompt should encourage a logical flow, prioritizing process and derivation over formatting or persona.
      `;

    case 'hybrid':
      return `
      STRATEGY: Hybrid Synergistic Optimization (Persona + CoT + Structure).
      
      Theory Reference: Combines "Persona-based Prompting", "Prompt Programming", and "Chain-of-Thought Reasoning" into a unified framework.
      
      Your goal is to create the **ultimate prompt** by synthesizing three techniques:
      1. **Persona**: Adopt a high-authority expert role.
      2. **Structure**: Organize the prompt into clear, labeled modules.
      3. **Reasoning**: Force the target model to use Chain-of-Thought (step-by-step logic).

      Please execute the following synthesis:
      
      Step 1 (Internal Analysis): Determine the best Expert Persona and the logical steps required to solve the user's task.
      Step 2 (Drafting): Rewrite the user's request into the following STRICT Structure:

      ### 1. [Role & Objective]
      Start with "You are a [Expert Persona]..." and define the core objective clearly.

      ### 2. [Context & Constraints]
      Provide necessary background and list strict rules (e.g., length, formatting, what to avoid).
      Unless length is specified, the minimum word count can be set at 500 words or more.
      
      ### 3. [Step-by-Step Reasoning Plan]
      Explicitly instructs the model to follow a logical process. 
      *Critical*: You must include a phrase like "Before answering, think step-by-step..." or "Analyze X, then Y, then Z...".

      ### 4. [Output Style & Format]
      Define the desired tone (e.g., Professional, Engaging) and format (e.g., Markdown, List).

      The final output must be a masterfully crafted prompt that feels like a detailed specification written by a domain expert.
      `;
  }
};

export async function POST(request: Request) {
  try {
    const { prompt, model, strategy = 'role-play' } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const targetModel = model || 'gemini-2.5-flash';
    let optimizedPrompt = '';

    const metaPrompt = `
      You are a world-class Prompt Engineer. Your task is to take a user's prompt and meticulously rewrite it to be more effective for a large language model.

      ${getStrategyInstruction(strategy)}

      --------------------------------------------------
      Original User Prompt: "${prompt}"
      --------------------------------------------------

      ${BASE_CONSTRAINTS}

      Optimized Prompt:
    `;

    // --- A. Google Gemini ---
    if (targetModel.includes('gemini')) {
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) throw new Error("Server config error: GOOGLE_API_KEY is missing.");

      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: targetModel });
      const result = await aiModel.generateContent(metaPrompt);
      optimizedPrompt = result.response.text();
    }

    // --- B. Groq (Llama, Mixtral) ---
    else if (targetModel.includes('llama') || targetModel.includes('mixtral')) {
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) throw new Error("Server config error: GROQ_API_KEY is missing.");

      const chatCompletion = await groqClient.chat.completions.create({
        messages: [{ role: "user", content: metaPrompt }],
        model: targetModel,
        temperature: 0.7,
      });
      optimizedPrompt = chatCompletion.choices[0]?.message?.content || "";
    }

    // --- C. OpenAI (GPT-5.2, GPT-5-mini, etc.) ---
    // 新增邏輯：捕捉所有以 'gpt-' 開頭的模型
    else if (targetModel.toLowerCase().startsWith('gpt-')) {
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) throw new Error("Server config error: OPENAI_API_KEY is missing.");

      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });

      // [FIX] 針對 mini 模型 (通常是 Reasoning 模型) 強制設定 temperature 為 1
      // 許多新模型不支援非 1 的 temperature
      const isReasoningModel = targetModel.includes('mini') || targetModel.includes('o1') || targetModel.includes('gpt-5');

      const completion = await openai.chat.completions.create({
        messages: [{ role: "user", content: metaPrompt }],
        model: targetModel,
        // 如果是 mini 模型，設為 1；否則維持 0.7
        temperature: isReasoningModel ? 1 : 0.7,
      });

      optimizedPrompt = completion.choices[0].message.content || "";
    }

        // --- D. Hugging Face (DeepSeek, Qwen, Mistral, Gemma) ---
    // 只要有 "/" 的模型 ID，都交給 Hugging Face
    else if (targetModel.includes('/')) {
      if (!process.env.HUGGINGFACE_API_KEY) throw new Error("Missing HF API Key");

      const result = await hf.chatCompletion({
        model: targetModel,
        messages: [{ role: "user", content: metaPrompt }],
        max_tokens: 2048,
        temperature: 0.7,
      });

      optimizedPrompt = result.choices[0].message.content || "";

      // [特殊處理] DeepSeek R1 系列過濾 <think> 標籤
      if (targetModel.toLowerCase().includes('deepseek')) {
        optimizedPrompt = optimizedPrompt.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
      }
    }

    // --- E. Fallback ---
    else {
      console.warn(`Unknown model ${targetModel}, falling back to Gemini`);
      const googleApiKey = process.env.GOOGLE_API_KEY!;
      const genAI = new GoogleGenerativeAI(googleApiKey);
      const aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await aiModel.generateContent(metaPrompt);
      optimizedPrompt = result.response.text();
    }

    return NextResponse.json({ optimizedPrompt });

  } catch (error: any) {
    console.error('Error in /api/optimize:', error);
    return NextResponse.json({ error: error.message || 'Failed to optimize prompt.' }, { status: 500 });
  }
}