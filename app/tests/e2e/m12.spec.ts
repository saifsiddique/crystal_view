import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Export (M12): the legend, the layout shared by the three tabs (panel headers, sidebars), the image
// menus of the view panels (PNG with DPI, SVG, clipboard), the structure-file menu (CIF, XYZ,
// XYZ (computem)) and the CSV buttons.
test.use({ viewport: { width: 1400, height: 1100 } });

async function open(page: Page, name: string) {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(`tests/fixtures/cifs/${name}.cif`);
  await expect(page.getByTestId('hud')).toContainText('atoms');
}

async function openED(page: Page, name: string) {
  await open(page, name);
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-hud')).toContainText('spots');
}

async function openXRD(page: Page, name: string) {
  await open(page, name);
  await page.getByTestId('tab-xrd').click();
  await expect(page.getByTestId('xrd-hud')).toContainText('peaks');
}

/** Click a Save button of an open menu and return the downloaded file's text or bytes. */
async function save(page: Page, testid: string): Promise<{ name: string; bytes: Buffer }> {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testid).click()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(path) };
}

const text = (b: Buffer) => b.toString('utf8');

/** Width, height and DPI from the PNG header and its pHYs chunk. */
function pngHeader(b: Buffer) {
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const at = b.indexOf('pHYs');
  return {
    width: b.readUInt32BE(16),
    height: b.readUInt32BE(20),
    dpi: at < 0 ? null : ((b.readUInt32BE(at + 4) * 0.0254) as number),
  };
}

/** Decode a PNG in the page: its corner pixel and how many pixels differ from it. */
async function pngPixels(page: Page, b: Buffer) {
  return page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
    const corner = [d[0], d[1], d[2], d[3]];
    let inked = 0;
    for (let i = 0; i < d.length; i += 4)
      if (
        d[i] !== corner[0] ||
        d[i + 1] !== corner[1] ||
        d[i + 2] !== corner[2] ||
        d[i + 3] !== corner[3]
      )
        inked++;
    return { corner, inked, w: bmp.width, h: bmp.height };
  }, b.toString('base64'));
}

/** Parse SVG text in the page: is it well-formed, and how many elements of a selector? */
async function svgFacts(page: Page, svg: string, selectors: string[]) {
  return page.evaluate(
    ({ svg, selectors }) => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      const error = doc.querySelector('parsererror');
      return {
        error: error ? error.textContent : null,
        root: doc.documentElement.tagName,
        counts: selectors.map((s) => doc.querySelectorAll(s).length),
      };
    },
    { svg, selectors },
  );
}

/** Open a tab of the diffraction sidebar (Parameters is open at first). */
const side = (page: Page, tab: 'params' | 'pattern' | 'kikuchi') =>
  page.getByTestId(`ed-side-tab-${tab}`).click();

/** Click a button that downloads a file and return the file's name and text. */
async function download(page: Page, testid: string) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId(testid).click()]);
  return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') };
}

async function openMenu(page: Page, prefix: string) {
  await page.getByTestId(`${prefix}-button`).click();
  await expect(page.getByTestId(`${prefix}-panel`)).toBeVisible();
}

// ---- the legend ---------------------------------------------------------------------------------

