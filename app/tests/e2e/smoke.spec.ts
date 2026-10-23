import { expect, test } from '@playwright/test';

test('app shell loads and the Rust/WASM kernel answers through the worker', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page).toHaveTitle('CrystalLens');
  await expect(page.getByRole('heading', { name: 'CrystalLens', level: 1 })).toBeVisible();

  await expect(page.getByTestId('worker-status')).toHaveText('running');
  await expect(page.getByTestId('kernel-status')).toHaveText(/^kernel v\d+\.\d+\.\d+$/);
  expect(errors).toEqual([]);
});
