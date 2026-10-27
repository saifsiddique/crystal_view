import { expect, test, type Page } from '@playwright/test';

// Dynamical spot pattern on request (M11): button, busy indicator, live thickness, and the
// warning before a move switches back to kinematic intensities.
test.use({ viewport: { width: 1400, height: 1100 } });

async function openED(page: Page, name: string) {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(`tests/fixtures/cifs/${name}.cif`);
  await expect(page.getByTestId('hud')).toContainText('atoms');
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-hud')).toContainText('spots');
}

async function zoneAxis(page: Page, v: [number, number, number]) {
  for (let k = 0; k < 3; k++) await page.getByTestId(`ed-uvw-${k}`).fill(String(v[k]));
  await page.getByTestId('ed-uvw-go').click();
  await expect(page.getByTestId('ed-readout')).toContainText(`beam ∥ [${v.join(' ')}] · 0.00°`);
}

const dyn = (page: Page) => page.evaluate(() => window.__crystallensED.dynamic());
const viewDir = async (page: Page) =>
  (await page.evaluate(() => window.__crystallensED.viewState())).direction;

async function calculate(page: Page) {
  await page.getByTestId('ed-dyn-calc').click();
  await expect.poll(async () => (await dyn(page)).shown, { timeout: 15000 }).toBe(true);
  await expect(page.getByTestId('ed-caption')).toContainText('Dynamical');
}

test('the button solves in the background with an indicator, then shows dynamical intensities', async ({
  page,
}) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  const kinematic = (await page.evaluate(() => window.__crystallensED.pattern()))!;
  expect(kinematic.spots.find((s) => s.hkl.join(' ') === '0 0 2')).toBeUndefined();

  // 400 beams take a few seconds: long enough to see the indicator
  await page.getByTestId('ed-dyn-beams').fill('400');
  await page.getByTestId('ed-dyn-calc').click();
  await expect(page.getByTestId('ed-dyn-busy')).toBeVisible();
  await expect(page.getByTestId('ed-dyn-busy')).toContainText('400 beams');
  await expect(page.getByTestId('ed-dyn-calc')).toBeDisabled();
  // the page stays responsive while the worker solves: the pattern can still be zoomed
  await page.getByTestId('ed-zoom-in').click();
  await expect(page.getByTestId('ed-dyn-busy')).toBeHidden({ timeout: 30000 });
  await expect(page.getByTestId('ed-dyn-status')).toContainText('400 beams');

  const d = await dyn(page);
  expect(d.shown).toBe(true);
  expect(d.beams).toBe(400);
  expect(d.transmitted!).toBeGreaterThan(0);
  expect(d.total!).toBeLessThan(1); // absorption on by default
  // double diffraction: the kinematically forbidden 002 is lit
  const s002 = d.spots.find((s) => s.hkl.join(' ') === '0 0 2')!;
  expect(s002.kinematicallyForbidden).toBe(true);
  expect(s002.fraction).toBeGreaterThan(1e-4); // 0 kinematically; ~5e-4 at 300 kV, 100 Å
  await expect(page.getByTestId('ed-caption')).toContainText('Dynamical · 400 beams');
  await expect(page.getByTestId('ed-hud')).toContainText('of the incident beam');
  // the pattern drawn is the dynamical one
  await expect
    .poll(() => page.evaluate(() => window.__crystallensED.spotClient('0 0 2')))
    .not.toBe(null);
});

test('thickness re-evaluates the dynamical intensities live; other settings go back to kinematic', async ({
  page,
}) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  await calculate(page);
  const before = (await dyn(page)).transmitted!;
  await page.getByTestId('ed-thickness').fill('600');
  await expect.poll(async () => (await dyn(page)).transmitted).not.toBe(before);
  expect((await dyn(page)).shown).toBe(true);
  await expect(page.getByTestId('ed-caption')).toContainText('t = 600 Å');

  await page.getByTestId('ed-preset-120').click();
  await expect.poll(async () => (await dyn(page)).shown).toBe(false);
  await expect(page.getByTestId('ed-dyn-note')).toContainText('setting changed');
  await expect(page.getByTestId('ed-caption')).toContainText('ZOLZ');
});

