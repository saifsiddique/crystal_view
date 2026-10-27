import { expect, test, type Page } from '@playwright/test';

// The page layout: header, load bar, tabbed side panel that collapses and resizes.
test.use({ viewport: { width: 1400, height: 1000 } });

async function load(page: Page, name: string) {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(`tests/fixtures/cifs/${name}.cif`);
  await expect(page.getByTestId('hud')).toContainText('atoms');
}

test('the title is centred, the status pill sits top right, and the file button comes before the viewer', async ({
  page,
}) => {
  await page.goto('/');
  const h1 = (await page
    .getByRole('heading', { name: 'Crystal Viewer Lite', level: 1 })
    .boundingBox())!;
  const brandCentre = h1.x + h1.width / 2;
  expect(Math.abs(brandCentre - 700)).toBeLessThan(120); // logo + title block centred
  const pill = (await page.locator('.status summary').boundingBox())!;
  expect(pill.x).toBeGreaterThan(1200);
  expect(pill.y).toBeLessThan(60);
  // the details are folded away until the pill is clicked
  await expect(page.getByTestId('worker-status')).toBeHidden();
  await page.locator('.status summary').click();
  await expect(page.getByTestId('worker-status')).toBeVisible();

  const open = (await page.getByRole('button', { name: 'Open CIF…' }).boundingBox())!;
  const viewer = (await page.getByTestId('viewer').boundingBox())!;
  expect(open.y).toBeLessThan(viewer.y);
});

test('the settings panel is tabbed, with no horizontal scrolling on any tab', async ({ page }) => {
  await load(page, 'albite'); // triclinic, many elements and sites: the widest tables
  for (const tab of ['Range', 'Bonds', 'Polyhedra', 'Appearance', 'Elements']) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const overflow = await page
      .getByTestId('side-panel')
      .locator('[role="tabpanel"]')
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, tab).toBeLessThanOrEqual(1);
  }
  // only one tab's controls are shown at a time
  await expect(page.getByTestId('beyond')).toBeHidden();
  await page.getByRole('tab', { name: 'Bonds', exact: true }).click();
  await expect(page.getByTestId('beyond')).toBeVisible();
});

test('the side panel collapses and expands, and the stage takes the space', async ({ page }) => {
  await load(page, 'NaCl');
  const stage = page.getByTestId('viewer').locator('.stage');
  const before = (await stage.boundingBox())!.width;
  await page.getByTestId('panel-collapse').click();
  await expect(page.getByTestId('side-panel')).toBeHidden();
  const wide = (await stage.boundingBox())!.width;
  expect(wide).toBeGreaterThan(before + 200);
  // still collapsed after a reload (remembered in this browser)
  await page.reload();
  await page.getByTestId('cif-input').setInputFiles('tests/fixtures/cifs/NaCl.cif');
  await expect(page.getByTestId('panel-expand')).toBeVisible();
  await page.getByTestId('panel-expand').click();
  await expect(page.getByTestId('side-panel')).toBeVisible();
});

test('the side panel resizes by dragging or with the keyboard', async ({ page }) => {
  await load(page, 'NaCl');
  const panel = page.getByTestId('side-panel');
  const w0 = (await panel.boundingBox())!.width;
  const handle = (await page.getByTestId('panel-handle').boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x - 120, handle.y + handle.height / 2, { steps: 6 });
  await page.mouse.up();
  const w1 = (await panel.boundingBox())!.width;
  expect(w1).toBeGreaterThan(w0 + 100);

  await page.getByTestId('panel-handle').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const w2 = (await panel.boundingBox())!.width;
  expect(w2).toBeCloseTo(w1 - 40, 0);
  await page.getByTestId('panel-handle').dblclick();
  expect((await panel.boundingBox())!.width).toBeCloseTo(380, 0);
});

test('the asymmetric unit folds away like the lattice vectors', async ({ page }) => {
  await load(page, 'NaCl');
  const asu = page.getByTestId('asymmetric-unit');
  await expect(asu.locator('table')).toBeVisible();
  await asu.locator('summary').click();
  await expect(asu.locator('table')).toBeHidden();
});

test('a dropped CIF loads like an opened one', async ({ page }) => {
  await page.goto('/');
  const text = await (
    await import('node:fs')
  ).promises.readFile('tests/fixtures/cifs/NaCl.cif', 'utf8');
  const data = await page.evaluateHandle((t) => {
    const dt = new DataTransfer();
    dt.items.add(new File([t], 'NaCl.cif', { type: 'chemical/x-cif' }));
    return dt;
  }, text);
  await page.locator('section.load').dispatchEvent('drop', { dataTransfer: data });
  await expect(page.getByTestId('hud')).toContainText('27 atoms');
  await expect(page.getByTestId('loaded')).toContainText('NaCl.cif');
});
