import { expect, test, type Page } from '@playwright/test';

// The Powder XRD tab (M9), the Debye-Waller box and the Kikuchi band count of the ED tab.
test.use({ viewport: { width: 1400, height: 1300 } });

async function load(page: Page, name: string) {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(`tests/fixtures/cifs/${name}.cif`);
  await expect(page.getByTestId('hud')).toContainText('atoms');
}

async function openXRD(page: Page, name: string) {
  await load(page, name);
  await page.getByTestId('tab-xrd').click();
  await expect(page.getByTestId('xrd-hud')).toContainText('peaks');
}

const peaks = (page: Page) => page.evaluate(() => window.__crystallensXRD.peaks());
const view = (page: Page) => page.evaluate(() => window.__crystallensXRD.view());
const rowsText = (page: Page) => page.getByTestId('peak-row').allInnerTexts();

test('a third tab holds the powder pattern; the Structure Viewer tab no longer has d-spacings or scattering factors', async ({
  page,
}) => {
  await load(page, 'Si');
  await expect(page.getByRole('tablist', { name: 'Views' }).getByRole('tab')).toHaveText([
    'Structure Viewer',
    'Electron Diffraction',
    'Powder XRD',
  ]);
  await expect(page.getByText('Largest d-spacings')).toHaveCount(0);
  await expect(page.getByTestId('scattering')).toHaveCount(0);
  await expect(page.getByTestId('xrd-tab')).toHaveCount(0); // mounted on first use
  await page.getByTestId('tab-xrd').click();
  await expect(page.getByTestId('xrd-tab')).toBeVisible();
  await expect(page.getByTestId('viewer')).toBeHidden();
  await expect(page.getByTestId('scattering')).toContainText('Iron'); // the lookup moved here
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('xrd-tab')).toBeHidden();
});

test('Si with Cu Kα₁: the six allowed peaks, with the right multiplicities and positions', async ({
  page,
}) => {
  await openXRD(page, 'Si');
  await expect(page.getByTestId('xrd-wavelength')).toContainText('1.54059');
  const p = await peaks(page);
  expect(p.map((x) => x.hkl.join(''))).toEqual(['111', '220', '311', '400', '331', '422']);
  expect(p.map((x) => x.m)).toEqual([8, 12, 24, 6, 24, 24]);
  expect(p[0].twoTheta).toBeCloseTo(28.443, 2);
  expect(p[0].d).toBeCloseTo(3.1354, 3);
  expect(p[0].I).toBeCloseTo(100, 6);
  // the table shows them
  const rows = await rowsText(page);
  expect(rows).toHaveLength(6);
  expect(rows[0].replace(/\s+/g, ' ')).toMatch(/^1 1 1 8 3\.135\d 28\.44\d/);
  await expect(page.getByTestId('pxrd-tick')).toHaveCount(6);
  await expect(page.getByTestId('pxrd-curve')).toBeVisible();
});