test('arrow keys while dynamical: a warning first; Keep cancels, Switch goes kinematic and moves', async ({
  page,
}) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  await calculate(page);
  const start = await viewDir(page);

  await page.locator('[data-testid="ed-tab"] .stage').focus(); // focus without a click
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('ed-dyn-warning')).toBeVisible();
  expect(await viewDir(page)).toEqual(start);
  await page.getByTestId('ed-dyn-keep').click();
  await expect(page.getByTestId('ed-dyn-warning')).toBeHidden();
  expect((await dyn(page)).shown).toBe(true);
  expect(await viewDir(page)).toEqual(start);

  await page.locator('[data-testid="ed-tab"] .stage').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('ed-dyn-switch')).toBeFocused();
  await page.getByTestId('ed-dyn-switch').click();
  await expect.poll(async () => (await dyn(page)).shown).toBe(false);
  await expect.poll(() => viewDir(page)).not.toEqual(start);
  await expect(page.getByTestId('ed-readout')).toContainText('1.00°');
  await expect(page.getByTestId('ed-caption')).not.toContainText('Dynamical');
});

test('dragging the structure or tilting the pattern while dynamical is stopped by the warning', async ({
  page,
}) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  await calculate(page);
  const start = await viewDir(page);

  const box = (await page.getByTestId('ed-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('ed-dyn-warning')).toBeVisible();
  expect(await viewDir(page)).toEqual(start);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('ed-dyn-warning')).toBeHidden();
  expect((await dyn(page)).shown).toBe(true);

  // pan and zoom of the pattern are not moves
  const pat = (await page.getByTestId('ed-pattern').boundingBox())!;
  await page.mouse.move(pat.x + pat.width / 2, pat.y + pat.height / 2);
  await page.mouse.down();
  await page.mouse.move(pat.x + pat.width / 2 + 60, pat.y + pat.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.mouse.wheel(0, -200);
  await expect(page.getByTestId('ed-dyn-warning')).toBeHidden();
  expect((await dyn(page)).shown).toBe(true);

  // tilt mode: dragging the pattern would turn the crystal
  await page.getByTestId('ed-drag-tilt').click();
  await page.mouse.move(pat.x + pat.width / 2, pat.y + pat.height / 2);
  await page.mouse.down();
  await page.mouse.move(pat.x + pat.width / 2 + 80, pat.y + pat.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('ed-dyn-warning')).toBeVisible();
  expect(await viewDir(page)).toEqual(start);

  // after switching, the same drag rotates
  await page.getByTestId('ed-dyn-switch').click();
  await expect.poll(async () => (await dyn(page)).shown).toBe(false);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => viewDir(page)).not.toEqual(start);
});

test('a new zone axis typed while dynamical asks first and then goes there', async ({ page }) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  await calculate(page);
  for (let k = 0; k < 3; k++) await page.getByTestId(`ed-uvw-${k}`).fill(String([0, 0, 1][k]));
  await page.getByTestId('ed-uvw-go').click();
  await expect(page.getByTestId('ed-dyn-warning')).toBeVisible();
  await expect(page.getByTestId('ed-readout')).toContainText('[1 1 0]');
  await page.getByTestId('ed-dyn-switch').click();
  await expect(page.getByTestId('ed-readout')).toContainText('beam ∥ [0 0 1] · 0.00°');
  expect((await dyn(page)).shown).toBe(false);

  // the Kinematic button also switches back, without a question
  await calculate(page);
  await page.getByTestId('ed-dyn-off').click();
  expect((await dyn(page)).shown).toBe(false);
  await expect(page.getByTestId('ed-dyn-warning')).toBeHidden();
});
