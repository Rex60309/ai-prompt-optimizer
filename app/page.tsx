// app/page.tsx

import OptimizerClient from './components/OptimizerClient'; // <--- 導入我們的新元件

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-indigo-50 to-purple-50 p-6 md:p-10 lg:p-16">
      <div className="w-full max-w-6xl text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-indigo-800 mb-4">
          AI Prompt Optimizer & Compare
        </h1>
        <p className="text-lg text-indigo-600">
          Refine your prompts and compare the AI outputs side-by-side.
        </p>
      </div>

      {/* 直接渲染客戶端元件，所有互動都在它內部處理 */}
      <OptimizerClient />

    </main>
  );
}