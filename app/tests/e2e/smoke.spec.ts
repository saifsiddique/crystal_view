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

test('core inspector loads a CIF and reports the crystal', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles('tests/fixtures/cifs/NaCl.cif');
  await expect(page.getByTestId('space-group')).toContainText('225');
  await expect(page.getByTestId('formula')).toContainText('Cl Na, Z = 4');
  await expect(page.getByTestId('formula')).toContainText('8 atoms');

  await page.getByTestId('detect').click();
  await expect(page.getByTestId('detected')).toContainText('detected 225');
  await expect(page.getByTestId('detected')).toContainText('matches the CIF');

  await expect(page.getByTestId('scattering')).toContainText('Iron');
});
