'use client';
import { useEffect, useRef, useState, useId } from 'react';
import { Copy, Check, X, FileText, ArrowUpRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkLineBreaks from '../lib/remark-line-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useLanguage } from './Language';
export default function ContentDialog({
  title,
  content,
  plain,
  onClose,
}: {
  title: string;
  content: string;
  plain?: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [closing, setClosing] = useState(false);
  const [notice, setNotice] = useState<{ id: number; failed: boolean } | null>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (timer.current) clearTimeout(timer.current);
      element?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(id);
  }, [notice]);
  const close = () => {
    if (closing) return;
    setClosing(true);
    timer.current = setTimeout(
      onClose,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200,
    );
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setNotice({ id: Date.now(), failed: false });
    } catch {
      setNotice({ id: Date.now(), failed: true });
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close();
        }
      }}
      className={`content-dialog ${closing ? 'is-closing' : ''}`}
    >
      <div className="flex max-h-[88dvh] flex-col overflow-hidden rounded-3xl border border-indigo-400/25 bg-slate-950 shadow-2xl shadow-indigo-950/50">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-gradient-to-r from-indigo-500/10 to-violet-500/5 px-5 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-2.5 text-indigo-300">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="mb-1 text-[10px] tracking-[0.18em] text-indigo-300">
                {t('完整內容', 'FULL CONTENT')}
              </p>
              <h2 id={titleId} className="text-base font-semibold text-slate-100 sm:text-lg">
                {title}
              </h2>
            </div>
          </div>
          <button
            autoFocus
            onClick={close}
            aria-label={t('關閉', 'Close')}
            className="rounded-full border border-slate-700 p-2 text-slate-400 transition hover:border-indigo-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8 sm:py-8">
          {plain ? (
            <div className="whitespace-pre-wrap break-words text-sm leading-8 text-slate-200">
              {content}
            </div>
          ) : (
            <div className="answer-content prose prose-invert prose-sm max-w-none break-words text-slate-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath, remarkLineBreaks]}
                rehypePlugins={[rehypeKatex]}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 bg-slate-900/70 px-5 py-4 sm:px-8">
          <span className="text-xs text-slate-500">
            {content.length.toLocaleString()} {t('字', 'characters')}
          </span>
          <div className="flex gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-800"
            >
              {notice && !notice.failed ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {t('複製', 'Copy')}
            </button>
            <button
              onClick={close}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              {t('返回', 'Back')}
              <ArrowUpRight className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </footer>
      </div>
      {notice && (
        <div
          key={notice.id}
          role="status"
          className="copy-notice pointer-events-none absolute inset-x-4 bottom-20 mx-auto w-fit rounded-xl border border-slate-600 bg-slate-800 px-5 py-3 text-sm text-white shadow-xl"
        >
          {notice.failed
            ? t('複製失敗，請重試', 'Copy failed. Try again.')
            : t('已複製到剪貼簿', 'Copied to clipboard')}
        </div>
      )}
    </dialog>
  );
}
