import { test, expect, getAdminToken } from '../../lib/fixtures';
import * as api from '../../lib/api';
import { randomUUID } from 'crypto';

test('timer survives namespace changes while projects and entries stay scoped', async ({ page, request, testUser, testProject }) => {
  const admin = getAdminToken();
  const slug = `time-${randomUUID().slice(0, 8)}`;
  await api.enableNamespaces(request, admin);
  await api.createNamespace(request, admin, slug, 'Time workspace');
  await api.addNamespaceMember(request, admin, slug, testUser.id, 'admin');
  const other = await api.createProject(request, testUser.token, testProject.key, 'Other workspace project', slug);
  try {
    await page.goto('/d/time-tracking');
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(testProject.name) }).click();
    await page.getByLabel('Description (optional)', { exact: true }).fill('Namespace timer');
    await page.getByRole('button', { name: 'Start timer', exact: true }).click();
    await expect(page.getByText('Running on ' + testProject.name)).toBeVisible();
    await page.goto(`/${slug}/time-tracking`);
    await expect(page.getByRole('heading', { name: 'Time tracking', exact: true })).toBeVisible();
    await expect(page.getByText('Running on ' + testProject.name)).toBeVisible();
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await expect(page.getByRole('button', { name: new RegExp(other.name) })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(testProject.name) })).not.toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Stop timer', exact: true }).first().click();
    await expect(page.getByText('Running on ' + testProject.name)).not.toBeVisible();
    await expect(page.getByText('Namespace timer', { exact: true })).not.toBeVisible();
    await page.goto('/d/time-tracking');
    await expect(page.getByText('Namespace timer', { exact: true })).toBeVisible();
  } finally {
    const base = process.env.BASE_URL || 'http://localhost:5173';
    const active = await request.get(`${base}/api/v1/user/time-timer`, { headers: { Authorization: `Bearer ${testUser.token}` } });
    const timer = (await active.json()).data;
    if (timer?.id) await request.post(`${base}/api/v1/user/time-timers/${timer.id}/stop`, { headers: { Authorization: `Bearer ${testUser.token}` } });
    await api.deleteProject(request, admin, other.key, slug);
    await api.deleteNamespace(request, admin, slug);
  }
});
