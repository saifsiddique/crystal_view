import { expect, test, type Page } from '@playwright/test';

// The Electron Diffraction tab (M8): structure on the left, kinematic pattern on the right.
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

/** Open a tab of the diffraction sidebar (Parameters is open at first). */
const side = (page: Page, tab: 'params' | 'pattern' | 'kikuchi') =>
  page.getByTestId(`ed-side-tab-${tab}`).click();

const ed = (page: Page) => page.evaluate(() => window.__crystallensED.pattern()!);
const reading = (page: Page) => page.evaluate(() => window.__crystallensED.reading()!);

const angle = (a: number[], b: number[]) => {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return (Math.atan2(Math.hypot(...cross), dot) * 180) / Math.PI;
};

test('Structure Viewer and Electron Diffraction are tabs; switching keeps the 3D view', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles('tests/fixtures/cifs/NaCl.cif');
  await expect(page.getByTestId('hud')).toContainText('atoms');
  const structureTab = page.getByRole('tab', { name: 'Structure Viewer' });
  const edTab = page.getByRole('tab', { name: 'Electron Diffraction' });
  await expect(structureTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('ed-tab')).toHaveCount(0); // mounted on first use
  for (let k = 0; k < 3; k++) await page.getByTestId(`uvw-${k}`).fill(['1', '1', '0'][k]);
  await page.getByTestId('uvw-go').click();
  const before = await page.evaluate(() => window.__crystallens.viewState().direction);

  await edTab.click();
  await expect(edTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('viewer')).toBeHidden();
  await expect(page.getByTestId('ed-tab')).toBeVisible();
  // keyboard: left/right arrows move between the tabs
  await edTab.press('ArrowLeft');
  await expect(structureTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('viewer')).toBeVisible();
  await expect(page.getByTestId('ed-tab')).toBeHidden();
  const after = await page.evaluate(() => window.__crystallens.viewState().direction);
  expect(angle(before, after)).toBeLessThan(1e-6);
});

test('two square panels side by side; 300 kV by default with 120 and 60 kV presets', async ({
  page,
}) => {
  await openED(page, 'Si');
  const left = (await page.getByTestId('ed-canvas').boundingBox())!;
  const right = (await page.getByTestId('ed-pattern').boundingBox())!;
  expect(Math.abs(left.width - left.height)).toBeLessThan(2);
  expect(Math.abs(right.width - right.height)).toBeLessThan(2);
  expect(Math.abs(left.width - right.width)).toBeLessThan(2);
  expect(Math.abs(left.y - right.y)).toBeLessThan(2);
  expect(right.x).toBeGreaterThan(left.x + left.width);

  await expect(page.getByTestId('ed-preset-300')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('ed-voltage')).toHaveValue('300');
  await expect(page.getByTestId('ed-lambda')).toContainText('0.01969');
  expect((await ed(page)).lambda).toBeCloseTo(0.0196875, 6);
  await page.getByTestId('ed-preset-120').click();
  await expect(page.getByTestId('ed-lambda')).toContainText('0.03349');
  await page.getByTestId('ed-preset-60').click();
  await expect(page.getByTestId('ed-lambda')).toContainText('0.04866');
  await expect(page.getByTestId('ed-caption')).toContainText('60 kV');
  expect((await ed(page)).lambda).toBeCloseTo(0.0486606, 6);
  await page.getByTestId('ed-voltage').fill('200');
  await expect(page.getByTestId('ed-lambda')).toContainText('0.02508');
});

