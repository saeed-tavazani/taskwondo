import { test, expect } from '../../lib/fixtures';
import * as api from '../../lib/api';
import type { Locator } from '@playwright/test';

async function expectThumb(toggle: Locator, enabled: boolean, rtl: boolean) {
  await expect(toggle).toHaveAttribute('aria-checked', String(enabled));
  await expect.poll(() => toggle.evaluate((el, options) => {
    const thumb = el.querySelector('span')!;
    const trackBounds = el.getBoundingClientRect();
    const bounds = thumb.getBoundingClientRect();
    const inside = bounds.left >= trackBounds.left && bounds.right <= trackBounds.right;
    const left = bounds.left - trackBounds.left;
    const right = trackBounds.right - bounds.right;
    const atLeft = options.enabled !== options.rtl;
    return inside && (atLeft ? right < left : left < right)
      && getComputedStyle(thumb).backgroundColor !== getComputedStyle(el).backgroundColor;
  }, { enabled, rtl })).toBe(true);
}

test('shared switches keep their thumb inside the track in both directions and themes', async ({ page, request, testUser, testProject }) => {
  const queue = await api.createQueue(request, testUser.token, testProject.key, { name: 'Switch layout', queue_type: 'support', is_public: false });
  for (const language of ['fa', 'en']) {
    await api.setPreference(request, testUser.token, 'language', language);
    for (const theme of ['dark', 'light']) {
      await api.setPreference(request, testUser.token, 'theme', theme);
      for (const width of [375, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/d/projects/${testProject.key}/queues/${queue.id}`);
        const toggle = page.getByRole('switch');
        await expectThumb(toggle, false, language === 'fa');
        await toggle.click();
        await expectThumb(toggle, true, language === 'fa');
        await toggle.focus();
        await page.keyboard.press('Space');
        await expectThumb(toggle, false, language === 'fa');
      }
    }
  }
});

test('compact inbox switches keep the same bounds when saving their state', async ({ page, request, testUser }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const language of ['fa', 'en']) {
    await api.setPreference(request, testUser.token, 'language', language);
    await api.setPreference(request, testUser.token, 'inbox_auto_remove', false);
    await page.goto('/user/inbox');
    const toggle = page.getByRole('switch').filter({ visible: true });
    await expectThumb(toggle, false, language === 'fa');
    await toggle.click();
    await expectThumb(toggle, true, language === 'fa');
    await page.reload();
    await expectThumb(toggle, true, language === 'fa');
  }
});
