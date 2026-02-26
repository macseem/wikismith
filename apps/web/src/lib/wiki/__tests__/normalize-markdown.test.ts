import { describe, expect, it } from 'vitest';
import { normalizeWikiMarkdownForRender } from '../normalize-markdown';

describe('normalizeWikiMarkdownForRender', () => {
  it('promotes plain section labels and bold label lines into headings and bullets', () => {
    const input = [
      'What this project does',
      'WikiSmith helps generate developer docs.',
      '',
      'Main capabilities',
      '**Authentication:** Securely sign in and manage user accounts.',
      '**Repository Management:** Manage repositories and branches.',
      '',
      'Architecture overview',
      'High-level architecture explanation.',
    ].join('\n');

    const output = normalizeWikiMarkdownForRender(input);

    expect(output).toContain('## What this project does');
    expect(output).toContain('## Main capabilities');
    expect(output).toContain('- **Authentication:** Securely sign in and manage user accounts.');
    expect(output).toContain('- **Repository Management:** Manage repositories and branches.');
    expect(output).toContain('## Architecture overview');
  });

  it('does not mutate lines inside fenced code blocks', () => {
    const input = ['Main capabilities', '', '```ts', '**Auth:** Keep exactly as code.', '```'].join(
      '\n',
    );

    const output = normalizeWikiMarkdownForRender(input);

    expect(output).toContain('## Main capabilities');
    expect(output).toContain('```ts\n**Auth:** Keep exactly as code.\n```');
  });
});
