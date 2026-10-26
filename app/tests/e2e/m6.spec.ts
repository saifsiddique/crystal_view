import { expect, test, type Page } from '@playwright/test';

// Tall enough that the viewer and its panel are on screen: Playwright ignores clicks outside.
test.use({ viewport: { width: 1400, height: 1100 } });

async function load(page: Page, name: string) {
  await page.goto('/');
  await page.getByTestId('cif-input').setInputFiles(`tests/fixtures/cifs/${name}.cif`);
  await expect(page.getByTestId('hud')).toContainText('atoms');
}

/** Show a tab of the settings panel (Range, Bonds, Polyhedra, Appearance, Elements). */
async function openSection(page: Page, title: string) {
  await page.getByRole('tab', { name: title, exact: true }).click();
}

const hud = (page: Page) => page.getByTestId('hud');
const setNumber = async (page: Page, label: string, value: string) => {
  const input = page.getByLabel(label, { exact: true });
  await input.fill(value);
  await input.dispatchEvent('change');
};

/** A fingerprint of what the canvas shows; the HUD text is masked out. */
const picture = async (page: Page) =>
  (
    await page.getByTestId('viewer-canvas').screenshot({ mask: [page.getByTestId('hud')] })
  ).toString('base64');

test.describe('range', () => {
  test('the presets give 8, 27 and 125 atoms for NaCl; reset range returns to 27', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    await expect(hud(page)).toContainText('27 atoms · 54 bonds'); // default: cell + boundary
    await page.getByTestId('preset-cell').click();
    await expect(hud(page)).toContainText('8 atoms · 12 bonds');
    await page.getByTestId('preset-2').click();
    await expect(hud(page)).toContainText('125 atoms');
    await page.getByRole('button', { name: 'Reset range' }).click();
    await expect(hud(page)).toContainText('27 atoms · 54 bonds');
  });

  test('min and max can be typed, boundary atoms can be left out, and a slab cuts the box', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    await setNumber(page, 'a min', '-0.5');
    await expect(hud(page)).toContainText('atoms');
    await page.getByRole('button', { name: 'Reset range' }).click();
    await page.getByTestId('boundary').uncheck();
    await expect(hud(page)).toContainText('8 atoms');
    await page.getByTestId('boundary').check();

    await page.getByTestId('slab').check(); // (001), thickness d(001) = 5.62 A: the whole cell
    await expect(hud(page)).toContainText('27 atoms');
    await setNumber(page, 'slab thickness', '1');
    await expect(hud(page)).toContainText('9 atoms'); // only the z = 0 layer
    await setNumber(page, 'slab offset', '2.5');
    await expect(hud(page)).toContainText('9 atoms'); // only the z = a/2 layer
    await page.getByTestId('slab').uncheck();
    await expect(hud(page)).toContainText('27 atoms');
  });

  test('changing the range keeps the view; Reset view and Reset zoom do separate things', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    const box = (await page.getByTestId('viewer-canvas').boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 180, box.y + 130, { steps: 8 });
    await page.mouse.up();
    await page.mouse.move(box.x + 5, box.y + 5);
    const view = () => page.evaluate(() => window.__crystallens.viewState());
    const fit = (await view()).visibleHeight;
    await page.mouse.wheel(0, -1500);
    await expect.poll(async () => (await view()).visibleHeight).toBeLessThan(fit * 0.8);
    const turned = await view();

    // Reset zoom: the magnification returns, the orientation does not change.
    await page.getByRole('button', { name: 'Reset zoom' }).click();
    const zoomReset = await view();
    expect(zoomReset.visibleHeight).toBeCloseTo(fit, 3);
    for (let k = 0; k < 3; k++) expect(zoomReset.direction[k]).toBeCloseTo(turned.direction[k], 3);

    // Zoom in again, then Reset view: the orientation returns, the magnification does not change.
    await page.mouse.move(box.x + 5, box.y + 5); // the pointer must be over the canvas to zoom
    await page.mouse.wheel(0, -1500);
    await expect.poll(async () => (await view()).visibleHeight).toBeLessThan(fit * 0.8);
    const zoomedAgain = await view();
    await page.getByRole('button', { name: 'Reset view' }).click();
    const viewReset = await view();
    expect(viewReset.visibleHeight).toBeCloseTo(zoomedAgain.visibleHeight, 3);
    expect(Math.abs(viewReset.direction[2])).toBeGreaterThan(0.9); // back to looking along c
    expect(viewReset.direction[0]).not.toBeCloseTo(turned.direction[0], 2);
  });
});

