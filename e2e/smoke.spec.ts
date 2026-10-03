import { expect, test } from '@playwright/test';

test('home renders with the footer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('Built and maintained by Kiboh Inc.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Source on GitHub' })).toBeVisible();
});