test('the Structure Viewer has a legend of coloured balls with the atom names, bottom right and static', async ({
  page,
}) => {
  await open(page, 'rutile');
  const legend = page.getByTestId('legend');
  await expect(legend).toBeVisible();
  const items = page.getByTestId('legend-item');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveText('Ti');
  await expect(items.nth(1)).toHaveText('O');
  const hook = await page.evaluate(() => window.__crystallens.legend());
  expect(hook.map((e) => e.label)).toEqual(['Ti', 'O']);
  expect(hook[0].color).toMatch(/^#[0-9a-f]{6}$/);
  // the ball is drawn in the atom's colour (the last stop of its gradient mixes towards it)
  const ball = items.first().locator('.ball');
  expect(await ball.evaluate((e) => e.style.getPropertyValue('--c'))).toBe(hook[0].color);
  // big enough to read: balls of about 18 px and text of about 15 px
  expect((await ball.boundingBox())!.width).toBeGreaterThanOrEqual(16);
  expect(
    parseFloat(await items.first().evaluate((e) => getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(14);

  const stage = (await page.locator('[data-testid="viewer"] .stage').boundingBox())!;
  const at = async () => (await legend.boundingBox())!;
  const before = await at();
  expect(before.x + before.width).toBeGreaterThan(stage.x + stage.width - 40); // right
  expect(before.y + before.height).toBeGreaterThan(stage.y + stage.height - 60); // bottom
  // it does not turn with the crystal
  await page.locator('[data-testid="viewer"] .stage').focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  const after = await at();
  expect([after.x, after.y]).toEqual([before.x, before.y]);
});

test('the legend belongs to the Structure Viewer tab', async ({ page }) => {
  await open(page, 'NaCl');
  await expect(page.getByTestId('legend-item')).toHaveCount(2);
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('legend')).toBeHidden();
});

// ---- one layout for the three tabs ---------------------------------------------------------------

/** The name, Export button and Reset buttons of a view panel's header, left to right. */
async function header(page: Page, panel: string) {
  const head = page.locator(panel).locator('.phead');
  const title = (await head.locator('.phead-title > span').first().boundingBox())!;
  const exportBtn = (await head.getByRole('button', { name: /^Export/ }).boundingBox())!;
  const resets = head.getByRole('button', { name: /^Reset/ });
  const reset = (await resets.last().boundingBox())!;
  const tools = (await head.locator('.phead-tools').boundingBox())!;
  const box = (await head.boundingBox())!;
  return { title, exportBtn, reset, tools, box, resets };
}

function leftThenRight(h: Awaited<ReturnType<typeof header>>) {
  // the name, then the Export menu right after it, on the left; Reset in the top right corner
  expect(h.exportBtn.x).toBeGreaterThan(h.title.x + h.title.width);
  expect(h.exportBtn.x - (h.title.x + h.title.width)).toBeLessThan(20);
  expect(h.tools.x + h.tools.width).toBeGreaterThan(h.box.x + h.box.width - 20);
  expect(h.reset.x).toBeGreaterThanOrEqual(h.tools.x);
  expect(h.reset.x).toBeGreaterThan(h.box.x + h.box.width / 2);
  expect(Math.abs(h.reset.y - h.exportBtn.y)).toBeLessThan(6);
}

test('every view panel has its name and Export on the left and Reset on the right; nothing says Fit', async ({
  page,
}) => {
  await open(page, 'Si');
  const sv = await header(page, '[data-testid="viewer"] .viewcol');
  leftThenRight(sv);
  await expect(page.locator('[data-testid="viewer"] .phead-title')).toContainText(
    'Structure Viewer',
  );
  await expect(sv.resets).toHaveText(['Reset view', 'Reset zoom']);
  // the ribbon has no Reset buttons any more; Reset range is in the Range tab of the sidebar
  await expect(
    page.locator('[data-testid="viewer"] .toolbar').getByRole('button', { name: /^Reset/ }),
  ).toHaveCount(0);
  await expect(page.getByTestId('side-panel').getByTestId('reset-range')).toBeVisible();
  await expect(page.getByTestId('structure-file-button')).toHaveText(/^Export structure file/);

  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-hud')).toContainText('spots');
  const panels = page.locator('[data-testid="ed-tab"] .panel');
  const left = await header(page, '[data-testid="ed-tab"] .panel >> nth=0');
  leftThenRight(left);
  await expect(left.resets).toHaveText(['Reset zoom']);
  const right = await header(page, '[data-testid="ed-tab"] .panel >> nth=1');
  leftThenRight(right);
  await expect(right.resets).toHaveText(['Reset']);
  await expect(panels.nth(1).locator('.phead-title')).toContainText('Diffraction pattern');

  await page.getByTestId('tab-xrd').click();
  await expect(page.getByTestId('xrd-hud')).toContainText('peaks');
  const xrd = await header(page, '[data-testid="xrd-tab"] .plotcard');
  leftThenRight(xrd);
  await expect(xrd.resets).toHaveText(['Reset']);

  for (const tab of ['structure', 'ed', 'xrd']) {
    await page.getByTestId(`tab-${tab}`).click();
    await expect(page.getByRole('button', { name: 'Fit', exact: true })).toHaveCount(0);
  }
});

test('the diffraction tab: Zone axis, Structure range, Dynamical and Measure on the ribbon, the rest in a sidebar', async ({
  page,
}) => {
  await openED(page, 'Si');
  const legends = await page
    .locator('[data-testid="ed-tab"] .toolbar fieldset > legend')
    .allTextContents();
  expect(legends).toEqual(['Zone axis', 'Structure range', 'Dynamical', 'Tools']);
  await expect(
    page.locator('[data-testid="ed-tab"] .toolbar').getByTestId('ed-measure'),
  ).toBeVisible();

  // the sidebar sits right of the two square panels, as tall as they are
  const sidebar = page.getByTestId('ed-side-panel');
  const sideBox = (await sidebar.boundingBox())!;
  const pattern = (await page.locator('[data-testid="ed-tab"] .panel').nth(1).boundingBox())!;
  expect(sideBox.x).toBeGreaterThan(pattern.x + pattern.width);
  expect(Math.abs(sideBox.y - pattern.y)).toBeLessThan(2);
  expect(Math.abs(sideBox.height - pattern.height)).toBeLessThan(2);
  await expect(sidebar.getByRole('tab')).toHaveText(['Parameters', 'Pattern', 'Kikuchi / HOLZ']);

  const inTab: Record<string, string[]> = {
    params: ['ed-voltage', 'ed-preset-300', 'ed-thickness', 'ed-profile', 'ed-dw', 'ed-dw-b'],
    pattern: ['ed-laue', 'ed-scale', 'ed-exposure', 'ed-labels', 'ed-forbidden', 'ed-spots-csv'],
    kikuchi: ['ed-kikuchi', 'ed-kikuchi-count', 'ed-rings', 'ed-cbed', 'ed-alpha', 'ed-strain-0'],
  };
  for (const [tab, ids] of Object.entries(inTab)) {
    await side(page, tab as 'params' | 'pattern' | 'kikuchi');
    for (const id of ids) await expect(sidebar.getByTestId(id)).toBeVisible();
  }
  // no camera length: the scale bar is in 1/Å and the wheel zooms
  await expect(page.getByTestId('ed-camera')).toHaveCount(0);
  await expect(page.getByTestId('ed-scalebar')).toHaveText(/^\s*[\d.]+ Å⁻¹\s*$/);

  // collapsing keeps the settings: the rail brings the panel back on the same tab
  await page.getByTestId('ed-panel-collapse').click();
  await expect(sidebar).toBeHidden();
  await page.getByTestId('ed-panel-expand').click();
  await expect(page.getByTestId('ed-side-tab-kikuchi')).toHaveAttribute('aria-selected', 'true');
});

test('zone-axis presets a, b, c go to [100], [010], [001]; a*, b*, c* to the plane normals', async ({
  page,
}) => {
  await openED(page, 'Si');
  const readout = page.getByTestId('ed-readout');
  await page.getByTestId('ed-zone-a').click();
  await expect(readout).toContainText('beam ∥ [1 0 0] · 0.00°');
  await expect(page.getByTestId('ed-uvw-0')).toHaveValue('1');
  await page.getByTestId('ed-zone-b').click();
  await expect(readout).toContainText('beam ∥ [0 1 0] · 0.00°');
  await page.getByTestId('ed-zone-c').click();
  await expect(readout).toContainText('beam ∥ [0 0 1] · 0.00°');
  await page.getByTestId('ed-zone-astar').click();
  await expect(readout).toContainText('beam ∥ [1 0 0] · 0.00°'); // cubic: a* ∥ a
  await page.getByTestId('ed-zone-cstar').click();
  await expect(readout).toContainText('beam ∥ [0 0 1] · 0.00°');
  // the pattern is the [001] one: four-fold, with 2 2 0 and not 1 1 0 allowed
  const p = await page.evaluate(() => window.__crystallensED.pattern());
  expect(p!.zoneAxis).toEqual([0, 0, 1]);
});

test('a* of a monoclinic crystal is perpendicular to b and c: it makes β − 90° with a', async ({
  page,
}) => {
  const cif = readFileSync('tests/fixtures/cifs/ZrO2_baddeleyite.cif', 'utf8');
  const beta = Number(/_cell_angle_beta\s+([\d.]+)/.exec(cif)![1]);
  await openED(page, 'ZrO2_baddeleyite');
  await page.getByTestId('ed-zone-astar').click();
  await expect
    .poll(async () => {
      const d = (await page.evaluate(() => window.__crystallensED.viewState())).direction;
      return (Math.acos(Math.abs(d[0])) * 180) / Math.PI;
    })
    .toBeCloseTo(beta - 90, 2);
  const d = (await page.evaluate(() => window.__crystallensED.viewState())).direction;
  expect(Math.abs(d[1])).toBeLessThan(1e-6); // a* has no b component: it is in the a-c plane
});

// ---- the Export menu: Structure Viewer ------------------------------------------------------------

test('Structure Viewer: PNG at the chosen DPI, with the DPI stored in the file', async ({
  page,
}) => {
  await open(page, 'Si');
  await openMenu(page, 'export');
  await page.getByTestId('export-dpi').fill('150');
  // the size of the view in whole CSS pixels, as the app reads it
  const stage = await page.getByTestId('viewer-canvas').evaluate((c) => ({
    width: c.parentElement!.clientWidth,
    height: c.parentElement!.clientHeight,
  }));
  const w = Math.round((stage.width * 150) / 96);
  const h = Math.round((stage.height * 150) / 96);
  await expect(page.getByTestId('export-pixels')).toHaveText(`${w} × ${h} px`);
  const png = await save(page, 'export-png-save');
  expect(png.name).toBe('Si_structure.png');
  const head = pngHeader(png.bytes);
  expect([head.width, head.height]).toEqual([w, h]);
  expect(head.dpi!).toBeCloseTo(150, 0);
  await expect(page.getByTestId('export-status')).toContainText(`${w} × ${h} px at 150 dpi`);
  // white background, atoms drawn on it, the legend painted in the corner region
  const px = await pngPixels(page, png.bytes);
  expect(px.corner).toEqual([255, 255, 255, 255]);
  expect(px.inked).toBeGreaterThan(w * h * 0.02);

  // another resolution gives another size
  await page.getByTestId('export-dpi').fill('300');
  const big = await save(page, 'export-png-save');
  expect(pngHeader(big.bytes).width).toBe(Math.round((stage.width * 300) / 96));
  expect(pngHeader(big.bytes).dpi!).toBeCloseTo(300, 0);
});

test('Structure Viewer: a transparent PNG has an empty corner', async ({ page }) => {
  await open(page, 'Si');
  await openMenu(page, 'export');
  await page.getByTestId('export-dpi').fill('96');
  await page.getByTestId('export-transparent').check();
  const png = await save(page, 'export-png-save');
  const px = await pngPixels(page, png.bytes);
  expect(px.corner[3]).toBe(0);
  expect(px.inked).toBeGreaterThan(1000);
});

test('Structure Viewer: the SVG is well-formed vector art that matches the screen', async ({
  page,
}) => {
  await open(page, 'Si');
  await openMenu(page, 'export');
  const file = await save(page, 'export-svg-save');
  expect(file.name).toBe('Si_structure.svg');
  const svg = text(file.bytes);
  const n = (await page.evaluate(() => window.__crystallens.model())).count;
  const facts = await svgFacts(page, svg, [
    '#structure circle',
    '#structure line',
    '#legend circle',
    'radialGradient',
    '#axes line',
    'rect',
    'image',
  ]);
  expect(facts.error).toBeNull();
  expect(facts.root).toBe('svg');
  expect(facts.counts[0]).toBe(n); // one disc per atom (the whole structure is in view)
  expect(facts.counts[1]).toBeGreaterThan(12); // bonds and the cell edges
  expect(facts.counts[2]).toBe(1); // the legend: Si
  expect(facts.counts[3]).toBe(1); // one gradient for one colour
  expect(facts.counts[4]).toBe(3); // axes
  expect(facts.counts[5]).toBe(1); // the background
  expect(facts.counts[6]).toBe(0); // no embedded bitmaps: it is vector
  expect(svg).toContain('>Si</text>');

  // atom 0 is where the screen has it, and as big
  const { x, y } = await page.evaluate(() => window.__crystallens.atomScreen(0));
  const canvas = (await page.getByTestId('viewer-canvas').boundingBox())!;
  const lx = x - canvas.x;
  const ly = y - canvas.y;
  const hit = await page.evaluate(
    ({ svg, lx, ly }) => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      return [...doc.querySelectorAll('#structure circle')].some(
        (c) =>
          Math.abs(Number(c.getAttribute('cx')) - lx) < 0.6 &&
          Math.abs(Number(c.getAttribute('cy')) - ly) < 0.6,
      );
    },
    { svg, lx, ly },
  );
  expect(hit).toBe(true);
  expect(svg).toContain(`width="${Math.round(canvas.width)}"`);
});

test('Structure Viewer: the transparent SVG has no background rectangle', async ({ page }) => {
  await open(page, 'rutile');
  await openMenu(page, 'export');
  await page.getByTestId('export-transparent').check();
  const plain = text((await save(page, 'export-svg-save')).bytes);
  expect((await svgFacts(page, plain, ['rect'])).counts[0]).toBe(0);
  expect(plain).not.toContain('atom-labels');
});

test('Structure Viewer: CIF, XYZ and XYZ (computem) files from the ribbon, Save only', async ({
  page,
}) => {
  await open(page, 'rutile');
  await openMenu(page, 'structure-file');
  await expect(page.getByTestId('structure-file-panel').getByRole('button')).toHaveText([
    'Save',
    'Save',
    'Save',
  ]);
  await expect(page.getByTestId('structure-file-dpi')).toHaveCount(0);

  const cif = await save(page, 'structure-file-cif-save');
  expect(cif.name).toBe('rutile_P1.cif');
  expect(text(cif.bytes)).toMatch(/^data_/);
  expect(text(cif.bytes)).toContain('_cell_length_a');

  const n = (await page.evaluate(() => window.__crystallens.model())).count;
  const xyz = await save(page, 'structure-file-xyz-save');
  expect(xyz.name).toBe('rutile.xyz');
  const xl = text(xyz.bytes).trimEnd().split('\n');
  expect(xl[0]).toBe(String(n));
  expect(xl.length).toBe(n + 2);
  expect(xl[2].trim().split(/\s+/).length).toBe(4);

  const cm = await save(page, 'structure-file-computem-save');
  expect(cm.name).toBe('rutile_computem.xyz');
  const cl = text(cm.bytes).trimEnd().split('\n');
  expect(Number(cl[0])).toBe(n);
  expect(cl[1].split(' ').length).toBe(3);
  expect(cl[cl.length - 1]).toBe('-1');
  expect(cl.length).toBe(n + 3);
  const row = cl[2].split(' ');
  expect(row.length).toBe(6);
  expect([22, 8]).toContain(Number(row[0]));
  expect(Number(row[4])).toBe(1);
  expect(Number(row[5])).toBeGreaterThan(0.3); // B = 8π²U of rutile
  // the extent of the one-cell view is the cell: a, a, c for rutile
  const ext = cl[1].split(' ').map(Number);
  const cell = (tag: string) =>
    Number(
      new RegExp(`${tag}\\s+([\\d.]+)`).exec(
        readFileSync('tests/fixtures/cifs/rutile.cif', 'utf8'),
      )![1],
    );
  expect(ext[0]).toBeCloseTo(cell('_cell_length_a'), 3);
  expect(ext[1]).toBeCloseTo(cell('_cell_length_b'), 3);
  expect(ext[2]).toBeCloseTo(cell('_cell_length_c'), 3);
});

test('Structure Viewer: the image menu has PNG and SVG only, and Copy puts them on the clipboard', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page, 'NaCl');
  await openMenu(page, 'export');
  await expect(page.getByTestId('export-panel').locator('.name')).toHaveText(['PNG', 'SVG']);

  await page.getByTestId('export-png-copy').click();
  await expect(page.getByTestId('export-status')).toContainText('Copied the image');
  const types = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    return items.map((i) => i.types);
  });
  expect(types[0]).toContain('image/png');

  await page.getByTestId('export-svg-copy').click();
  const svg = await page.evaluate(() => navigator.clipboard.readText());
  expect(svg.startsWith('<svg')).toBe(true);
});

