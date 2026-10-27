import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Several CIFs open at once: one card per file (chemical name, space group, ×) to the right of a
// divider in the Open CIF bar; the card clicked is the structure every tab shows.
test.use({ viewport: { width: 1400, height: 1000 } });

const cif = (name: string) => `tests/fixtures/cifs/${name}.cif`;
const names = (page: Page) => page.getByTestId('cif-card-name');
const atoms = (page: Page) =>
  page.evaluate(() => window.__crystallens.model()?.count ?? 0) as Promise<number>;

async function selected(page: Page) {
  return page
    .getByTestId('cif-card-select')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-pressed') === 'true'));
}

test('several files open as cards with their formula and space group; the newest is shown', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('cif-card')).toHaveCount(0);
  await page.getByTestId('cif-input').setInputFiles(cif('NaCl'));
  await expect(page.getByTestId('hud')).toContainText('27 atoms');
  await page.getByTestId('cif-input').setInputFiles([cif('Si'), cif('rutile')]);
  await expect(names(page)).toHaveText(['NaCl', 'Si', 'TiO2']);
  await expect(names(page).nth(2).locator('sub')).toHaveText('2'); // TiO₂
  await expect(page.getByTestId('cif-card-sg').nth(2)).toContainText('P');
  // the chemical name and the file are in the tooltip
  await expect(page.getByTestId('cif-card').nth(0)).toHaveAttribute(
    'title',
    'Sodium chloride · NaCl.cif',
  );
  expect(await selected(page)).toEqual([false, false, true]);
  await expect(page.getByTestId('hud')).toContainText('15 atoms'); // rutile

  // the divider stands between the Open button and the cards
  const button = (await page.getByRole('button', { name: /Open CIF/ }).boundingBox())!;
  const divider = (await page.locator('section.load .divider').boundingBox())!;
  const first = (await page.getByTestId('cif-card').first().boundingBox())!;
  expect(divider.x).toBeGreaterThan(button.x + button.width);
  expect(first.x).toBeGreaterThan(divider.x);
});

test('clicking a card shows that structure in every tab; × closes it and shows a neighbour', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles([cif('NaCl'), cif('Si'), cif('rutile')]);
  await expect(page.getByTestId('hud')).toContainText('15 atoms');

  await page.getByTestId('cif-card-select').nth(0).click();
  await expect(page.getByTestId('hud')).toContainText('27 atoms');
  expect(await selected(page)).toEqual([true, false, false]);
  await page.getByTestId('tab-xrd').click();
  await expect(page.getByTestId('xrd-tab')).toContainText('Powder pattern');
  await expect(page.getByTestId('xrd-hud')).toContainText('peaks');
  const nacl = await page.evaluate(() => window.__crystallensXRD.peaks().length);
  await page.getByTestId('cif-card-select').nth(1).click();
  await expect
    .poll(() => page.evaluate(() => window.__crystallensXRD.peaks().length))
    .not.toBe(nacl);
  await page.getByTestId('tab-structure').click();

  // closing the shown card shows the next one; closing another leaves the shown one alone
  await page.getByTestId('cif-card-close').nth(1).click(); // Si, shown
  await expect(names(page)).toHaveText(['NaCl', 'TiO2']);
  expect(await selected(page)).toEqual([false, true]);
  await expect.poll(() => atoms(page)).toBe(15);
  await page.getByTestId('cif-card-close').nth(0).click(); // NaCl, not shown
  await expect(names(page)).toHaveText(['TiO2']);
  expect(await atoms(page)).toBe(15);
  await page.getByTestId('cif-card-close').click();
  await expect(page.getByTestId('cif-card')).toHaveCount(0);
  await expect(page.locator('section.load .divider')).toHaveCount(0);
  await expect(page.getByText('Open a CIF above to see its structure.')).toBeVisible();
});

test('a file that is not a CIF is reported and gets no card; the others still open', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles([
    { name: 'notes.cif', mimeType: 'text/plain', buffer: Buffer.from('hello') },
    { name: 'Si.cif', mimeType: 'text/plain', buffer: readFileSync(cif('Si')) },
  ]);
  await expect(names(page)).toHaveText(['Si']);
  await expect(page.getByTestId('error')).toContainText('notes.cif');
});

