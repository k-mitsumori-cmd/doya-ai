'use client'

import { useMemo } from 'react'
import { markdownToHtmlBasic } from '@seo/lib/markdown'

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const html = useMemo(() => markdownToHtmlBasic(markdown || ''), [markdown])
  return (
    <>
      <div className="md-preview" data-md-preview dangerouslySetInnerHTML={{ __html: html }} />
      <style jsx>{`
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
          margin: 2.25rem 0 0.75rem;
          padding-left: 0.75rem;
          border-left: 4px solid #2563eb;
        }
        .md-preview h3 {
          font-size: 1.12em;
          margin: 1.6rem 0 0.6rem;
        }
        .md-preview h4 {
          font-size: 1.02em;
          margin: 1.2rem 0 0.4rem;
          color: #1f2937;
        }
        .md-preview p {
          margin: 1.05rem 0;
          color: #334155;
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
          color: #334155;
        }
        .md-preview ul,
        .md-preview ol {
          margin: 1rem 0 1.2rem;
          padding-left: 1.4rem;
          color: #334155;
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
        .md-preview table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: 1.2rem 0;
          font-size: 0.95em;
          overflow: hidden;
          border-radius: 1rem;
          border: 1px solid #e5e7eb;
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(2, 6, 23, 0.06);
        }
        .md-preview thead th {
          background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
          color: #0b1220;
          font-weight: 900;
          padding: 0.8rem 0.9rem;
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
          white-space: nowrap;
        }
        .md-preview thead th:first-child {
          border-top-left-radius: 1rem;
        }
        .md-preview thead th:last-child {
          border-top-right-radius: 1rem;
        }
        .md-preview tbody td {
          padding: 0.8rem 0.9rem;
          border-bottom: 1px solid #eef2f7;
          color: #334155;
          vertical-align: top;
        }
        .md-preview tbody tr:nth-child(even) td {
          background: #fbfdff;
        }
        .md-preview tbody tr:hover td {
          background: #f5faff;
        }
        .md-preview tbody tr:last-child td {
          border-bottom: none;
        }
        @media (max-width: 640px) {
          .md-preview table {
            display: block;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </>
  )
}
