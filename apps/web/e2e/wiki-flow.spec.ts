import { test, expect } from '@playwright/test';

const SMALL_REPO_URL = 'https://github.com/jonschlinkert/is-number';
const OWNER = 'jonschlinkert';
const REPO = 'is-number';

test.describe.configure({ mode: 'serial' });

test.describe('Wiki generation E2E flow', () => {
  test('generates wiki via API (SSE streaming)', async ({ request }) => {
    const res = await request.post('/api/generate', {
      data: { url: SMALL_REPO_URL, force: true },
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.ok()).toBe(true);

    const text = await res.text();
    const lines = text.split('\n');

    const events: Array<{ event: string; data: Record<string, unknown> }> = [];
    let currentEvent = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7);
      } else if (line.startsWith('data: ')) {
        events.push({ event: currentEvent, data: JSON.parse(line.slice(6)) });
      }
    }

    const progressEvents = events.filter((e) => e.event === 'progress');
    expect(progressEvents.length).toBeGreaterThan(0);

    const stages = progressEvents.map((e) => e.data.stage);
    expect(stages).toContain('ingesting');
    expect(stages).toContain('analyzing');
    expect(stages).toContain('classifying');
    expect(stages).toContain('generating');

    const completeEvent = events.find((e) => e.event === 'complete');
    expect(completeEvent).toBeTruthy();
    expect(completeEvent!.data.owner).toBe(OWNER);
    expect(completeEvent!.data.repo).toBe(REPO);
    expect(completeEvent!.data.commitSha).toBeTruthy();
  });

  test('returns cached wiki on second generate call', async ({ request }) => {
    const res = await request.post('/api/generate', {
      data: { url: SMALL_REPO_URL },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.owner).toBe(OWNER);
    expect(body.repo).toBe(REPO);
  });

  test('wiki API returns generated data', async ({ request }) => {
    const res = await request.get(`/api/wiki/${OWNER}/${REPO}`);
    expect(res.status()).toBe(200);

    const wiki = await res.json();
    expect(wiki.owner).toBe(OWNER);
    expect(wiki.repo).toBe(REPO);
    expect(wiki.commitSha).toBeTruthy();
    expect(wiki.pages).toBeInstanceOf(Array);
    expect(wiki.pages.length).toBeGreaterThan(0);

    const overview = wiki.pages.find((p: { slug: string }) => p.slug === 'overview');
    expect(overview).toBeTruthy();
    expect(overview.title).toBe('Overview');
    expect(overview.content.length).toBeGreaterThan(50);

    expect(wiki.analysis).toBeTruthy();
    expect(wiki.analysis.fileCount).toBeGreaterThan(0);
    expect(wiki.analysis.languages).toBeTruthy();
    expect(wiki.analysis.frameworks).toBeInstanceOf(Array);
  });

  test('homepage renders correctly', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('WikiSmith');
    await expect(page.getByPlaceholder(/github\.com/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /generate wiki/i })).toBeVisible();

    await expect(page.getByText('Feature-Organized')).toBeVisible();
    await expect(page.getByText('Code Citations')).toBeVisible();
    await expect(page.getByText('AI-Powered')).toBeVisible();
  });

  test('submitting a cached repo navigates to wiki page', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/github\.com/i);
    await input.fill(SMALL_REPO_URL);

    const button = page.getByRole('button', { name: /generate wiki/i });
    await button.click();

    await page.waitForURL(`/wiki/${OWNER}/${REPO}`, { timeout: 30_000 });
    await expect(page).toHaveURL(`/wiki/${OWNER}/${REPO}`);
  });

  test('wiki page shows sidebar and content', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);

    await expect(page.locator('article h1')).toBeVisible({ timeout: 15_000 });

    const sidebar = page.locator('nav');
    await expect(sidebar).toBeVisible();

    const sidebarLinks = sidebar.getByRole('link');
    expect(await sidebarLinks.count()).toBeGreaterThan(1);

    await expect(page.getByRole('banner').getByText(`${OWNER}/${REPO}`)).toBeVisible();
  });

  test('wiki header exposes account menu for authenticated users', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);
    await expect(page.locator('article h1')).toBeVisible({ timeout: 15_000 });

    const accountMenuTrigger = page.getByLabel('Account menu');
    await expect(accountMenuTrigger).toBeVisible();
    await accountMenuTrigger.click();

    const openMenu = page.locator('details[open]');
    await expect(openMenu.getByText('e2e@wikismith.local')).toBeVisible();
    await expect(openMenu.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(openMenu.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(openMenu.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  test('sidebar navigation works between pages', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);
    await expect(page.locator('article h1')).toBeVisible({ timeout: 15_000 });

    const navigationEntriesBefore = await page.evaluate(
      () => window.performance.getEntriesByType('navigation').length,
    );

    const sidebarList = page.locator('nav ul');
    const listLinks = sidebarList.getByRole('link');
    const linkCount = await listLinks.count();
    expect(linkCount).toBeGreaterThan(1);

    const featureLink = listLinks.nth(1);
    const featureHref = await featureLink.getAttribute('href');
    expect(featureHref).toBeTruthy();
    await featureLink.click();

    await page.waitForURL(featureHref!, { timeout: 15_000 });

    const navigationEntriesAfter = await page.evaluate(
      () => window.performance.getEntriesByType('navigation').length,
    );
    expect(navigationEntriesAfter).toBe(navigationEntriesBefore);

    const heading = page.locator('article h1');
    await expect(heading).toBeVisible({ timeout: 10_000 });

    const overviewLink = page.locator('nav ul').getByRole('link').first();
    await overviewLink.click();
    await page.waitForURL(`/wiki/${OWNER}/${REPO}`, { timeout: 15_000 });
  });

  test('sidebar expansion state persists across in-app route changes', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);
    await expect(page.locator('article h1')).toBeVisible({ timeout: 15_000 });

    const toggleButtons = page.getByRole('button', { name: /^(Collapse|Expand) / });
    const toggleCount = await toggleButtons.count();
    test.skip(toggleCount === 0, 'No expandable sidebar groups for this wiki.');

    const firstToggle = toggleButtons.first();
    const expanded = await firstToggle.getAttribute('aria-expanded');
    if (expanded !== 'false') {
      await firstToggle.click();
    }

    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');

    const firstFeatureLink = page.locator('nav ul').getByRole('link').nth(1);
    await firstFeatureLink.click();
    await page.waitForURL(/\/wiki\/[^/]+\/[^/]+\/.+/, { timeout: 15_000 });

    await expect(firstToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('wiki page renders markdown content', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);
    await expect(page.locator('article h1')).toBeVisible({ timeout: 15_000 });

    const prose = page.locator('article .prose');
    await expect(prose).toBeVisible();

    const paragraphs = prose.locator('p');
    expect(await paragraphs.count()).toBeGreaterThan(0);
  });

  test('WikiSmith header link navigates to homepage', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);
    await expect(page.locator('article h1')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'WikiSmith', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('WikiSmith');
  });

  test('generation error shows message and retry button', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/github\.com/i);
    await input.fill('https://github.com/nonexistent-xyz123/no-repo-xyz123');

    const button = page.getByRole('button', { name: /generate wiki/i });
    await button.click();

    await expect(page.getByText(/not found/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/try again/i)).toBeVisible();
  });
});

test.describe('Dashboard account actions', () => {
  test('dashboard account menu is reachable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');

    const accountMenuTrigger = page.getByLabel('Account menu');
    await expect(accountMenuTrigger).toBeVisible();
    await accountMenuTrigger.click();

    const openMenu = page.locator('details[open]');
    await expect(openMenu.getByText('Signed in')).toBeVisible();
    await expect(openMenu.getByText('e2e@wikismith.local')).toBeVisible();
    await expect(openMenu.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(openMenu.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });
});
