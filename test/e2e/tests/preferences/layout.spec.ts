import { test, expect } from '../../lib/fixtures';
import * as api from '../../lib/api';

test('workspace always uses expanded layout and has no centered chooser', async ({ page, testProject }) => {
  await page.goto('/preferences/appearance');
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Centered|Expanded/i })).toHaveCount(0);
  for (const route of [`/d/projects/${testProject.key}/items`, '/user/inbox']) {
    await page.goto(route);
    await expect(page.locator('main > div').first()).not.toHaveClass(/max-w-7xl/);
    await expect(page.locator('.app-shell-main > nav > div')).not.toHaveClass(/max-w-7xl/);
  }
});

test('legacy centered settings cannot constrain the workspace after reload', async ({ page, request, testUser, testProject }) => {
  await api.setPreference(request, testUser.token, 'layout', 'centered');
  await page.addInitScript(() => localStorage.setItem('montask_layout', 'centered'));
  await page.goto(`/d/projects/${testProject.key}/items`);
  await page.reload();
  await expect(page.locator('main > div').first()).not.toHaveClass(/max-w-7xl/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('montask_layout'))).toBe('expanded');
});
