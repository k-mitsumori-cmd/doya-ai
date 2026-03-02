'use client'

import { useMemo } from 'react'
import { markdownToHtmlBasic } from '@seo/lib/markdown'

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => markdownToHtmlBasic(markdown || ''), [markdown])
  return (
    <>
      <div className="md-preview" data-md-preview dangerouslySetInnerHTML={{ __html: html }} />
      <style jsx global>{`
        .md-preview {
          color: #0f172a;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Noto Sans JP',
            'Yu Gothic', 'Meiryo', sans-serif;
          font-size: 15.5px;
          line-height: 2.05;
          letter-spacing: 0.015em;
          text-rendering: optimizeLegibility;
        }
        @media (min-width: 640px) {
          .md-preview {
            font-size: 16.5px;
          }
        }
        @media (min-width: 1024px) {
          .md-preview {
            font-size: 17.5px;
          }
        }
        .md-preview h1,
        .md-preview h2,
        .md-preview h3,
        .md-preview h4 {
          color: #0b1220;
          font-weight: 900;
          letter-spacing: -0.01em;
          scroll-margin-top: 96px;
        }
        .md-preview h1 {
          font-size: 1.6em;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          margin: 0 0 1.25rem;
        }
        .md-preview h2 {
          font-size: 1.3em;
          margin: 1.85rem 0 0.55rem;
          padding-left: 0.75rem;
          border-left: 4px solid #2563eb;
        }
        .md-preview h3 {
          font-size: 1.12em;
          margin: 1.1rem 0 0.35rem;
        }
        .md-preview h4 {
          font-size: 1.02em;
          margin: 0.85rem 0 0.25rem;
          color: #1f2937;
        }
        .md-preview p {
          margin: 1.05rem 0;
          color: #0f172a;
        }
        /* 見出し直後の余白を詰めて「超小見出し」が間延びしないようにする */
        .md-preview h2 + p {
          margin-top: 0.65rem;
        }
        .md-preview h3 + p {
          margin-top: 0.55rem;
        }
        .md-preview h4 + p {
          margin-top: 0.45rem;
        }
        /* 連続見出し（H2→H3 など）も詰める */
        .md-preview h2 + h3 {
          margin-top: 0.8rem;
        }
        .md-preview h3 + h4 {
          margin-top: 0.6rem;
        }
        .md-preview a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 3px;
          font-weight: 800;
        }
        .md-preview a:hover {
          color: #1d4ed8;
        }
        .md-preview strong {
          color: #0b1220;
          font-weight: 900;
        }
        .md-preview em {
          color: #0f172a;
        }
        .md-preview ul,
        .md-preview ol {
          margin: 1rem 0 1.2rem;
          padding-left: 1.4rem;
          color: #0f172a;
        }
        .md-preview li {
          margin: 0.45rem 0;
        }
        .md-preview blockquote {
          margin: 1.2rem 0;
          padding: 0.9rem 1rem;
          background: #f8fafc;
          border-left: 4px solid #cbd5e1;
          color: #475569;
          border-radius: 0.75rem;
        }
        .md-preview code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.95em;
          background: #fff1f2;
          color: #be123c;
          padding: 0.15rem 0.4rem;
          border-radius: 0.5rem;
          border: 1px solid #ffe4e6;
        }
        .md-preview pre {
          margin: 1.2rem 0;
          padding: 1rem 1.1rem;
          background: #0b1220;
          color: #e2e8f0;
          border-radius: 1rem;
          overflow-x: auto;
          box-shadow: 0 12px 30px rgba(2, 6, 23, 0.18);
        }
        .md-preview pre code {
          background: transparent;
          color: inherit;
          padding: 0;
          border: none;
          font-size: 0.9em;
        }
        .md-preview hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 2rem 0;
        }
        .md-preview img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 1rem;
          box-shadow: 0 10px 24px rgba(2, 6, 23, 0.12);
          margin: 1.25rem auto;
        }
        /* ======== TABLE WRAPPER ======== */
        .md-preview .table-wrapper {
          margin: 2rem 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 1.25rem;
          background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.08),
            0 20px 40px -8px rgba(37, 99, 235, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }
        .md-preview table {
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
          font-size: 0.92em;
          line-height: 1.65;
        }
        /* ======== THEAD ======== */
        .md-preview thead th {
          background: linear-gradient(180deg, #1e40af 0%, #2563eb 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 0.95em;
          letter-spacing: 0.01em;
          padding: 1rem 1.1rem;
          text-align: left;
          white-space: nowrap;
          border-bottom: none;
          text-transform: none;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.22);
        }
        .md-preview thead th:first-child {
          border-top-left-radius: 1.25rem;
          padding-left: 1.5rem;
        }
        .md-preview thead th:last-child {
          border-top-right-radius: 1.25rem;
          padding-right: 1.5rem;
        }
        /* ======== TBODY ======== */
        .md-preview tbody td {
          padding: 1rem 1.1rem;
          border-bottom: 1px solid #f1f5f9;
          color: #0f172a;
          vertical-align: top;
          background: #ffffff;
          transition: background 0.15s ease;
        }
        .md-preview tbody td:first-child {
          padding-left: 1.5rem;
          font-weight: 600;
          color: #1e293b;
        }
        .md-preview tbody td:last-child {
          padding-right: 1.5rem;
        }
        .md-preview tbody tr:nth-child(even) td {
          background: #f8fafc;
        }
        .md-preview tbody tr:hover td {
          background: #eef6ff;
        }
        .md-preview tbody tr:last-child td {
          border-bottom: none;
        }
        .md-preview tbody tr:last-child td:first-child {
          border-bottom-left-radius: 1.25rem;
        }
        .md-preview tbody tr:last-child td:last-child {
          border-bottom-right-radius: 1.25rem;
        }
        /* ======== TABLE CELL STYLING ======== */
        .md-preview td strong {
          color: #0f172a;
          font-weight: 700;
        }
        .md-preview td code {
          font-size: 0.85em;
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.15rem 0.4rem;
          border-radius: 0.375rem;
          border: 1px solid #bae6fd;
        }
        /* ======== MOBILE RESPONSIVE ======== */
        @media (max-width: 768px) {
          .md-preview .table-wrapper {
            margin: 1.5rem -1rem;
            border-radius: 0;
            border-left: none;
            border-right: none;
            box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.08);
          }
          .md-preview thead th:first-child,
          .md-preview thead th:last-child,
          .md-preview tbody tr:last-child td:first-child,
          .md-preview tbody tr:last-child td:last-child {
            border-radius: 0;
          }
          .md-preview thead th,
          .md-preview tbody td {
            padding: 0.75rem 0.9rem;
            font-size: 0.9em;
          }
          .md-preview thead th:first-child,
          .md-preview tbody td:first-child {
            padding-left: 1rem;
          }
          .md-preview thead th:last-child,
          .md-preview tbody td:last-child {
            padding-right: 1rem;
          }
        }
      `}</style>
    </>
  )
}