test('the DPI box refuses nonsense and the menu closes with Escape', async ({ page }) => {
  await open(page, 'Si');
  await openMenu(page, 'export');
  await page.getByTestId('export-dpi').fill('5');
  await expect(page.getByTestId('export-png-save')).toBeDisabled();
  await expect(page.getByTestId('export-png-copy')).toBeDisabled();
  await expect(page.getByTestId('export-svg-save')).toBeDisabled();
  await page.getByTestId('export-dpi').fill('300');
  await expect(page.getByTestId('export-png-save')).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('export-panel')).toBeHidden();
});

test('the export button is disabled until a structure is open', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('export-button')).toBeDisabled();
  await expect(page.getByTestId('structure-file-button')).toBeDisabled();
});

// ---- Electron Diffraction -------------------------------------------------------------------------

test('Electron Diffraction: the pattern as PNG and as clean SVG; the spot list as CSV from the sidebar', async ({
  page,
}) => {
  await openED(page, 'Si');
  for (let k = 0; k < 3; k++) await page.getByTestId(`ed-uvw-${k}`).fill(['1', '1', '0'][k]);
  await page.getByTestId('ed-uvw-go').click();
  await expect(page.getByTestId('ed-readout')).toContainText('beam ∥ [1 1 0] · 0.00°');
  await openMenu(page, 'ed-export');
  await expect(page.getByTestId('ed-export-panel').locator('.name')).toHaveText(['PNG', 'SVG']);

  const svgFile = await save(page, 'ed-export-svg-save');
  expect(svgFile.name).toBe('Si_zone_1_1_0_pattern.svg');
  const svg = text(svgFile.bytes);
  const drawn = await page.evaluate(() => window.__crystallensED.drawn());
  const facts = await svgFacts(page, svg, ['circle', 'text', '[class]', '[data-testid]', 'rect']);
  expect(facts.error).toBeNull();
  expect(facts.counts[0]).toBeGreaterThan(drawn); // spots, the central beam
  expect(facts.counts[1]).toBeGreaterThan(5); // labels and the scale bar
  expect(facts.counts[2]).toBe(0); // styles are written into the elements
  expect(facts.counts[3]).toBe(0); // nothing of the page's test machinery
  expect(svg).toContain('font-family');
  expect(svg).toMatch(/<rect[^>]*fill="#ffffff"/);

  await page.getByTestId('ed-export-transparent').check();
  const clear = text((await save(page, 'ed-export-svg-save')).bytes);
  expect((await svgFacts(page, clear, ['rect'])).counts[0]).toBe(0);
  await page.getByTestId('ed-export-transparent').uncheck();

  await page.getByTestId('ed-export-dpi').fill('200');
  const size = (await page.getByTestId('ed-pattern').boundingBox())!;
  const png = await save(page, 'ed-export-png-save');
  const head = pngHeader(png.bytes);
  expect(head.width).toBe(Math.round((size.width * 200) / 96));
  expect(head.dpi!).toBeCloseTo(200, 0);
  const px = await pngPixels(page, png.bytes);
  expect(px.corner).toEqual([255, 255, 255, 255]);
  expect(px.inked).toBeGreaterThan(500);

  await page.keyboard.press('Escape');
  await side(page, 'pattern');
  const csv = await download(page, 'ed-spots-csv');
  expect(csv.name).toBe('Si_zone_1_1_0_spots.csv');
  const lines = csv.text.trimEnd().split('\n');
  const p = (await page.evaluate(() => window.__crystallensED.pattern()))!;
  expect(lines.length).toBe(p.count + 1);
  expect(lines[0].startsWith('h,k,l,laue_zone,d_angstrom')).toBe(true);
  expect(lines[0]).not.toContain('I_fraction');
  const first = lines[1].split(',');
  // the strongest spot of the [110] zone of Si is a {111} one
  expect(first.slice(0, 3).map((x) => Math.abs(Number(x)))).toEqual([1, 1, 1]);
  expect(Number(first[9])).toBeGreaterThan(0.1); // strongest first
});

