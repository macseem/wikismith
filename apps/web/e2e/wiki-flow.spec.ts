import { test, expect } from '@playwright/test';

const REPO_URL = 'https://github.com/macseem/wikismith';
const OWNER = 'macseem';
const REPO = 'wikismith';

test.describe('Wiki generation E2E flow', () => {
  test.beforeEach(async ({ request }) => {
    // Pre-generate the wiki via API so UI tests don't wait 2+ minutes
    const res = await request.post('/api/generate', {
      data: { url: REPO_URL },
    });
    expect(res.ok()).toBe(true);
  });

  test('homepage renders correctly', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('WikiSmith');
    await expect(
      page.getByPlaceholder(/github\.com/i),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /generate wiki/i }),
    ).toBeVisible();

    // Feature cards
    await expect(page.getByText('Feature-Organized')).toBeVisible();
    await expect(page.getByText('Code Citations')).toBeVisible();
    await expect(page.getByText('AI-Powered')).toBeVisible();
  });

  test('submitting a repo URL navigates to wiki page', async ({ page }) => {
    await page.goto('/');

    const input = page.getByPlaceholder(/github\.com/i);
    await input.fill(REPO_URL);

    const button = page.getByRole('button', { name: /generate wiki/i });
    await button.click();

    // Should navigate to the wiki page (cached, so fast)
    await page.waitForURL(`/wiki/${OWNER}/${REPO}`, { timeout: 60_000 });
    await expect(page).toHaveURL(`/wiki/${OWNER}/${REPO}`);
  });

  test('wiki page shows sidebar and content', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);

    // Wait for wiki to load (fetches from API)
    await expect(page.locator('article h1')).toBeVisible({ timeout: 30_000 });

    // Sidebar should be visible with navigation items
    const sidebar = page.locator('nav');
    await expect(sidebar).toBeVisible();

    // Should show at least the overview in the sidebar
    const sidebarLinks = sidebar.getByRole('link');
    expect(await sidebarLinks.count()).toBeGreaterThan(0);

    // Header should show repo info
    await expect(
      page.getByRole('banner').getByText(`${OWNER}/${REPO}`),
    ).toBeVisible();
  });

  test('sidebar navigation works between pages', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);

    // Wait for content to load
    await expect(page.locator('article h1')).toBeVisible({ timeout: 30_000 });

    // Find sidebar list links (inside <ul>, not the header link)
    const sidebarList = page.locator('nav ul');
    const listLinks = sidebarList.getByRole('link');
    const linkCount = await listLinks.count();

    // Must have overview + at least one feature page
    expect(linkCount).toBeGreaterThan(1);

    // Click a feature page link (skip index 0 which is overview)
    const featureLink = listLinks.nth(1);
    const featureHref = await featureLink.getAttribute('href');
    expect(featureHref).toBeTruthy();
    await featureLink.click();

    // URL should now include the feature slug
    await page.waitForURL(featureHref!, { timeout: 15_000 });

    // Content should update with the feature page
    const heading = page.locator('article h1');
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Navigate back to overview via the overview link
    const overviewLink = listLinks.first();
    await overviewLink.click();
    await page.waitForURL(`/wiki/${OWNER}/${REPO}`, { timeout: 15_000 });
  });

  test('wiki page renders markdown content', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);

    // Wait for content
    await expect(page.locator('article h1')).toBeVisible({ timeout: 30_000 });

    // Content area should have prose elements (rendered markdown)
    const prose = page.locator('article .prose');
    await expect(prose).toBeVisible();

    // Should have at least one paragraph of content
    const paragraphs = prose.locator('p');
    expect(await paragraphs.count()).toBeGreaterThan(0);
  });

  test('WikiSmith header link navigates to homepage', async ({ page }) => {
    await page.goto(`/wiki/${OWNER}/${REPO}`);
    await expect(page.locator('article h1')).toBeVisible({ timeout: 30_000 });

    // Click the "WikiSmith" link in the page header (not sidebar)
    await page.getByRole('link', { name: 'WikiSmith', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('WikiSmith');
  });
});