test('radiation: another anode moves the peaks, Kα₂ adds the second line, neutrons use b, custom λ is free', async ({
  page,
}) => {
  await openXRD(page, 'Si');
  const cu = (await peaks(page))[0].twoTheta;
  await page.getByTestId('xrd-radiation').selectOption('MoKa');
  await expect(page.getByTestId('xrd-wavelength')).toContainText('0.70932');
  await expect.poll(async () => (await peaks(page))[0].twoTheta).toBeLessThan(cu / 2 + 0.5);
  expect((await peaks(page))[0].twoTheta).toBeCloseTo(12.99, 1);

  await page.getByTestId('xrd-radiation').selectOption('CuKa');
  await expect(page.getByTestId('xrd-ka2')).toBeVisible();
  await page.getByTestId('xrd-ka2').check();
  await expect(page.getByText('Cu Kα₁ + Kα₂')).toBeVisible();
  await expect(page.getByTestId('xrd-ratio')).toBeEnabled();

  await page.getByTestId('xrd-radiation').selectOption('custom');
  await expect(page.getByTestId('xrd-ka2')).toHaveCount(0);
  await page.getByTestId('xrd-lambda').fill('1.0');
  await expect(page.getByTestId('xrd-wavelength')).toContainText('1.00000');
  await expect.poll(async () => (await peaks(page))[0].twoTheta).toBeCloseTo(18.4, 0);

  await page.getByTestId('xrd-radiation').selectOption('neutron');
  await expect(page.getByTestId('xrd-ionic')).toHaveCount(0); // X-ray only
  await expect(page.getByTestId('xrd-mono')).toHaveCount(0); // X-ray only
  await expect(page.getByText('Neutrons', { exact: true })).toBeVisible();
  await expect(page.getByTestId('peak-table')).toContainText('fm');
  // Si neutron: b is the same for every atom, so (111) is still forbidden-free and (200) absent
  expect((await peaks(page)).some((x) => x.hkl.join() === '2,0,0')).toBe(false);
});

test('the peak table sorts on every column and a row selects its peak on the plot', async ({
  page,
}) => {
  await openXRD(page, 'rutile');
  const first = async () => (await rowsText(page))[0].split('\t')[0].trim();
  expect(await first()).toBe('1 1 0'); // by 2θ ascending: the largest d
  const all = await peaks(page);
  const smallestD = all.reduce((a, b) => (b.d < a.d ? b : a));
  const weakest = all.reduce((a, b) => (b.I < a.I ? b : a));
  // the first click on a numeric column puts the largest value first, the second the smallest
  await page.getByTestId('sort-d').click();
  expect(await first()).toBe('1 1 0');
  await page.getByTestId('sort-d').click();
  expect(await first()).toBe(smallestD.hkl.join(' '));
  await page.getByTestId('sort-I').click();
  expect(await first()).toBe('1 1 0');
  await page.getByTestId('sort-I').click();
  expect(await first()).toBe(weakest.hkl.join(' '));
  await page.getByTestId('sort-m').click();
  const ms = (await rowsText(page)).map((r) => Number(r.split('	')[1]));
  expect(ms).toEqual([...ms].sort((a, b) => b - a));
  await page.getByTestId('sort-hkl').click();
  expect(await first()).toBe('0 0 2'); // (hkl) ascending: h first, so 002

  await expect(page.getByTestId('pxrd-selected')).toHaveCount(0);
  await page.getByTestId('peak-row').nth(2).click();
  await expect(page.getByTestId('pxrd-selected')).toHaveCount(1); // a vertical line: no area
  await expect(page.getByTestId('peak-row').nth(2)).toHaveClass(/sel/);
  await page.getByTestId('peak-row').nth(2).click();
  await expect(page.getByTestId('pxrd-selected')).toHaveCount(0);
});

test('hovering a tick shows the peak and clicking it selects its table row', async ({ page }) => {
  await openXRD(page, 'Si');
  const at = await page.evaluate(() => window.__crystallensXRD.peakClient('2 2 0'));
  expect(at).not.toBeNull();
  await page.mouse.move(at!.x, at!.y);
  const tip = page.getByTestId('pxrd-tooltip');
  await expect(tip).toContainText('(2 2 0)');
  await expect(tip).toContainText('d 1.920');
  await expect(tip).toContainText('m 12');
  await page.mouse.click(at!.x, at!.y);
  await expect(page.locator('[data-testid="peak-row"].sel')).toContainText('2 2 0');
});

