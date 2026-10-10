import { test, expect } from '../../lib/fixtures';

test('language selection persists and applies the correct text direction', async ({ page }) => {
  await page.goto('/preferences/appearance');

  await page.getByRole('button', { name: /فارسی/ }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'ظاهر' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'ظاهر' })).toBeVisible();

  await page.getByRole('button', { name: /English/ }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Português|Español|Français|Deutsch|日本語|한국어|中文|العربية/ })).toHaveCount(0);
});
