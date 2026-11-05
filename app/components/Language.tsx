"use client";
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
const Context = createContext({ language: 'zh', toggle: () => {}, t: (zh: string, en: string) => zh || en });
export const useLanguage = () => useContext(Context);
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(
    callback => { window.addEventListener('promptlab-language', callback); window.addEventListener('storage', callback); return () => { window.removeEventListener('promptlab-language', callback); window.removeEventListener('storage', callback); }; },
    () => { try { return localStorage.getItem('promptlab-language') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } },
    () => 'zh',
  );
  useEffect(() => { document.documentElement.lang = language === 'zh' ? 'zh-Hant' : 'en'; }, [language]);
  const toggle = () => { localStorage.setItem('promptlab-language', language === 'zh' ? 'en' : 'zh'); window.dispatchEvent(new Event('promptlab-language')); };
  return <Context.Provider value={{ language, toggle, t: (zh, en) => language === 'zh' ? zh : en }}>{children}</Context.Provider>;
}