test('more than 10 open structures bring a warning; more than 40 are refused', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(Array(10).fill(cif('Si')));
  await expect(page.getByTestId('cif-card')).toHaveCount(10);
  await expect(page.getByTestId('cif-warning')).toHaveCount(0);

  await page.getByTestId('cif-input').setInputFiles(cif('NaCl'));
  await expect(page.getByTestId('cif-card')).toHaveCount(11);
  await expect(page.getByTestId('cif-warning')).toContainText('11 structures are open');
  await expect(page.getByTestId('cif-warning')).toContainText('slow');
  await page.getByTestId('cif-card-close').first().click();
  await expect(page.getByTestId('cif-warning')).toHaveCount(0);

  await page.getByTestId('cif-input').setInputFiles(Array(35).fill(cif('Si')));
  await expect(page.getByTestId('cif-card')).toHaveCount(40);
  await expect(page.getByTestId('error')).toContainText('5 files were not opened');
  await expect(page.getByTestId('cif-warning')).toContainText('40 structures are open');
});

test('each file keeps its view settings, camera, diffraction and powder settings while another is shown', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(cif('NaCl'));
  await expect(page.getByTestId('hud')).toContainText('27 atoms');
  await page.getByTestId('cif-input').setInputFiles(cif('Si'));
  await expect(page.getByTestId('hud')).toContainText('18 atoms'); // Si shown
  const card = (i: number) => page.getByTestId('cif-card-select').nth(i);
  const viewer = () => page.evaluate(() => window.__crystallens.viewState());
  const ed = () => page.evaluate(() => window.__crystallensED.viewState());

  // Si: space filling, turned and zoomed; a zone axis, 120 kV and the Pattern tab's Laue zones;
  // Mo radiation and a zoomed powder plot
  await page.getByTestId('style').selectOption('spaceFill');
  await page.locator('[data-testid="viewer"] .stage').focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  const fitted = (await viewer()).visibleHeight;
  await page.mouse.move(500, 600);
  await page.mouse.wheel(0, -400);
  await expect.poll(async () => (await viewer()).visibleHeight).toBeLessThan(0.9 * fitted);
  const siView = await viewer();

  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-hud')).toContainText('spots');
  for (let k = 0; k < 3; k++) await page.getByTestId(`ed-uvw-${k}`).fill(['1', '1', '0'][k]);
  await page.getByTestId('ed-uvw-go').click();
  await page.getByTestId('ed-preset-120').click();
  await page.getByTestId('ed-zoom-in').click();
  await expect(page.getByTestId('ed-readout')).toContainText('beam ∥ [1 1 0] · 0.00°');
  const siEd = await ed();

  await page.getByTestId('tab-xrd').click();
  await expect(page.getByTestId('xrd-hud')).toContainText('peaks');
  await page.getByTestId('xrd-radiation').selectOption('MoKa');
  await page.getByTestId('xrd-zoom-in').click();
  await expect.poll(() => page.evaluate(() => window.__crystallensXRD.lambda())).toBeLessThan(1);
  const siPlot = await page.evaluate(() => window.__crystallensXRD.view());

  // NaCl: the Structure Viewer showed it before, with the default style; the other two tabs never
  // did, so it starts there like a newly opened file (current settings, default zone axis)
  await card(0).click();
  await expect(page.getByTestId('xrd-radiation')).toHaveValue('MoKa');
  await page.getByTestId('xrd-radiation').selectOption('CoKa');
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-readout')).toContainText('beam ∥ [0 0 1]');
  await page.getByTestId('ed-preset-300').click();
  await page.getByTestId('tab-structure').click();
  await expect(page.getByTestId('hud')).toContainText('27 atoms');
  await expect(page.getByTestId('style')).toHaveValue('ballStick');

  // back to Si: everything as it was left
  await card(1).click();
  await expect(page.getByTestId('hud')).toContainText('atoms');
  await expect(page.getByTestId('style')).toHaveValue('spaceFill');
  await expect
    .poll(async () => (await viewer()).visibleHeight)
    .toBeCloseTo(siView.visibleHeight, 3);
  const back = await viewer();
  for (let k = 0; k < 3; k++) expect(back.direction[k]).toBeCloseTo(siView.direction[k], 4);
  expect(back.visibleHeight).toBeCloseTo(siView.visibleHeight, 3);

  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-voltage')).toHaveValue('120');
  await expect(page.getByTestId('ed-readout')).toContainText('beam ∥ [1 1 0] · 0.00°');
  const edBack = await ed();
  for (let k = 0; k < 3; k++) expect(edBack.direction[k]).toBeCloseTo(siEd.direction[k], 4);
  await expect(page.getByTestId('ed-uvw-0')).toHaveValue('1');

  await page.getByTestId('tab-xrd').click();
  await expect(page.getByTestId('xrd-radiation')).toHaveValue('MoKa');
  await expect.poll(() => page.evaluate(() => window.__crystallensXRD.view())).toEqual(siPlot);

  // and NaCl has kept its own changes
  await card(0).click();
  await expect(page.getByTestId('xrd-radiation')).toHaveValue('CoKa');
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-voltage')).toHaveValue('300');
});