test.describe('bonds', () => {
  test('the Bonds checkbox draws or hides every bond', async ({ page }) => {
    await load(page, 'NaCl');
    expect(await page.evaluate(() => window.__crystallens.bondsDrawn())).toBe(true);
    const withBonds = await picture(page);
    await page.getByTestId('bonds').uncheck();
    await expect.poll(() => page.evaluate(() => window.__crystallens.bondsDrawn())).toBe(false);
    await expect.poll(async () => (await picture(page)) !== withBonds).toBe(true);
    await expect(hud(page)).toContainText('54 bonds'); // they still exist, just not drawn
    await page.getByTestId('bonds').check();
    await expect.poll(() => page.evaluate(() => window.__crystallens.bondsDrawn())).toBe(true);
    await expect.poll(async () => (await picture(page)) === withBonds).toBe(true);

    // Space filling draws none either, whatever the checkbox says.
    await page.getByTestId('style').selectOption('spaceFill');
    await expect.poll(() => page.evaluate(() => window.__crystallens.bondsDrawn())).toBe(false);
  });

  test('beyond the range adds the bonded atoms: 8 atoms become 32 with 36 bonds', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    await page.getByTestId('preset-cell').click();
    await expect(hud(page)).toContainText('8 atoms · 12 bonds');
    await openSection(page, 'Bonds');
    await page.getByTestId('beyond').check();
    await expect(hud(page)).toContainText('32 atoms · 36 bonds');
    // an added atom says so in its tooltip
    const added = await page.evaluate(() => {
      const hook = window.__crystallens;
      for (let i = 31; i >= 8; i--) {
        const p = hook.atomScreen(i);
        if (hook.pickAt(p.x, p.y) === i) return i;
      }
      return -1;
    });
    expect(added).toBeGreaterThanOrEqual(8);
    const p = await page.evaluate((i) => window.__crystallens.atomScreen(i), added);
    await page.mouse.move(p.x, p.y);
    await expect(page.getByTestId('tooltip')).toContainText('outside the range');
  });

  test('completing a framework warns that it cannot', async ({ page }) => {
    await load(page, 'NaCl');
    await openSection(page, 'Bonds');
    await page.getByTestId('complete').check();
    await expect(page.getByRole('status')).toContainText('framework');
  });

  test('the rule table edits the bonds: a short maximum removes them, a new pair adds them', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    await openSection(page, 'Bonds');
    await expect(page.getByTestId('rules')).toContainText('Cl–Na');
    await setNumber(page, 'Cl-Na max', '2');
    await expect(hud(page)).toContainText('0 bonds');
    await setNumber(page, 'Cl-Na max', '3.08');
    await expect(hud(page)).toContainText('54 bonds');

    await page.getByLabel('pair element 1').selectOption('Na');
    await page.getByLabel('pair element 2').selectOption('Na');
    await page.getByTestId('add-rule').click();
    await expect(page.getByTestId('rules')).toContainText('Na–Na');
    await setNumber(page, 'Na-Na max', '4.2');
    await expect(hud(page)).not.toContainText('· 54 bonds');
    await page.getByRole('button', { name: 'Reset rules' }).click();
    await expect(hud(page)).toContainText('54 bonds');
    await expect(page.getByTestId('rules')).not.toContainText('Na–Na');
  });

  test('a rule can be hidden or coloured without changing the bond count', async ({ page }) => {
    await load(page, 'NaCl');
    const before = await picture(page);
    await openSection(page, 'Bonds');
    await page.getByLabel('Cl-Na shown').uncheck();
    await expect(hud(page)).toContainText('54 bonds');
    await expect.poll(async () => (await picture(page)) !== before).toBe(true);
    await page.getByLabel('Cl-Na shown').check();
    await expect.poll(async () => (await picture(page)) === before).toBe(true);
    await page.getByLabel('Cl-Na colour').fill('#ff0000');
    await expect.poll(async () => (await picture(page)) !== before).toBe(true);
    await page.getByRole('button', { name: 'auto' }).click();
    await expect.poll(async () => (await picture(page)) === before).toBe(true);
  });

  test('draws and deletes a bond between two selected atoms', async ({ page }) => {
    await load(page, 'NaCl');
    // Two visible atoms of the same element, which are never bonded to each other.
    const pair = await page.evaluate(() => {
      const hook = window.__crystallens;
      const m = hook.model();
      const visible = (i: number) => {
        const p = hook.atomScreen(i);
        return hook.pickAt(p.x, p.y) === i;
      };
      const bonded = new Set<string>();
      for (let b = 0; b < m.bonds.length; b += 2) bonded.add(`${m.bonds[b]},${m.bonds[b + 1]}`);
      for (let i = 0; i < m.count; i++)
        for (let j = i + 1; j < m.count; j++)
          if (!bonded.has(`${i},${j}`) && visible(i) && visible(j)) return [i, j];
      return [];
    });
    expect(pair).toHaveLength(2);
    await openSection(page, 'Bonds');
    const draw = page.getByTestId('draw-bond');
    await expect(draw).toBeDisabled();
    for (const i of pair) {
      const p = await page.evaluate((k) => window.__crystallens.atomScreen(k), i);
      await page.mouse.click(p.x, p.y);
    }
    await expect(draw).toBeEnabled();
    await draw.click();
    await expect(hud(page)).toContainText('55 bonds');
    expect(
      (await page.evaluate(() => window.__crystallens.settings())).bonds.manual.add,
    ).toHaveLength(1);
    // the selection was cleared by the rebuild; select the pair again and delete the bond
    for (const i of pair) {
      const p = await page.evaluate((k) => window.__crystallens.atomScreen(k), i);
      await page.mouse.click(p.x, p.y);
    }
    await page.getByTestId('delete-bond').click();
    await expect(hud(page)).toContainText('54 bonds');
    expect((await page.evaluate(() => window.__crystallens.settings())).bonds.manual).toEqual({
      add: [],
      remove: [],
    });
  });
});

