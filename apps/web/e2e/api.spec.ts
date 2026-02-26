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

test.describe('API: wiki sharing and public access', () => {
  const owner = 'jonschlinkert';
  const repo = 'is-number';
  const repoUrl = `https://github.com/${owner}/${repo}`;

  test('private by default, supports publish and token rotation', async ({ request }) => {
    const generateResponse = await request.post('/api/generate', {
      data: { url: repoUrl, force: true },
    });
    expect(generateResponse.status()).toBe(200);

    const initialSharingResponse = await request.get(`/api/repos/${owner}/${repo}/sharing`);
    expect(initialSharingResponse.status()).toBe(200);
    const initialSharing = (await initialSharingResponse.json()) as {
      isPublic: boolean;
      embedEnabled: boolean;
      shareToken: string;
    };

    expect(initialSharing.isPublic).toBe(false);
    expect(initialSharing.embedEnabled).toBe(false);
    expect(initialSharing.shareToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const resetPrivateResponse = await request.patch(`/api/repos/${owner}/${repo}/sharing`, {
      data: {
        isPublic: false,
        embedEnabled: false,
      },
    });
    expect(resetPrivateResponse.status()).toBe(200);
    const resetPrivate = (await resetPrivateResponse.json()) as {
      isPublic: boolean;
      embedEnabled: boolean;
      shareToken: string;
    };
    expect(resetPrivate.isPublic).toBe(false);
    expect(resetPrivate.embedEnabled).toBe(false);

    const privateAccessResponse = await request.get(`/api/wiki/public/${resetPrivate.shareToken}`);
    expect(privateAccessResponse.status()).toBe(404);

    const publishResponse = await request.patch(`/api/repos/${owner}/${repo}/sharing`, {
      data: {
        isPublic: true,
        embedEnabled: true,
      },
    });
    expect(publishResponse.status()).toBe(200);

    const publishedSharing = (await publishResponse.json()) as {
      isPublic: boolean;
      embedEnabled: boolean;
      shareToken: string;
    };
    expect(publishedSharing.isPublic).toBe(true);
    expect(publishedSharing.embedEnabled).toBe(true);

    const publicAccessResponse = await request.get(
      `/api/wiki/public/${publishedSharing.shareToken}`,
    );
    expect(publicAccessResponse.status()).toBe(200);
    const sharedWiki = (await publicAccessResponse.json()) as { owner: string; repo: string };
    expect(sharedWiki.owner).toBe(owner);
    expect(sharedWiki.repo).toBe(repo);

    const rotateResponse = await request.post(`/api/repos/${owner}/${repo}/sharing/rotate`);
    expect(rotateResponse.status()).toBe(200);
    const rotatedSharing = (await rotateResponse.json()) as { shareToken: string };
    expect(rotatedSharing.shareToken).not.toBe(publishedSharing.shareToken);

    const oldTokenResponse = await request.get(`/api/wiki/public/${publishedSharing.shareToken}`);
    expect(oldTokenResponse.status()).toBe(404);

    const newTokenResponse = await request.get(`/api/wiki/public/${rotatedSharing.shareToken}`);
    expect(newTokenResponse.status()).toBe(200);
  });
});
