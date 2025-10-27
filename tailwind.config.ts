// tailwind.config.ts

import type { Config } from 'tailwindcss'

export default {
  content: [
    // 你的程式碼和 v3 一樣，需要告訴 Tailwind 去哪裡掃描 class
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './app/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [
    // 插件的寫法和 v3 一樣，所以 typography 插件可以照常使用
    require('@tailwindcss/typography'),
  ],
} satisfies Config