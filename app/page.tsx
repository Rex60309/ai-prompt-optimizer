// app/page.tsx

import OptimizerClient from './components/OptimizerClient';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-indigo-50 to-purple-50 p-6 md:p-10 lg:p-16">
      <div className="w-full max-w-6xl text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-800 mb-4">
          AI Prompt Optimizer
        </h1>
        <p className="text-lg text-indigo-600">
          This tool helps you to refine your prompts.
        </p>
      </div>

      {/* 直接渲染客戶端元件，所有互動都在它內部處理 */}
      <OptimizerClient />

    </main>
  );
}