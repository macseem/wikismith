'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { IWikiPage } from '@wikismith/shared';

interface PageContentProps {
  page: IWikiPage;
}

export const WikiPageContent = ({ page }: PageContentProps) => (
  <article className="max-w-3xl mx-auto py-8 px-6">
    <h1 className="text-3xl font-bold mb-6 text-white">{page.title}</h1>
    <div
      className="prose prose-invert prose-zinc max-w-none
        prose-headings:text-white prose-headings:font-semibold
        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800
        prose-strong:text-white"
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.content}</ReactMarkdown>
    </div>
    {page.citations.length > 0 && (
      <div className="mt-12 pt-6 border-t border-zinc-800">
        <h2 className="text-lg font-semibold mb-4 text-zinc-300">References</h2>
        <ul className="space-y-2">
          {page.citations.map((citation, i) => (
            <li key={i} className="text-sm">
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline font-mono"
              >
                {citation.filePath}:{citation.startLine}-{citation.endLine}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )}
  </article>
);
