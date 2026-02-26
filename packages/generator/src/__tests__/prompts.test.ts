import { describe, expect, it } from 'vitest';
import { buildOverviewPrompt, buildWikiPagePrompt } from '../prompts';

const feature = {
  id: 'feature-auth',
  name: 'Authentication',
  description: 'Handles sign in and user session state.',
  relevantFiles: [
    { path: 'apps/web/src/lib/auth/session.ts', role: 'Session loading and shaping' },
    { path: 'apps/web/src/middleware.ts', role: 'Route protection' },
  ],
  children: [],
};

describe('buildWikiPagePrompt', () => {
  it('adds language-tagged file snippets and strict markdown structure rules', () => {
    const prompt = buildWikiPagePrompt(
      feature,
      {
        'apps/web/src/lib/auth/session.ts': 'export const getSession = async () => null;',
        'apps/web/src/middleware.ts': 'export default function middleware() {}',
      },
      'acme/example-repo',
      'abc123def456',
    );

    expect(prompt).toContain('```ts');
    expect(prompt).toContain('## Overview');
    expect(prompt).toContain('## User-facing behavior');
    expect(prompt).toContain('## Architecture and data flow');
    expect(prompt).toContain('## Key implementation details');
    expect(prompt).toContain('## Key files');
    expect(prompt).toContain('[`apps/web/src/lib/auth/session.ts:12-28`]');
  });
});

describe('buildOverviewPrompt', () => {
  it('requires polished sections and code fences for setup commands', () => {
    const prompt = buildOverviewPrompt([feature], 'acme/example-repo', 'Run with pnpm dev');

    expect(prompt).toContain('## What this project does');
    expect(prompt).toContain('## Main capabilities');
    expect(prompt).toContain('## Architecture overview');
    expect(prompt).toContain('## Getting started');
    expect(prompt).toContain('```bash');
  });
});
