'use client';

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
      dangerouslySetInnerHTML={{ __html: markdownToHtml(page.content) }}
    />
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

const markdownToHtml = (md: string): string =>
  md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/```[\s\S]*?```/g, (block) => {
      const lines = block.split('\n');
      const lang = lines[0]?.replace('```', '') ?? '';
      const code = lines.slice(1, -1).join('\n');
      return `<pre><code class="language-${lang}">${escapeHtml(code)}</code></pre>`;
    })
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hupol])(.+)$/gm, '<p>$1</p>');

const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