test('typing a zone axis turns the structure and the pattern: Si [110]', async ({ page }) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  const dir = await page.evaluate(() => window.__crystallensED.viewState().direction);
  expect(angle(dir, [1, 1, 0])).toBeLessThan(1e-4); // cubic: [110] is along (1, 1, 0)
  await expect(page.getByTestId('ed-caption')).toContainText('ZOLZ of [1 1 0]');
  const p = await ed(page);
  expect(p.zoneAxis).toEqual([1, 1, 0]);
  expect(p.spots.every((s) => s.zone === 0 && s.hkl[0] + s.hkl[1] === 0)).toBe(true);
  const best = p.spots.reduce((a, b) => (b.I > a.I ? b : a));
  expect(Math.abs(best.hkl[0]) + Math.abs(best.hkl[1]) + Math.abs(best.hkl[2])).toBe(3); // {111}
  expect(p.spots.find((s) => s.hkl.join() === '0,0,2')).toBeUndefined(); // forbidden, hidden
  await side(page, 'pattern');
  await page.getByTestId('ed-forbidden').check();
  await expect
    .poll(async () => (await ed(page)).spots.find((s) => s.hkl.join() === '0,0,2')?.forbidden)
    .toBe(true);
});

test('rotating the structure with the mouse updates the pattern on the fly', async ({ page }) => {
  await openED(page, 'Si');
  await zoneAxis(page, [0, 0, 1]);
  const before = await ed(page);
  const box = (await page.getByTestId('ed-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const counts: number[] = [];
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(box.x + box.width / 2 + 3 * i, box.y + box.height / 2 + 1.5 * i);
    await page.waitForTimeout(150);
    counts.push((await ed(page)).count);
  }
  // still dragging, and the pattern has already changed
  expect((await reading(page)).angleDeg).toBeGreaterThan(0.5);
  await page.mouse.up();
  const after = await ed(page);
  expect(after.count).not.toBe(before.count);
  // the Laue zones are still counted from [001], the nearest low-index axis
  expect(after.zoneAxis).toEqual([0, 0, 1]);
});

test('arrow keys tilt the crystal by the step and the intensities change', async ({ page }) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  const I = new Map((await ed(page)).spots.map((s) => [s.hkl.join(), s.I]));
  await page.getByTestId('ed-tilt-step').fill('0.3');
  await page.getByTestId('ed-canvas').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('ed-readout')).toContainText('0.30° (5.2 mrad) off');
  const after = (await ed(page)).spots;
  const changed = after.filter((s) => {
    const i0 = I.get(s.hkl.join());
    return i0 !== undefined && i0 > 1e-3 && Math.abs(s.I / i0 - 1) > 0.1;
  });
  expect(changed.length).toBeGreaterThan(4);
});

test('From Structure Viewer copies the orientation of the first tab', async ({ page }) => {
  await openED(page, 'graphite');
  await page.getByTestId('tab-structure').click();
  await page.getByRole('button', { name: 'a', exact: true }).click();
  await page.getByTestId('tab-ed').click();
  await page.getByTestId('ed-from-viewer').click();
  await expect(page.getByTestId('ed-readout')).toContainText('beam ∥ [1 0 0] · 0.00°');
});

