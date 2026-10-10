import { test, expect, getAdminToken } from '../../lib/fixtures';
import * as api from '../../lib/api';
import fs from 'fs';
import { openPalette, paletteInput } from '../../lib/palette';
import { randomUUID } from 'crypto';

const localInput = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

test.describe('Project time tracker', () => {
  test('project owner reports and edits member time without mixing personal history', async ({ page, request, testUser, testProject }) => {
    const admin = getAdminToken();
    const email = `time-${randomUUID()}@test.local`;
    const created = await api.createUser(request, admin, email, 'Time report member');
    try {
      const member = await api.login(request, email, created.temporary_password);
      await api.changePassword(request, member.token, created.temporary_password, 'TimeTest123!');
      const login = await api.login(request, email, 'TimeTest123!');
      await api.addMember(request, testUser.token, testProject.key, created.user.id, 'member');
      const response = await request.post(`${process.env.BASE_URL || 'http://localhost:5173'}/api/v1/default/time-tracking/entries`, {
        headers: { Authorization: `Bearer ${login.token}` },
        data: { project_key: testProject.key, description: 'Member tracked activity', started_at: new Date(Date.now() - 3600000).toISOString(), ended_at: new Date(Date.now() - 1800000).toISOString() },
      });
      expect(response.ok(), await response.text()).toBe(true);
      await page.goto('/d/time-tracking');
      await expect(page.getByRole('heading', { name: 'Time tracking', exact: true })).toBeVisible();
      await expect(page.getByText('Member tracked activity', { exact: true })).not.toBeVisible();
      await page.goto('/d/time-reports');
      const row = page.getByRole('row').filter({ hasText: 'Member tracked activity' });
      await expect(row).toContainText('Time report member');
      await row.getByRole('button', { name: 'Edit time entry' }).click();
      await page.getByRole('dialog').getByLabel('Description (optional)', { exact: true }).fill('Manager corrected activity');
      await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByText('Manager corrected activity', { exact: true })).toBeVisible();
    } finally {
      await api.deactivateUser(request, admin, created.user.id);
    }
  });

  test('timer persists across reload and pages, manual time integrates with items and reports', async ({ page, request, testUser, testProject }) => {
    const item = await api.createWorkItem(request, testUser.token, testProject.key, { type: 'task', title: 'Tracked task' });
    const start = new Date(Date.now() - 7200000);
    const end = new Date(Date.now() - 3600000);
    await api.createTimeEntry(request, testUser.token, testProject.key, item.item_number, { started_at: start.toISOString(), duration_seconds: 60, description: 'Legacy tracked time' });
    await page.goto('/d/time-tracking');
    await expect(page.getByRole('heading', { name: 'Time tracking', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start timer', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByPlaceholder('Search projects...').fill(testProject.name);
    await page.getByRole('button', { name: new RegExp(testProject.name) }).click();
    await page.getByLabel('Description (optional)', { exact: true }).fill('Live timer test');
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    await expect(page.getByText('Running on ' + testProject.name)).toBeVisible();
    await page.reload();
    await expect(page.getByText('Running on ' + testProject.name)).toBeVisible();
    await page.getByRole('link', { name: 'Time reports', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Time reports', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Stop timer', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Stop timer', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop timer', exact: true })).not.toBeVisible();
    await page.goto('/d/time-tracking');
    await expect(page.getByText('Live timer test', { exact: true })).toBeVisible();
    await expect(page.getByText('Legacy tracked time', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Manual entry', exact: true }).click();
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(testProject.name) }).click();
    await page.getByLabel('Item (optional)', { exact: true }).selectOption(String(item.item_number));
    await page.getByLabel('Description (optional)', { exact: true }).fill('Manual overlapping test');
    await page.getByLabel('Start time', { exact: true }).fill(localInput(start));
    await page.getByLabel('End time', { exact: true }).fill(localInput(end));
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('This time overlaps another entry. Save it anyway?')).toBeVisible();
    await page.getByRole('button', { name: 'Save anyway', exact: true }).click();
    await expect(page.getByText('Manual overlapping test', { exact: true })).toBeVisible();
    const row = page.getByText('Manual overlapping test', { exact: true }).locator('xpath=../..');
    await row.getByRole('button', { name: 'Edit time entry' }).click();
    await page.getByRole('dialog').getByLabel('Description (optional)', { exact: true }).fill('Edited tracked time');
    await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Save anyway', exact: true }).click();
    await expect(page.getByText('Edited tracked time', { exact: true })).toBeVisible();
    await page.goto(`/d/projects/${testProject.key}/items/${item.item_number}`);
    await page.getByRole('button', { name: 'Time', exact: true }).click();
    await expect(page.getByText('Edited tracked time', { exact: true })).toBeVisible();
    await page.goto('/d/time-reports');
    await expect(page.getByRole('cell', { name: 'Edited tracked time Overlapping time' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
    const csv = await download;
    const filename = await csv.path();
    expect(fs.readFileSync(filename!, 'utf8')).toContain('Edited tracked time');
    await page.getByRole('row').filter({ hasText: 'Edited tracked time' }).getByRole('button', { name: 'Delete time entry' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Edited tracked time', { exact: true })).not.toBeVisible();
    await page.goto('/d/time-tracking');
    await page.getByText('Live timer test', { exact: true }).locator('xpath=../..').getByRole('button', { name: 'Start again' }).click();
    await expect(page.getByText('Running on ' + testProject.name)).toBeVisible();
    await page.getByRole('button', { name: 'Stop timer', exact: true }).first().click();
    await expect(page.getByText('Running on ' + testProject.name)).not.toBeVisible();
    await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Time tracking', exact: true })).toBeVisible();
    await openPalette(page);
    await paletteInput(page).fill('Time reports');
    await page.locator('[data-nav-item]').filter({ hasText: /^Time reports$/ }).click();
    await expect(page.getByRole('heading', { name: 'Time reports', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/time-report-desktop.png', fullPage: true });
  });

  test('Persian mobile and dark layouts expose both time pages', async ({ page, request, testUser, testProject }) => {
    await api.setPreference(request, testUser.token, 'language', 'fa');
    await api.setPreference(request, testUser.token, 'theme', 'dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/d/time-tracking');
    await expect(page.getByRole('heading', { name: 'ثبت زمان', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.getByRole('button', { name: 'منو', exact: true }).click();
    await expect(page.getByRole('link', { name: 'ثبت زمان', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'گزارش زمان', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'گزارش زمان', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/time-report-fa-mobile.png', fullPage: true });
    expect(testProject.key).toBeTruthy();
  });
});