test.describe('polyhedra', () => {
  test('octahedra appear around Na only where all six neighbours are shown', async ({ page }) => {
    await load(page, 'NaCl');
    await openSection(page, 'Polyhedra');
    await page.getByTestId('poly-Na').check();
    await page.getByTestId('poly-Cl').check();
    // closed cell: only the body-centre atom has all its neighbours
    await expect(page.getByTestId('poly-info')).toContainText('1 drawn, 26 skipped');
    await openSection(page, 'Bonds');
    await page.getByTestId('beyond').check();
    await openSection(page, 'Polyhedra');
    await expect(page.getByTestId('poly-info')).toContainText('27 drawn');
    // the atoms added beyond the range have polyhedra of their own, which are incomplete
    const info = await page.evaluate(() => window.__crystallens.polyhedra());
    expect(info.count).toBe(27);
    expect(info.skipped).toBeGreaterThan(0);
  });

  test('changing opacity redraws, and unticking the elements removes the polyhedra', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    await openSection(page, 'Bonds');
    await page.getByTestId('beyond').check();
    const none = await picture(page);
    await openSection(page, 'Polyhedra');
    await page.getByTestId('poly-Na').check();
    await expect.poll(async () => (await picture(page)) !== none).toBe(true);
    const solid = await picture(page);
    await page.getByLabel('polyhedra opacity').fill('1');
    await expect.poll(async () => (await picture(page)) !== solid).toBe(true);
    await page.getByTestId('poly-Na').uncheck();
    await expect.poll(async () => (await picture(page)) === none).toBe(true);
  });
});