test('the plot zooms with the wheel, pans by dragging, fits again, and shows 2θ, d or Q', async ({
  page,
}) => {
  await openXRD(page, 'Si');
  expect(await view(page)).toEqual({ u0: 5, u1: 90 });
  const box = (await page.getByTestId('pxrd-plot').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 150);
  await page.mouse.wheel(0, -500);
  await expect.poll(async () => (await view(page)).u1 - (await view(page)).u0).toBeLessThan(60);
  const v = await view(page);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + 150, { steps: 5 });
  await page.mouse.up();
  const w = await view(page);
  expect(w.u0).toBeLessThan(v.u0); // dragged right: shows lower angles
  expect(w.u1 - w.u0).toBeCloseTo(v.u1 - v.u0, 6);
  await page.getByTestId('xrd-fit').click();
  expect(await view(page)).toEqual({ u0: 5, u1: 90 });
  await page.getByTestId('xrd-zoom-in').click();
  expect((await view(page)).u1 - (await view(page)).u0).toBeLessThan(85);

  await page.getByTestId('xrd-axis').selectOption('Q');
  await expect.poll(async () => (await view(page)).u0).toBeCloseTo(0.3558, 3); // Q = 4π sin(2.5°)/λ at 5° with Cu Kα₁
  await expect(page.getByTestId('pxrd-plot')).toContainText('Q = 2π/d');
  await page.getByTestId('xrd-axis').selectOption('d');
  await expect(page.getByTestId('pxrd-plot')).toContainText('d (Å)');
  const dv = await view(page);
  expect(dv.u0).toBeLessThan(0); // −d: large d on the left
  expect(dv.u1).toBeCloseTo(-1.0, 0); // 2θ = 90° is d = 1.09 Å
  // starts just before the first peak (d = 3.1 Å), not at 17.7 Å (5°)
  expect(-dv.u0).toBeLessThan(5);
});

test('hkl labels can be switched off; a lower limit hides weak peaks', async ({ page }) => {
  await openXRD(page, 'rutile');
  await expect.poll(() => page.evaluate(() => window.__crystallensXRD.labels())).toBeGreaterThan(5);
  await page.getByTestId('xrd-labels').uncheck();
  await expect.poll(() => page.evaluate(() => window.__crystallensXRD.labels())).toBe(0);
  const n = (await peaks(page)).length;
  await page.getByTestId('xrd-minpct').fill('10');
  await expect.poll(async () => (await peaks(page)).length).toBeLessThan(n);
  expect((await peaks(page)).every((p) => p.I >= 10 - 1e-9)).toBe(true);
});

test('peak shape: wider peaks lose height, Scherrer size broadens them, the range sets the curve', async ({
  page,
}) => {
  await openXRD(page, 'Si');
  const info = () => page.evaluate(() => window.__crystallensXRD.profile()!);
  const a = await info();
  expect(a.first).toBeCloseTo(5, 9);
  expect(a.last).toBeCloseTo(90, 2);
  expect(a.max).toBeCloseTo(100, 6);
  await page.getByTestId('xrd-max').fill('60');
  await expect.poll(async () => (await info()).last).toBeCloseTo(60, 2);
  expect((await peaks(page)).length).toBe(3); // 111, 220, 311
  await page.getByTestId('xrd-min').fill('20');
  await expect.poll(async () => (await info()).first).toBeCloseTo(20, 9);
  // the plot has followed the range
  await expect.poll(async () => (await view(page)).u0).toBeCloseTo(20, 6);
  await page.getByTestId('xrd-size').fill('10');
  await page.getByTestId('xrd-strain').fill('0.2');
  await expect(page.getByTestId('pxrd-curve')).toBeVisible();
});

