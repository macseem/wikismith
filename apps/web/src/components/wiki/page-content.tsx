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
      <div className="wiki-content max-w-none">
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