test('Electron Diffraction: the dynamical pattern is exported with its own columns', async ({
  page,
}) => {
  await openED(page, 'Si');
  for (let k = 0; k < 3; k++) await page.getByTestId(`ed-uvw-${k}`).fill(['1', '1', '0'][k]);
  await page.getByTestId('ed-uvw-go').click();
  await page.getByTestId('ed-dyn-beams').fill('60');
  await page.getByTestId('ed-dyn-calc').click();
  await expect
    .poll(async () => (await page.evaluate(() => window.__crystallensED.dynamic())).shown, {
      timeout: 30000,
    })
    .toBe(true);
  await side(page, 'pattern');
  const csv = await download(page, 'ed-spots-csv');
  expect(csv.name).toBe('Si_zone_1_1_0_dynamical_spots.csv');
  const lines = csv.text.trimEnd().split('\n');
  expect(lines[0].endsWith('I_fraction_of_incident,kinematically_forbidden')).toBe(true);
  const dyn = await page.evaluate(() => window.__crystallensED.dynamic());
  expect(lines.length).toBe(dyn.spots.length + 1);
  // the kinematically forbidden 002 is in it, flagged
  const row = lines.find((l) => l.startsWith('0,0,2,') || l.startsWith('0,0,-2,'));
  expect(row?.endsWith(',1')).toBe(true);
});

