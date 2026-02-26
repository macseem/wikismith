import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WikiPageContent } from '../page-content';

describe('WikiPageContent', () => {
  it('renders fenced code blocks with syntax highlighting classes', () => {
    const html = renderToStaticMarkup(
      <WikiPageContent
        page={{
          id: 'page-1',
          featureId: 'feature-1',
          slug: 'overview',
          title: 'Overview',
          content: ['## Example', '', '```ts', 'const answer = 42;', '```'].join('\n'),
          citations: [],
          parentPageId: null,
          order: 0,
        }}
      />,
    );

    expect(html).toMatch(
      /class=\"[^\"]*hljs[^\"]*language-ts[^\"]*\"|class=\"[^\"]*language-ts[^\"]*hljs[^\"]*\"/,
    );
  });

  it('renders plain section labels and bold rows as structured markdown', () => {
    const html = renderToStaticMarkup(
      <WikiPageContent
        page={{
          id: 'page-2',
          featureId: 'feature-2',
          slug: 'overview',
          title: 'Overview',
          content: [
            'What this project does',
            'It generates developer docs from repositories.',
            '',
            'Main capabilities',
            '**Authentication:** Securely sign in.',
          ].join('\n'),
          citations: [],
          parentPageId: null,
          order: 0,
        }}
      />,
    );

    expect(html).toContain('<h2>What this project does</h2>');
    expect(html).toContain('<h2>Main capabilities</h2>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>Authentication:</strong> Securely sign in.');
  });
});
