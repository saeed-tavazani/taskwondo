import { test, expect } from '../../lib/fixtures';

test.describe('Login', () => {
  // Login tests need a fresh browser with no stored auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test('keeps existing login and language when upgrading to Montask', async ({ testUser, page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('taskwondo_token', token);
      localStorage.setItem('taskwondo_language', 'en');
    }, testUser.token);
    await page.goto('/');
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });
    await expect(page).toHaveTitle('Montask');
    await expect(page.getByText('Montask', { exact: true }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('montask_token'))).toBe(testUser.token);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('montask_language'))).toBe('en');
    expect(await page.evaluate(() => localStorage.getItem('taskwondo_token'))).toBeNull();
  });

  test('successful login with email and password', async ({ testUser, page }) => {
    await page.goto('/');

    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill(testUser.password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/login/, { timeout: 10000 });
  });

  test('shows error with invalid credentials', async ({ testUser, page }) => {
    await page.goto('/');

    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByText('invalid email or password')).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });
});
