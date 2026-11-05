import type { Metadata } from 'next';

import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI prompt optimizer',
  description: 'Author: hyh',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
