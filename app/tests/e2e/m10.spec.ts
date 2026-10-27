import { expect, test, type Page } from '@playwright/test';

// Kikuchi bands, HOLZ rings and the CBED disc with HOLZ lines (M10), white viewers, new name.
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

const overlay = (page: Page) => page.evaluate(() => window.__crystallensED.overlay());

/** Open a tab of the diffraction sidebar (Parameters is open at first). */
const side = (page: Page, tab: 'params' | 'pattern' | 'kikuchi') =>
  page.getByTestId(`ed-side-tab-${tab}`).click();

test('the product is called Crystal Viewer Lite, with Lite in superscript', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Crystal Viewer Lite');
  const h1 = page.getByRole('heading', { name: 'Crystal Viewer Lite', level: 1 });
  await expect(h1).toBeVisible();
  await expect(h1.locator('sup')).toHaveText('Lite');
  const sup = (await h1.locator('sup').boundingBox())!;
  const box = (await h1.boundingBox())!;
  expect(sup.y).toBeLessThan(box.y + box.height / 2); // raised
  expect(await h1.locator('sup').evaluate((e) => getComputedStyle(e).fontSize)).not.toBe(
    await h1.evaluate((e) => getComputedStyle(e).fontSize),
  );
});

test('every viewer starts on a white background (255, 255, 255)', async ({ page }) => {
  await openED(page, 'Si');
  await expect(page.getByTestId('tab-structure')).toBeVisible();
  const white = 'rgb(255, 255, 255)';
  await expect(page.locator('[data-testid="ed-tab"] .stage')).toHaveCSS('background-color', white);
  await expect(page.getByTestId('ed-pattern').locator('rect').first()).toHaveAttribute(
    'fill',
    '#ffffff',
  );
  await page.getByTestId('tab-structure').click();
  await expect(page.locator('[data-testid="viewer"] .stage')).toHaveCSS('background-color', white);
  // the spots are dark on white
  await page.getByTestId('tab-ed').click();
  const spot = page.getByTestId('ed-pattern').locator('circle').first();
  expect(await spot.getAttribute('fill')).not.toBe('#ffffff');
});

test('Kikuchi bands: pairs of lines for the strong planes, drawn only when switched on', async ({
  page,
}) => {
  await openED(page, 'Si');
  expect((await overlay(page)).bands).toBe(0);
  await expect(page.getByTestId('ed-kikuchi-band')).toHaveCount(0);
  await side(page, 'kikuchi');
  await page.getByTestId('ed-kikuchi').check();
  await expect.poll(async () => (await overlay(page)).bands).toBe(20); // the default count
  await expect(page.getByTestId('ed-kikuchi-band').first()).toBeVisible();
  // (the cost per frame is checked in kikuchi.test.ts and in the rotation test below)
  await page.getByTestId('ed-kikuchi').uncheck();
  await expect(page.getByTestId('ed-kikuchi-band')).toHaveCount(0);
});

test('HOLZ rings: Si [111] has the first-order ring at 3.28 1/Å, and [110] skips the forbidden first order', async ({
  page,
}) => {
  await openED(page, 'Si');
  await side(page, 'kikuchi');
  await page.getByTestId('ed-rings').check();
  await zoneAxis(page, [1, 1, 1]);
  await expect.poll(async () => (await overlay(page)).rings.length).toBe(3);
  const rings = (await overlay(page)).rings;
  expect(rings[0].radius).toBeCloseTo(3.2846, 3);
  expect(rings.map((r) => r.allowed)).toEqual([true, false, true]);
  await expect(page.getByTestId('ed-ring')).toHaveCount(2);

  await zoneAxis(page, [1, 1, 0]);
  await expect
    .poll(async () => (await overlay(page)).rings.map((r) => r.allowed))
    .toEqual([false, true, false]);
  await expect(page.getByTestId('ed-ring')).toHaveCount(1);
});

test('CBED disc: radius α/λ, HOLZ lines inside it, more lines for a larger α', async ({ page }) => {
  await openED(page, 'Si');
  await zoneAxis(page, [1, 1, 1]);
  await side(page, 'kikuchi');
  await page.getByTestId('ed-cbed').check();
  await expect(page.getByTestId('ed-disc')).toBeVisible();
  const o = await overlay(page);
  expect(o.disc).toBeCloseTo(0.015 / 0.0196875, 4); // 15 mrad at 300 kV
  expect(o.holz).toBeGreaterThan(3);
  await expect(page.getByTestId('ed-holz-line')).toHaveCount(o.holz);
  await page.getByTestId('ed-alpha').fill('30');
  await expect.poll(async () => (await overlay(page)).disc).toBeCloseTo(0.03 / 0.0196875, 4);
  expect((await overlay(page)).holz).toBeGreaterThan(o.holz);
  // a lower voltage has a larger λ and so a smaller disc for the same angle
  await side(page, 'params');
  await page.getByTestId('ed-preset-60').click();
  await expect.poll(async () => (await overlay(page)).disc).toBeCloseTo(0.03 / 0.0486606, 4);
});

