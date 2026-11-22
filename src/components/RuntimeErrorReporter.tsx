"use client";
import { useEffect } from 'react';
let lastSent = 0;

/**
 * 画面の最初の区切りだけを返す（/banner/dashboard/create → 'banner'、/ → 'top'）。
 * 2番目以降の区切り・クエリ・URL の全体は送らない。サーバーが決まった一覧で照らし、合わなければ 'other' にする。
 */
function currentArea(): string | undefined {
  try {
    const first = window.location.pathname.split('/')[1] ?? '';
    if (!first) return 'top';
    return /^[a-z0-9-]{1,32}$/.test(first) ? first : 'other';
  } catch { return undefined; }
}

/** 失敗した値の型の名前だけを返す。本文（message）は読まない・送らない。 */
function reasonName(value: unknown): string {
  try {
    if (value instanceof Error || (typeof DOMException !== 'undefined' && value instanceof DOMException)) {
      const name = (value as Error).name;
      return typeof name === 'string' && /^[A-Za-z]{1,40}$/.test(name) ? name : 'Error';
    }
    return 'non-error';
  } catch { return 'non-error'; }
}

export function reportBrowserError(kind: 'javascript' | 'render' | 'promise', reason?: unknown) {
  if (Date.now() - lastSent < 60000) return;
  lastSent = Date.now();
  const area = currentArea();
  void fetch('/api/operational-error', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, ...(area ? { area } : {}), reason: reasonName(reason) }), keepalive: true,
  }).catch(() => {});
}
export default function RuntimeErrorReporter() {
  useEffect(() => {
    const error = (event: ErrorEvent) => reportBrowserError('javascript', event.error);
    const rejection = (event: PromiseRejectionEvent) => reportBrowserError('promise', event.reason);
    window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', rejection);
    return () => {
      window.removeEventListener('error', error);
      window.removeEventListener('unhandledrejection', rejection);
    };
  }, []);
  return null;
}