test('Debye–Waller factor: the box starts at the CIF value, a typed value overrides it, "use CIF" restores it', async ({
  page,
}) => {
  await openXRD(page, 'rutile');
  const box = page.getByTestId('xrd-dw-b');
  const cifB = await page.evaluate(() => window.__crystallensXRD.cifB());
  expect(cifB).toBeGreaterThan(0.3);
  expect(Number(await box.inputValue())).toBeCloseTo(cifB, 3);
  await expect(page.getByTestId('xrd-dw-note')).toHaveText('from the CIF');
  await expect(page.getByTestId('xrd-dw-cif')).toHaveCount(0);
  const last = async () => (await peaks(page)).at(-1)!;
  const F0 = (await last()).F;
  const hkl = (await last()).hkl.join(' ');

  await box.fill('4');
  await expect(page.getByTestId('xrd-dw-cif')).toBeVisible();
  await expect
    .poll(async () => (await peaks(page)).find((p) => p.hkl.join(' ') === hkl)!.F)
    .toBeLessThan(F0 * 0.7);
  await page.getByTestId('xrd-dw-cif').click();
  await expect(page.getByTestId('xrd-dw-note')).toHaveText('from the CIF');
  expect(Number(await box.inputValue())).toBeCloseTo(cifB, 3);
  await expect
    .poll(async () => (await peaks(page)).find((p) => p.hkl.join(' ') === hkl)!.F)
    .toBeCloseTo(F0, 9);

  // off: no damping at all, and the box is disabled
  await page.getByTestId('xrd-dw').uncheck();
  await expect(box).toBeDisabled();
  await expect
    .poll(async () => (await peaks(page)).find((p) => p.hkl.join(' ') === hkl)!.F)
    .toBeGreaterThan(F0);
});

test('a CIF without displacement parameters says so, and its box starts at 0', async ({ page }) => {
  await openXRD(page, 'NaCl');
  await expect(page.getByTestId('xrd-dw-note')).toHaveText('CIF has none');
  expect(Number(await page.getByTestId('xrd-dw-b').inputValue())).toBe(0);
});

test('preferred orientation (March-Dollase) reweights the peaks; monochromator and zero shift act', async ({
  page,
}) => {
  await openXRD(page, 'graphite');
  const rel = async (key: string) => (await peaks(page)).find((p) => p.hkl.join(' ') === key)!.I;
  const base002 = await rel('0 0 2');
  await page.getByTestId('xrd-po').check();
  await page.getByTestId('xrd-po-r').fill('0.6');
  // plates stacked along c: 002 gains. The strongest peak is renormalised to 100, so the others fall.
  await expect.poll(async () => (await rel('0 0 2')) / 100).toBeGreaterThan(base002 / 100 - 1e-9);
  const ratio = async () => (await rel('1 0 0')) / (await rel('0 0 2'));
  const withPo = await ratio();
  await page.getByTestId('xrd-po-r').fill('1');
  await expect.poll(ratio).toBeGreaterThan(withPo * 2); // back to a random powder: 100 relatively stronger
  await page.getByTestId('xrd-po-hkl').fill('1 0 0');
  await page.getByTestId('xrd-po-r').fill('0.6');
  await expect.poll(ratio).not.toBeCloseTo(withPo, 3);

  const p0 = (await peaks(page))[0].twoTheta;
  await page.getByTestId('xrd-zero').fill('0.1');
  await expect.poll(async () => (await peaks(page))[0].twoTheta).toBeCloseTo(p0 + 0.1, 6);
  const iBefore = (await peaks(page)).map((p) => p.I);
  await page.getByTestId('xrd-mono').fill('26.6');
  await expect.poll(async () => (await peaks(page)).map((p) => p.I)).not.toEqual(iBefore);
});

test('the peak table exports as CSV', async ({ page }) => {
  await openXRD(page, 'Si');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('xrd-csv').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/_peaks\.csv$/);
  const text = (
    await (await import('node:fs/promises')).readFile((await download.path())!, 'utf8')
  ).trim();
  const lines = text.split('\n');
  expect(lines[0]).toBe('h,k,l,multiplicity,d_angstrom,two_theta_deg,F,I_rel');
  expect(lines).toHaveLength(7);
  expect(lines[1]).toMatch(/^1,1,1,8,3\.135\d+,28\.44\d+,/);
});

