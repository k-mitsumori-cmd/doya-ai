"use client";
import { useEffect } from 'react';
let lastSent = 0;
export function reportBrowserError(kind: 'javascript' | 'render' | 'promise') {
  if (Date.now() - lastSent < 60000) return;
  lastSent = Date.now();
  void fetch('/api/operational-error', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind }), keepalive: true,
  }).catch(() => {});
}
export default function RuntimeErrorReporter() {
  useEffect(() => {
    const error = () => reportBrowserError('javascript');
    const rejection = () => reportBrowserError('promise');
    window.addEventListener('error', error);
    window.addEventListener('unhandledrejection', rejection);
    return () => {
      window.removeEventListener('error', error);
      window.removeEventListener('unhandledrejection', rejection);
    };
  }, []);
  return null;
}