test('the pattern zooms with the wheel and the buttons, and pans by dragging', async ({ page }) => {
  await openED(page, 'NaCl');
  const scale = () => page.evaluate(() => window.__crystallensED.pxPerInvA());
  const s0 = await scale();
  const box = (await page.getByTestId('ed-pattern').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(scale).toBeGreaterThan(s0 * 1.5);
  await page.getByTestId('ed-zoom-fit').click();
  await expect.poll(scale).toBeCloseTo(s0, 6);
  await page.getByTestId('ed-zoom-out').click();
  await expect.poll(scale).toBeLessThan(s0);
  // zooming out computes further: more spots (without the excitation error, which would make the
  // far ones too faint to keep)
  await page.getByTestId('ed-profile').selectOption('none');
  const n0 = (await ed(page)).count;
  for (let i = 0; i < 4; i++) await page.getByTestId('ed-zoom-out').click();
  await expect.poll(async () => (await ed(page)).count).toBeGreaterThan(n0);

  await page.getByTestId('ed-zoom-fit').click();
  const central = page.getByTestId('ed-central');
  const c0 = (await central.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 130, { steps: 5 });
  await page.mouse.up();
  const c1 = (await central.boundingBox())!;
  expect(c1.x - c0.x).toBeCloseTo(60, -1);
  expect(c1.y - c0.y).toBeCloseTo(30, -1);
});

test('higher-order Laue zones can be switched on', async ({ page }) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 1]);
  expect(new Set((await ed(page)).spots.map((s) => s.zone))).toEqual(new Set([0]));
  await page.getByTestId('ed-thickness').fill('1000');
  await side(page, 'pattern');
  await page.getByTestId('ed-laue').selectOption('1');
  for (let i = 0; i < 6; i++) await page.getByTestId('ed-zoom-out').click();
  await expect(page.getByTestId('ed-caption')).toContainText('Laue zones |n| ≤ 1 of [1 1 1]');
  // only the layer the Ewald sphere bends towards is excited (zone -1 along +[111])
  await expect
    .poll(async () => [...new Set((await ed(page)).spots.map((s) => s.zone))].sort())
    .toEqual([-1, 0]);
  // HOLZ reflections are weak: a longer exposure draws more of them
  const drawn = () => page.evaluate(() => window.__crystallensED.drawn());
  const d0 = await drawn();
  await page.getByTestId('ed-exposure').fill('3');
  await expect.poll(drawn).toBeGreaterThan(d0 + 20);
});

test('hovering a spot shows its data; Measure gives |g| and the angle of two spots', async ({
  page,
}) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 0]);
  const at = (key: string) => page.evaluate((k) => window.__crystallensED.spotClient(k), key);
  const p111 = (await at('1 -1 1'))!;
  await page.mouse.move(p111.x, p111.y);
  const tip = page.getByTestId('ed-tooltip');
  await expect(tip).toContainText('d 3.13');
  await expect(tip).toContainText('Laue zone 0');

  await page.getByTestId('ed-measure').check();
  await page.mouse.click(p111.x, p111.y);
  const p220 = (await at('2 -2 0'))!;
  await page.mouse.click(p220.x, p220.y);
  const m = page.getByTestId('ed-measurement');
  // angle between (1 -1 1) and (2 -2 0) in a cubic cell: acos(2/sqrt(6)) = 35.26 degrees
  await expect(m).toContainText('angle 35.26°');
  await expect(m).toContainText(`g₂/g₁ = ${(Math.sqrt(8) / Math.sqrt(3)).toFixed(4)}`);
});

test('the range of the structure on the left: presets and the boxes of cells along a, b and c', async ({
  page,
}) => {
  await openED(page, 'NaCl');
  const atoms = page.locator('[data-testid="ed-tab"] .hud').first();
  await expect(atoms).toContainText('27 atoms');
  await expect(page.getByTestId('ed-range-1')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('ed-range-2').click();
  await expect(atoms).toContainText('125 atoms');
  for (let k = 0; k < 3; k++) await expect(page.getByTestId(`ed-cells-${k}`)).toHaveValue('2');
  await expect(page.getByTestId('ed-range-2')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('ed-range-3').click();
  await expect(atoms).toContainText('343 atoms');
  // 1 x 1 x 3 cells, typed like the presets
  await page.getByTestId('ed-cells-0').fill('1');
  await page.getByTestId('ed-cells-0').press('Enter');
  await page.getByTestId('ed-cells-1').fill('1');
  await page.getByTestId('ed-cells-1').press('Enter');
  await expect(atoms).toContainText('63 atoms');
  await expect(page.getByTestId('ed-range-3')).toHaveAttribute('aria-pressed', 'false');
  // a value that is not a whole number of cells is refused and the box shows the range again
  await page.getByTestId('ed-cells-2').fill('2.5');
  await page.getByTestId('ed-cells-2').press('Enter');
  await expect(page.getByTestId('ed-cells-2')).toHaveValue('3');
  await expect(atoms).toContainText('63 atoms');
});