test('bad input shows a message instead of a pattern: an empty 2θ range', async ({ page }) => {
  await openXRD(page, 'Si');
  await page.getByTestId('xrd-max').fill('3');
  await expect(page.getByRole('alert')).toContainText('range is empty');
  await page.getByTestId('xrd-max').fill('90');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('the lookup gives the scattering factors of Fe3+ at 2θ = 40° with Cu Kα₁', async ({
  page,
}) => {
  await openXRD(page, 'Si');
  await expect(page.getByTestId('scattering')).toContainText('Iron (Z = 26)');
  await expect(page.getByTestId('scattering')).toContainText('f X-ray');
  await page.getByLabel('species').fill('O2-');
  await expect(page.getByTestId('scattering')).toContainText('Oxygen');
});

test('recalculates in under 200 ms for albite and starts empty without a CIF', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tab-xrd').click();
  await expect(page.getByText('Open a CIF above to calculate its powder pattern.')).toBeVisible();
  await page.getByTestId('cif-input').setInputFiles('tests/fixtures/cifs/albite.cif');
  await expect(page.getByTestId('xrd-hud')).toContainText('peaks');
  await page.getByTestId('xrd-eta').fill('0.3');
  await page.getByTestId('xrd-dw-b').fill('1');
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__crystallensXRD.ms().peaks + window.__crystallensXRD.ms().profile,
      ),
    )
    .toBeLessThan(200);
});

// ---- the two changes to the Electron Diffraction tab -----------------------------------------------

test('ED: "Debye–Waller factor" in full, with a box that starts at the CIF value and can be overridden', async ({
  page,
}) => {
  await load(page, 'rutile');
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-hud')).toContainText('spots');
  await expect(page.getByText('Debye–Waller factor')).toBeVisible();
  const box = page.getByTestId('ed-dw-b');
  const shown = Number(await box.inputValue());
  expect(shown).toBeGreaterThan(0.3);
  await expect(page.getByTestId('ed-dw-note')).toHaveText('from the CIF');

  const spots = () => page.evaluate(() => window.__crystallensED.pattern()!.spots);
  // an outer spot, followed through the change by its indices
  const before = (await spots()).filter((s) => Math.hypot(s.x, s.y) > 1.2 && s.I > 1e-4);
  expect(before.length).toBeGreaterThan(0);
  const key = before[0].hkl.join();
  const faint = before[0].I;
  const far = async () => ({ I: (await spots()).find((s) => s.hkl.join() === key)?.I ?? 0 });
  await box.fill('12');
  await expect(page.getByTestId('ed-dw-cif')).toBeVisible();
  // the strongest outer spots are damped by the larger B
  await expect.poll(async () => (await far()).I).toBeLessThan(faint);
  await page.getByTestId('ed-dw-cif').click();
  await expect(page.getByTestId('ed-dw-note')).toHaveText('from the CIF');
  expect(Number(await box.inputValue())).toBeCloseTo(shown, 6);
  await page.getByTestId('ed-dw').uncheck();
  await expect(box).toBeDisabled();
});

test('ED: the number of Kikuchi bands is a setting (default 20)', async ({ page }) => {
  await load(page, 'Si');
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-hud')).toContainText('spots');
  const bands = () => page.evaluate(() => window.__crystallensED.overlay().bands);
  await page.getByTestId('ed-side-tab-kikuchi').click();
  await page.getByTestId('ed-kikuchi').check();
  await expect.poll(bands).toBe(20);
  // (a band whose lines are both outside the panel is not drawn)
  const drawn = page.getByTestId('ed-kikuchi-band');
  await expect.poll(() => drawn.count()).toBeGreaterThan(10);
  expect(await drawn.count()).toBeLessThanOrEqual(20);
  await page.getByTestId('ed-kikuchi-count').fill('6');
  await expect.poll(bands).toBe(6);
  await expect.poll(() => drawn.count()).toBeGreaterThan(0);
  expect(await drawn.count()).toBeLessThanOrEqual(6);
  await page.getByTestId('ed-kikuchi-count').fill('60');
  await expect.poll(bands).toBe(60);
});