test('Electron Diffraction: the structure on the left as PNG and SVG from its own header', async ({
  page,
}) => {
  await openED(page, 'NaCl');
  await page.getByTestId('ed-range-2').click();
  await expect(page.locator('[data-testid="ed-tab"] .hud').first()).toContainText('125 atoms');
  await page.getByTestId('ed-reset-zoom').click(); // the whole 2×2×2 block in view
  await openMenu(page, 'ed-structure-export');
  await expect(page.getByTestId('ed-structure-export-panel').locator('.name')).toHaveText([
    'PNG',
    'SVG',
  ]);
  const svgFile = await save(page, 'ed-structure-export-svg-save');
  expect(svgFile.name).toBe('NaCl_zone_0_0_1_structure.svg');
  const facts = await svgFacts(page, text(svgFile.bytes), ['#structure circle', 'image']);
  expect(facts.error).toBeNull();
  expect(facts.counts[0]).toBe(125); // every atom of the 2×2×2 range
  expect(facts.counts[1]).toBe(0);

  await page.getByTestId('ed-structure-export-dpi').fill('192');
  // the size of the view in whole CSS pixels, as the app reads it
  const width = await page.getByTestId('ed-canvas').evaluate((c) => c.parentElement!.clientWidth);
  const png = await save(page, 'ed-structure-export-png-save');
  const head = pngHeader(png.bytes);
  expect(head.width).toBe(width * 2);
  expect(head.dpi!).toBeCloseTo(192, 0);
  expect((await pngPixels(page, png.bytes)).inked).toBeGreaterThan(1000);
});

