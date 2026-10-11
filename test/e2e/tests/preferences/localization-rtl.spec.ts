import { test, expect } from '../../lib/fixtures';
import * as api from '../../lib/api';

test('relative time and logged duration follow the selected language', async ({ page, request, testUser, testProject }) => {
  const item = await api.createWorkItem(request, testUser.token, testProject.key, { title: 'Localized item', type: 'task' });
  await api.createTimeEntry(request, testUser.token, testProject.key, item.item_number, {
    started_at: new Date().toISOString(), duration_seconds: 9000,
  });
  for (const [language, duration, relative] of [['fa', '2 ساعت 30 دقیقه', 'کمتر از یک دقیقه پیش'], ['en', '2h 30m', '< 1m ago']]) {
    await api.setPreference(request, testUser.token, 'language', language);
    await page.goto(`/d/projects/${testProject.key}/items/${item.item_number}`);
    await expect(page.getByText(duration, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(relative, { exact: true }).filter({ visible: true }).first()).toBeVisible();
  }
});

test('collapsed sidebar tooltips remain inside the viewport and on the content side in RTL and LTR', async ({ page, request, testUser, testProject }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await api.setPreference(request, testUser.token, 'sidebarAppCollapsed', 'true');
  await api.setPreference(request, testUser.token, 'sidebarSettingsCollapsed', 'true');
  for (const language of ['fa', 'en']) {
    await api.setPreference(request, testUser.token, 'language', language);
    for (const [route, href, label] of [
      [`/d/projects/${testProject.key}/items?view=board`, `/d/projects/${testProject.key}/items`, language === 'fa' ? 'آیتم‌ها' : 'Items'],
      ['/preferences/appearance', '/preferences/appearance', language === 'fa' ? 'ظاهر' : 'Appearance'],
    ]) {
      await page.goto(route);
      const link = page.locator(`nav a[href="${href}"]`).filter({ visible: true }).first();
      await expect(link).toHaveAccessibleName(label);
      await link.hover();
      const tooltip = page.getByRole('tooltip').filter({ hasText: label });
      await expect(tooltip).toBeVisible();
      await expect.poll(async () => {
        const bounds = await tooltip.boundingBox();
        const trigger = await link.boundingBox();
        if (!bounds || !trigger) return false;
        return bounds.x >= 0 && bounds.x + bounds.width <= 1440 && (language === 'fa'
          ? bounds.x + bounds.width <= trigger.x
          : bounds.x >= trigger.x + trigger.width);
      }).toBe(true);
      await page.mouse.move(720, 500);
      await expect(tooltip).not.toBeVisible();
      await link.focus();
      await expect(tooltip).toBeVisible();
      await page.keyboard.press('Tab');
    }
  }
});
