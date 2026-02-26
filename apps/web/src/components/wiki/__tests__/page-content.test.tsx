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
});
