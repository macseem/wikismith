import { describe, expect, it } from 'vitest';
import { normalizeGeneratedMarkdown } from '../normalize-markdown';

describe('normalizeGeneratedMarkdown', () => {
  it('promotes plain section labels and list-like bold labels into markdown structure', () => {
    const input = [
      'Intro paragraph.',
      '',
      'Main Features',
      '',
      '**Auth:** Handles sign-in.',
      '**Repos:** Manages repository list.',
      '',
      'Closing paragraph.',
    ].join('\n');

    const output = normalizeGeneratedMarkdown(input);

    expect(output).toContain('## Main Features');
    expect(output).toContain('- **Auth:** Handles sign-in.');
    expect(output).toContain('- **Repos:** Manages repository list.');
  });

  it('does not rewrite lines inside code fences', () => {
    const input = [
      'Overview',
      '',
      '```ts',
      'Main Features',
      '**Auth:** Keep as-is in code.',
      '```',
    ].join('\n');

    const output = normalizeGeneratedMarkdown(input);

    expect(output).toContain('## Overview');
    expect(output).toContain('```ts\nMain Features\n**Auth:** Keep as-is in code.\n```');
  });

  it('treats plus-prefixed bullets as markdown list items', () => {
    const input = ['Overview', '', '+ Keep this list item', '', 'Main Features'].join('\n');

    const output = normalizeGeneratedMarkdown(input);

    expect(output).toContain('+ Keep this list item');
    expect(output).toContain('Main Features');
  });
});
