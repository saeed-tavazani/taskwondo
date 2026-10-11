import { test, expect } from '../../lib/fixtures';
import * as api from '../../lib/api';

test('reference theme remains readable and responsive across language and text sizes', async ({ page, request, testUser, testProject }, testInfo) => {
  test.setTimeout(180000);
  await api.createWorkItem(request, testUser.token, testProject.key, {
    title: 'Review the interface / بررسی رابط', type: 'task', priority: 'high',
  });
  for (const language of ['en', 'fa']) {
    await api.setPreference(request, testUser.token, 'language', language);
    for (const theme of ['light', 'dark']) {
      await api.setPreference(request, testUser.token, 'theme', theme);
      for (const [fontSize, pixels] of [['small', '14.4px'], ['normal', '16px'], ['large', '17.6px']]) {
        await api.setPreference(request, testUser.token, 'fontSize', fontSize);
        for (const width of [375, 768, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`/d/projects/${testProject.key}/items?view=board`);
          await expect(page.locator('html')).toHaveAttribute('dir', language === 'fa' ? 'rtl' : 'ltr');
          await expect.poll(() => page.locator('html').evaluate(el => getComputedStyle(el).fontSize)).toBe(pixels);
          await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
          await expect(page.getByText('Review the interface / بررسی رابط', { exact: true }).filter({ visible: true })).toBeVisible();
          const metrics = await page.evaluate(() => {
            const overflow = document.documentElement.scrollWidth > innerWidth + 1;
            const panel = getComputedStyle(document.querySelector('.app-shell-main')!);
            const rail = document.querySelector('.app-shell-rail');
            const selected = rail?.querySelector('a[aria-current="page"]');
            const color = selected ? getComputedStyle(selected).color : '';
            return { overflow, border: panel.borderTopColor, selected: color };
          });
          expect(metrics.overflow).toBe(false);
          const boardBottomGap = await page.locator('div.flex.items-stretch.overflow-x-auto').evaluate(el => {
            const column = el.firstElementChild!.getBoundingClientRect();
            const panel = document.querySelector('.app-shell-main')!.getBoundingClientRect();
            return panel.bottom - column.bottom;
          });
          expect(boardBottomGap).toBeGreaterThanOrEqual(0);
          expect(boardBottomGap).toBeLessThanOrEqual(48);
          if (width >= 768) {
            expect(metrics.border).toBe(theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)');
            expect(metrics.selected).toBe(theme === 'dark' ? 'rgb(245, 245, 245)' : 'rgb(38, 38, 38)');
          }
          await testInfo.attach(`${language}-${theme}-${fontSize}-${width}`, {
            body: await page.screenshot(), contentType: 'image/png',
          });
          if (width === 768 && fontSize === 'large') {
            const board = page.locator('div.flex.items-stretch.overflow-x-auto');
            const next = page.getByRole('button', { name: language === 'fa' ? 'پیمایش به ستون وضعیت بعدی' : 'Scroll to next status column' });
            const previous = page.getByRole('button', { name: language === 'fa' ? 'پیمایش به ستون وضعیت قبلی' : 'Scroll to previous status column' });
            await next.click();
            await expect.poll(() => board.evaluate(el => Math.abs(el.scrollLeft))).toBeGreaterThan(100);
            await previous.click();
            await expect.poll(() => board.evaluate(el => Math.abs(el.scrollLeft))).toBeLessThan(1);
          }
        }
      }
    }
  }
});

test('compact controls and opaque dialogs retain mobile form scrolling', async ({ page }, testInfo) => {
  await page.goto('/preferences/appearance');
  await page.getByRole('button', { name: /Dark Always dark/i }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/user/inbox');
    const create = page.getByRole('button', { name: width < 640 ? 'New' : 'New Item', exact: true });
    await create.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    const metrics = await dialog.evaluate(el => {
      const style = getComputedStyle(el);
      const bounds = el.getBoundingClientRect();
      return { background: style.backgroundColor, top: bounds.top, bottom: bounds.bottom };
    });
    expect(metrics.background).toBe('rgb(25, 25, 25)');
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(801);
    await dialog.locator('select#visibility').scrollIntoViewIfNeeded();
    await expect(dialog.locator('select#visibility')).toBeVisible();
    await testInfo.attach(`dialog-dark-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
});