// ---- Powder XRD -----------------------------------------------------------------------------------

test('Powder XRD: PNG and SVG of the pattern from its header; CSV of the profile and the peaks by the table', async ({
  page,
}) => {
  await openXRD(page, 'Si');
  await openMenu(page, 'xrd-export');
  await expect(page.getByTestId('xrd-export-panel').locator('.name')).toHaveText(['PNG', 'SVG']);

  const svgFile = await save(page, 'xrd-export-svg-save');
  expect(svgFile.name).toBe('Si_xrd.svg');
  const svg = text(svgFile.bytes);
  const facts = await svgFacts(page, svg, [
    'polyline',
    'line',
    'text',
    '[class]',
    '[data-testid]',
    'rect',
  ]);
  expect(facts.error).toBeNull();
  expect(facts.counts[0]).toBeGreaterThanOrEqual(1); // the calculated curve
  expect(facts.counts[1]).toBeGreaterThan(10); // grid, ticks and peak sticks
  expect(facts.counts[3]).toBe(0);
  expect(facts.counts[4]).toBe(0);
  expect(svg).toMatch(/<rect[^>]*fill="#ffffff"/);
  // the curve keeps its blue and the sticks their red as written styles
  expect(svg).toContain('stroke:rgb(29, 78, 216)');

  await page.getByTestId('xrd-export-dpi').fill('250');
  const plot = (await page.getByTestId('pxrd-plot').boundingBox())!;
  const png = await save(page, 'xrd-export-png-save');
  expect(png.name).toBe('Si_xrd.png');
  const head = pngHeader(png.bytes);
  expect(head.width).toBe(Math.round((plot.width * 250) / 96));
  expect(head.dpi!).toBeCloseTo(250, 0);
  const px = await pngPixels(page, png.bytes);
  expect(px.corner).toEqual([255, 255, 255, 255]);
  expect(px.inked).toBeGreaterThan(2000);

  await page.keyboard.press('Escape');
  const profile = await download(page, 'xrd-profile-csv');
  expect(profile.name).toBe('Si_profile.csv');
  const lines = profile.text.trimEnd().split('\n');
  const info = (await page.evaluate(() => window.__crystallensXRD.profile()))!;
  expect(lines[0]).toBe('two_theta_deg,d_angstrom,Q_inv_angstrom,intensity');
  expect(lines.length).toBe(info.n + 1);
  expect(Number(lines[1].split(',')[0])).toBeCloseTo(info.first, 3);
  expect(Math.max(...lines.slice(1).map((l) => Number(l.split(',')[3])))).toBeCloseTo(100, 3);
  // Si (111) is at 28.44° (Cu Kα₁): d = 3.1356 Å
  const near = lines.slice(1).find((l) => Math.abs(Number(l.split(',')[0]) - 28.44) < 0.011)!;
  expect(Number(near.split(',')[1])).toBeCloseTo(3.1356, 2);

  const peaks = await download(page, 'xrd-csv');
  expect(peaks.name).toBe('Si_peaks.csv');
  expect(peaks.text.split('\n')[0]).toBe('h,k,l,multiplicity,d_angstrom,two_theta_deg,F,I_rel');
});

test('Powder XRD: Copy puts the picture on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openXRD(page, 'Si');
  await openMenu(page, 'xrd-export');
  await page.getByTestId('xrd-export-svg-copy').click();
  await expect(page.getByTestId('xrd-export-status')).toContainText('Copied the SVG text');
  expect((await page.evaluate(() => navigator.clipboard.readText())).startsWith('<svg')).toBe(true);
  await page.getByTestId('xrd-export-png-copy').click();
  await expect(page.getByTestId('xrd-export-status')).toContainText('Copied the image');
});