test('strain moves the HOLZ ring: +1% on c along [001] shrinks the first-order ring', async ({
  page,
}) => {
  await openED(page, 'Si');
  await side(page, 'kikuchi');
  await page.getByTestId('ed-rings').check();
  await expect.poll(async () => (await overlay(page)).rings.length).toBe(3);
  const r0 = (await overlay(page)).rings[0].radius;
  await page.getByTestId('ed-strain-2').fill('1');
  await expect.poll(async () => (await overlay(page)).rings[0].radius).toBeLessThan(r0);
  // H = 1/(c (1 + ε)): the radius² = 2kH − H² follows
  const k = 1 / 0.0196875;
  const H = 1 / (5.4309 * 1.01);
  const r1 = (await overlay(page)).rings[0].radius;
  expect(r1).toBeCloseTo(Math.sqrt(2 * k * H - H * H), 1);
});

test('Tilt mode: dragging the pattern tilts the crystal and the rings follow the pointer', async ({
  page,
}) => {
  await openED(page, 'Si');
  await side(page, 'kikuchi');
  await page.getByTestId('ed-rings').check();
  await expect.poll(async () => (await overlay(page)).rings.length).toBe(3);
  await page.getByTestId('ed-drag-tilt').click();
  await expect(page.getByTestId('ed-drag-tilt')).toHaveAttribute('aria-pressed', 'true');
  const scale = await page.evaluate(() => window.__crystallensED.pxPerInvA());
  const box = (await page.getByTestId('ed-pattern').boundingBox())!;
  const x0 = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  const dxPx = 40;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + dxPx / 2, y0, { steps: 4 });
  await page.mouse.move(x0 + dxPx, y0, { steps: 4 });
  await page.mouse.up();
  const dx = dxPx / scale; // 1/Å
  await expect.poll(async () => (await overlay(page)).rings[0].cx).toBeGreaterThan(0.9 * dx);
  const ring = (await overlay(page)).rings[0];
  expect(ring.cx / dx).toBeLessThan(1.1); // the pattern moved as far as the pointer
  expect(Math.abs(ring.cy)).toBeLessThan(0.05 * dx);
  // the crystal is tilted by dx / k radians, and the zone-axis readout says so
  const k = 1 / 0.0196875;
  const deg = (Math.atan(dx / k) * 180) / Math.PI;
  await expect(page.getByTestId('ed-readout')).toContainText(`${deg.toFixed(2)}°`);
  // the view did not pan
  const centre = (await page.getByTestId('ed-central').boundingBox())!;
  expect(Math.abs(centre.x + centre.width / 2 - x0)).toBeLessThan(2);
  // Pan mode moves the view instead and leaves the crystal alone
  await page.getByTestId('ed-drag-pan').click();
  const before = (await overlay(page)).rings[0].cx;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 50, y0 + 20, { steps: 4 });
  await page.mouse.up();
  expect((await overlay(page)).rings[0].cx).toBeCloseTo(before, 9);
  const moved = (await page.getByTestId('ed-central').boundingBox())!;
  expect(moved.x - centre.x).toBeCloseTo(50, -1);
});

test('the overlays follow rotation of the left structure and stay under 50 ms', async ({
  page,
}) => {
  await openED(page, 'Si');
  await side(page, 'kikuchi');
  await page.getByTestId('ed-kikuchi').check();
  await page.getByTestId('ed-rings').check();
  await page.getByTestId('ed-cbed').check();
  await expect.poll(async () => (await overlay(page)).holz).toBeGreaterThan(0);
  const before = await overlay(page);
  const box = (await page.getByTestId('ed-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const times: number[] = [];
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(box.x + box.width / 2 + 3 * i, box.y + box.height / 2 + 2 * i);
    await page.waitForTimeout(60);
    times.push((await overlay(page)).ms);
  }
  await page.mouse.up();
  // typical frame (the machine is busy: 20 browsers draw at once)
  times.sort((x, y) => x - y);
  expect(times[times.length >> 1]).toBeLessThan(50);
  const after = await overlay(page);
  expect(Math.hypot(after.rings[0].cx, after.rings[0].cy)).toBeGreaterThan(0.1);
  expect(after.rings[0].cx).not.toBe(before.rings[0].cx);
});
