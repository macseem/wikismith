import { test, expect } from '@playwright/test';

test.describe('API: /api/generate — validation', () => {
  test('rejects missing URL with 400', async ({ request }) => {
    const res = await request.post('/api/generate', {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  test('rejects invalid GitHub URL with 400', async ({ request }) => {
    const res = await request.post('/api/generate', {
      data: { url: 'https://example.com/not-a-repo' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('rejects non-existent repository with correct error', async ({ request }) => {
    const res = await request.post('/api/generate', {
      data: { url: 'https://github.com/nonexistent-user-xyz123/nonexistent-repo-xyz123' },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('REPO_NOT_FOUND');
  });

  test('accepts small body without 413', async ({ request }) => {
    const res = await request.post('/api/generate', {
      data: { url: 'https://github.com/owner/repo' },
    });
    expect(res.status()).not.toBe(413);
  });
});

test.describe('API: /api/wiki/[owner]/[repo]', () => {
  test('returns 404 for non-existent wiki', async ({ request }) => {
    const res = await request.get('/api/wiki/nobody/nonexistent-repo-xyz');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Wiki not found');
  });
});