test.describe('appearance and visibility', () => {
  const firstVisible = (element: string) => page_evaluate_first_visible(element);

  function page_evaluate_first_visible(element: string) {
    return (page: Page) =>
      page.evaluate((el) => {
        const hook = window.__crystallens;
        const m = hook.model();
        for (let i = 0; i < m.count; i++) {
          if (m.elements[m.species[i]] !== el) continue;
          const p = hook.atomScreen(i);
          if (hook.pickAt(p.x, p.y) === i) return i;
        }
        return -1;
      }, element);
  }

  test('hiding an element hides its atoms and the bonds to them', async ({ page }) => {
    await load(page, 'NaCl');
    const na = await firstVisible('Na')(page);
    expect(na).toBeGreaterThanOrEqual(0);
    const before = await picture(page);
    await openSection(page, 'Elements');
    await page.getByLabel('show Na', { exact: true }).uncheck();
    await expect
      .poll(async () => {
        const p = await page.evaluate((i) => window.__crystallens.atomScreen(i), na);
        return page.evaluate((q) => window.__crystallens.pickAt(q.x, q.y), p);
      })
      .not.toBe(na);
    await expect.poll(async () => (await picture(page)) !== before).toBe(true);
    await page.getByLabel('show Na', { exact: true }).check();
    await expect.poll(async () => (await picture(page)) === before).toBe(true);
  });

  test('hiding a site, and hide selected / show hidden, work on single atoms', async ({ page }) => {
    await load(page, 'NaCl');
    const cl = await firstVisible('Cl')(page);
    const p = await page.evaluate((i) => window.__crystallens.atomScreen(i), cl);
    await page.mouse.click(p.x, p.y);
    expect(await page.evaluate(() => window.__crystallens.selection())).toEqual([cl]);
    await openSection(page, 'Elements');
    await page.getByTestId('hide-selected').click();
    await expect(page.getByTestId('show-hidden')).toContainText('Show 1 hidden');
    await expect
      .poll(() => page.evaluate((q) => window.__crystallens.pickAt(q.x, q.y), p))
      .not.toBe(cl);
    await page.getByTestId('show-hidden').click();
    await expect
      .poll(() => page.evaluate((q) => window.__crystallens.pickAt(q.x, q.y), p))
      .toBe(cl);
  });

  test('a colour change is applied at once and the settings remember it', async ({ page }) => {
    await load(page, 'NaCl');
    const before = await picture(page);
    await openSection(page, 'Elements');
    await page.getByLabel('Na colour', { exact: true }).fill('#00aa00');
    await expect.poll(async () => (await picture(page)) !== before).toBe(true);
    const s = await page.evaluate(() => window.__crystallens.settings());
    expect(s.appearance.elements.Na.color).toBe('#00aa00');
    // resolving and applying took well under a frame on this small structure
    expect(await page.evaluate(() => window.__crystallens.appearanceMs())).toBeLessThan(16);
    // the per-element reset button forgets it
    await page.getByRole('button', { name: '↺' }).first().click();
    await expect.poll(async () => (await picture(page)) === before).toBe(true);
  });

  test('radius scheme and scale change the picture; background and labels are applied', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    const before = await picture(page);
    await openSection(page, 'Appearance');
    await page.getByTestId('scheme').selectOption('uniform');
    await expect.poll(async () => (await picture(page)) !== before).toBe(true);
    await page.getByTestId('scheme').selectOption('auto');
    await expect.poll(async () => (await picture(page)) === before).toBe(true);
    await page.getByLabel('radius scale').fill('0.5');
    await expect.poll(async () => (await picture(page)) !== before).toBe(true);

    await page.getByTestId('background').fill('#203040');
    await expect(page.locator('.stage')).toHaveCSS('background-color', 'rgb(32, 48, 64)');

    // labels are drawn on the overlay canvas
    const inked = () =>
      page.getByTestId('label-canvas').evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      });
    expect(await inked()).toBe(0);
    await page.getByTestId('labels').selectOption('element');
    await expect.poll(inked).toBeGreaterThan(50);
    await page.getByTestId('labels').selectOption('none');
    await expect.poll(inked).toBe(0);
  });

  test('a new crystal starts with fresh element settings but keeps preferences', async ({
    page,
  }) => {
    await load(page, 'NaCl');
    await openSection(page, 'Elements');
    await page.getByLabel('Na colour', { exact: true }).fill('#00aa00');
    await page.getByTestId('style').selectOption('spaceFill');
    await page.getByTestId('cif-input').setInputFiles('tests/fixtures/cifs/Si.cif');
    await expect(page.getByTestId('hud')).toContainText('atoms');
    const s = await page.evaluate(() => window.__crystallens.settings());
    expect(s.appearance.elements).toEqual({});
    await expect(page.getByTestId('style')).toHaveValue('spaceFill');
  });
});
