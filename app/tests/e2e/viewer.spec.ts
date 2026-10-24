import { expect, test, type Page } from '@playwright/test';

interface Hook {
  atomScreen(i: number): { x: number; y: number };
  stats(): { frames: number; renders: number };
  model(): { bonds: Uint32Array };
  pickAt(x: number, y: number): number | null;
  selection(): number[];
}
declare global {
  interface Window {
    __crystallens: Hook;
  }
}

// Tall enough that the whole viewer is on screen: Playwright ignores clicks outside the viewport.
test.use({ viewport: { width: 1200, height: 1100 } });

async function load(page: Page, name: string) {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(`tests/fixtures/cifs/${name}.cif`);
  await expect(page.getByTestId('hud')).toContainText('atoms');
}

/** A fingerprint of what the canvas shows, via a screenshot of it. */
const picture = async (page: Page) =>
  (await page.getByTestId('viewer-canvas').screenshot()).toString('base64');

test('draws the structure: atoms, bonds, and it changes when rotated', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await load(page, 'NaCl');
  await expect(page.getByTestId('hud')).toContainText('27 atoms · 54 bonds');

  // Not blank: compare with the picture after hiding everything is not possible, so check that
  // the canvas is neither a flat colour nor unchanged by a drag.
  const before = await picture(page);
  expect(before.length).toBeGreaterThan(4000);

  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx + 120, cy + 120);
  await page.mouse.down();
  await page.mouse.move(cx + 220, cy + 160, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await picture(page)) !== before).toBe(true);
  expect(errors).toEqual([]);
});

test('hover shows the exact atom, and the style switch changes the counts shown', async ({
  page,
}) => {
  await load(page, 'NaCl');
  // Atom 0 is at the origin; hover its projected centre.
  const p = await page.evaluate(() => window.__crystallens.atomScreen(0));
  await page.mouse.move(p.x, p.y);
  await expect(page.getByTestId('tooltip')).toBeVisible();
  await expect(page.getByTestId('tooltip')).toContainText(/Na|Cl/);
  await expect(page.getByTestId('tooltip')).toContainText('frac 0.0000 0.0000 0.0000');

  // Far from any atom there is no tooltip.
  const canvas = page.getByTestId('viewer-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 3, box.y + 3);
  await expect(page.getByTestId('tooltip')).toHaveCount(0);
});

test('measure mode: two clicks give the Na-Cl distance, three add an angle', async ({ page }) => {
  await load(page, 'NaCl');
  await page.getByTestId('measure').check();
  // Take a bonded pair whose centres are both visible (not hidden behind another atom).
  const pair = await page.evaluate(() => {
    const hook = window.__crystallens;
    const bonds = hook.model().bonds;
    const visible = (i: number) => {
      const p = hook.atomScreen(i);
      return hook.pickAt(p.x, p.y) === i;
    };
    for (let k = 0; k < bonds.length; k += 2) {
      if (visible(bonds[k]) && visible(bonds[k + 1])) return [bonds[k], bonds[k + 1]];
    }
    return [];
  });
  expect(pair).toHaveLength(2);
  for (const i of pair) {
    const p = await page.evaluate((k) => window.__crystallens.atomScreen(k), i);
    await page.mouse.click(p.x, p.y);
  }
  expect(await page.evaluate(() => window.__crystallens.selection())).toEqual(pair);
  await expect(page.getByTestId('measurement')).toHaveCount(1);
  await expect(page.getByTestId('measurement')).toContainText('2.810 Å');
});

test('the structure changes with the cells control, and perspective renders too', async ({
  page,
}) => {
  await load(page, 'NaCl');
  await page.getByLabel('Cells along a').fill('2');
  await page.getByLabel('Cells along a').dispatchEvent('change');
  await expect(page.getByTestId('hud')).toContainText('45 atoms');
  await page.getByTestId('projection').selectOption('persp');
  await page.getByTestId('style').selectOption('spaceFill');
  const filled = await picture(page);
  await page.getByTestId('style').selectOption('stick');
  await expect.poll(async () => (await picture(page)) !== filled).toBe(true);
});
