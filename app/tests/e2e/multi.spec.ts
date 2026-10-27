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

test('several files open as cards with their chemical name and space group; the newest is shown', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('cif-card')).toHaveCount(0);
  await page.getByTestId('cif-input').setInputFiles(cif('NaCl'));
  await expect(page.getByTestId('hud')).toContainText('27 atoms');
  await page.getByTestId('cif-input').setInputFiles([cif('Si'), cif('rutile')]);
  await expect(names(page)).toHaveText(['Sodium chloride', 'Silicon', 'Rutile']);
  await expect(page.getByTestId('cif-card-sg').nth(2)).toContainText('P');
  await expect(page.getByTestId('cif-card').nth(0)).toHaveAttribute('title', /NaCl\.cif/);
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
  await expect(names(page)).toHaveText(['Sodium chloride', 'Rutile']);
  expect(await selected(page)).toEqual([false, true]);
  await expect.poll(() => atoms(page)).toBe(15);
  await page.getByTestId('cif-card-close').nth(0).click(); // NaCl, not shown
  await expect(names(page)).toHaveText(['Rutile']);
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
  await expect(names(page)).toHaveText(['Silicon']);
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
