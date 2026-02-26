'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import type { IWikiPage } from '@wikismith/shared';
import { normalizeWikiMarkdownForRender } from '../../lib/wiki/normalize-markdown';

interface PageContentProps {
  page: IWikiPage;
}

export const WikiPageContent = ({ page }: PageContentProps) => {
  const normalizedContent = useMemo(
    () => normalizeWikiMarkdownForRender(page.content),
    [page.content],
  );

  return (
    <article className="max-w-4xl mx-auto py-8 px-6">
      <h1 className="text-4xl font-bold mb-8 text-white tracking-tight">{page.title}</h1>
      <div
        className="prose prose-invert prose-zinc max-w-none
          prose-headings:text-white prose-headings:font-semibold prose-headings:tracking-tight
          prose-h2:text-4xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:pb-2 prose-h2:border-b prose-h2:border-zinc-800
          prose-h3:text-2xl prose-h3:mt-10 prose-h3:mb-4
          prose-p:text-zinc-200 prose-p:leading-8 prose-p:my-4
          prose-ul:my-5 prose-ul:pl-7 prose-ul:space-y-2
          prose-li:text-zinc-100 prose-li:leading-8 prose-li:marker:text-zinc-500
          prose-strong:text-zinc-50 prose-strong:font-semibold
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
          prose-code:text-emerald-300 prose-code:bg-zinc-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-medium
          prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl prose-pre:px-4 prose-pre:py-4 prose-pre:shadow-lg
          prose-blockquote:border-l-zinc-600 prose-blockquote:text-zinc-300"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
        >
          {normalizedContent}
        </ReactMarkdown>
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
};
