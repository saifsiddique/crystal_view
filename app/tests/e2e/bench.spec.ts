import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// Performance audit (context.md M15): measures the budgets of the plan in the production build and
// writes them to BENCH_OUT (JSON) and the console. Skipped unless BENCH=1; run it alone, on one
// worker, ideally headed so that WebGL uses the GPU:
//   BENCH=1 npx playwright test tests/e2e/bench.spec.ts --workers=1 --headed
// Times are measured inside the page (performance.now), from the action to the next drawn frame.
test.skip(!process.env.BENCH, 'benchmarks run only with BENCH=1');
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1400, height: 1000 } });
test.setTimeout(900_000);

const results: Record<string, unknown> = {};
const record = (key: string, value: unknown) => {
  results[key] = value;
  console.log(`[bench] ${key}: ${JSON.stringify(value)}`);
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const round = (x: number) => Math.round(x * 10) / 10;

test.afterAll(() => {
  if (process.env.BENCH_OUT) writeFileSync(process.env.BENCH_OUT, JSON.stringify(results, null, 2));
});

const FIXTURE = (name: string) => `tests/fixtures/cifs/${name}.cif`;
const COD = (id: string) => `tests/cod_sample/${id}.cif`;

async function start(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => !!window.__crystallens);
}

/** Drop a file on the Open CIF bar; ms until the new structure is first drawn. */
async function timedLoad(page: Page, path: string): Promise<number> {
  const text = readFileSync(path, 'utf8');
  const name = path.split('/').pop()!;
  return page.evaluate(
    async ({ text, name }) => {
      const h = window.__crystallens;
      const before = h.stats().renders;
      const previous = h.model();
      const dt = new DataTransfer();
      dt.items.add(new File([text], name));
      const t0 = performance.now();
      document
        .querySelector('section.load')!
        .dispatchEvent(
          new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }),
        );
      await new Promise<void>((resolve) => {
        const loop = () => {
          const m = h.model();
          if (m && m !== previous && h.stats().renders > before) resolve();
          else requestAnimationFrame(loop);
        };
        loop();
      });
      return performance.now() - t0;
    },
    { text, name },
  );
}

/** Set the Structure Viewer's range to 0..n along a, b, c; ms until it is drawn, and the atom count. */
async function timedRange(page: Page, n: number) {
  await page.getByTestId('side-tab-range').click();
  return page.evaluate(async (n) => {
    const h = window.__crystallens;
    const previous = h.model();
    const before = h.stats().renders;
    const t0 = performance.now();
    for (const axis of ['a', 'b', 'c']) {
      const input = document.querySelector<HTMLInputElement>(`input[aria-label="${axis} max"]`)!;
      input.value = String(n);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await new Promise<void>((resolve) => {
      const loop = () => {
        if (h.model() !== previous && h.stats().renders > before) resolve();
        else requestAnimationFrame(loop);
      };
      loop();
    });
    return {
      ms: performance.now() - t0,
      buildMs: h.buildMs(),
      appearanceMs: h.appearanceMs(),
      atoms: h.model()!.count,
      bonds: h.model()!.bonds.length / 2,
    };
  }, n);
}

/** Frames drawn per second while the structure turns by 1° every animation frame for `ms`. */
async function spinFps(page: Page, ms = 3000) {
  return page.evaluate(async (ms) => {
    const h = window.__crystallens;
    // warm up: the first frames after a rebuild compile shaders and upload buffers
    for (let i = 0; i < 10; i++) {
      h.turn(1, 0, 0);
      await new Promise((r) => requestAnimationFrame(r));
    }
    const r0 = h.stats().renders;
    const t0 = performance.now();
    const gaps: number[] = [];
    let last = t0;
    while (performance.now() - t0 < ms) {
      h.turn(1, 0, 0);
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      gaps.push(now - last);
      last = now;
    }
    const frames = h.stats().renders - r0;
    gaps.sort((a, b) => a - b);
    return {
      fps: (frames * 1000) / (performance.now() - t0),
      p95FrameMs: gaps[Math.floor(gaps.length * 0.95)],
    };
  }, ms);
}

test('environment', async ({ page, browserName }) => {
  await start(page);
  const gpu = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: info ? gl!.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown',
      threads: navigator.hardwareConcurrency,
    };
  });
  record('environment', { browser: browserName, ...gpu });
});

test('CIF load to first render', async ({ page }) => {
  await start(page);
  await timedLoad(page, FIXTURE('Si')); // warm-up: code loading and JIT
  const out: Record<string, unknown> = {};
  for (const [label, path] of [
    ['Si (8 atoms/cell)', FIXTURE('Si')],
    ['albite (52 atoms/cell)', FIXTURE('albite')],
    ['COD 7011033 (200 atoms/cell)', COD('7011033')],
    ['COD 1552147 (2364 atoms/cell)', COD('1552147')],
    ['COD 4128587 (11504 atoms/cell)', COD('4128587')],
  ] as const) {
    const times: number[] = [];
    for (let i = 0; i < 3; i++) times.push(await timedLoad(page, path));
    out[label] = { medianMs: round(median(times)), runs: times.map(round) };
  }
  record('load', out);
});

test('range and bond recompute; rotation frame rate', async ({ page }) => {
  await start(page);
  await timedLoad(page, FIXTURE('Si'));
  const recompute: Record<string, unknown> = {};
  const fps: Record<string, unknown> = {};
  for (const n of [5, 11, 17, 23]) {
    const r = await timedRange(page, n);
    recompute[`${r.atoms} atoms`] = {
      ms: round(r.ms),
      buildMs: round(r.buildMs),
      appearanceMs: round(r.appearanceMs),
      bonds: r.bonds,
    };
    const f = await spinFps(page);
    fps[`${r.atoms} atoms, ball and stick`] = {
      fps: round(f.fps),
      p95FrameMs: round(f.p95FrameMs),
    };
  }
  // the largest range again without bonds, and space filling
  await page.getByTestId('bonds').uncheck();
  const nb = await spinFps(page);
  fps['largest, no bonds'] = { fps: round(nb.fps), p95FrameMs: round(nb.p95FrameMs) };
  await page.getByTestId('style').selectOption('spaceFill');
  const sf = await spinFps(page);
  fps['largest, space filling'] = { fps: round(sf.fps), p95FrameMs: round(sf.p95FrameMs) };
  record('recompute', recompute);
  record('fps', fps);
});

async function openED(page: Page, path: string) {
  await start(page);
  await timedLoad(page, path);
  const t0 = Date.now();
  await page.getByTestId('tab-ed').click();
  await expect(page.getByTestId('ed-hud')).toContainText('spots', { timeout: 180_000 });
  return Date.now() - t0;
}

/** Type a zone axis and press Go; ms until the pattern for it is computed and drawn. */
async function timedZone(page: Page, uvw: number[]) {
  return page.evaluate(async (uvw) => {
    const h = window.__crystallensED;
    for (let k = 0; k < 3; k++) {
      const input = document.querySelector<HTMLInputElement>(`[data-testid="ed-uvw-${k}"]`)!;
      input.value = String(uvw[k]);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await new Promise((r) => requestAnimationFrame(r));
    const t0 = performance.now();
    document.querySelector<HTMLButtonElement>('[data-testid="ed-uvw-go"]')!.click();
    await new Promise<void>((resolve) => {
      const loop = () => {
        const p = h.pattern();
        if (p && p.zoneAxis.join() === uvw.join()) resolve();
        else requestAnimationFrame(loop);
      };
      loop();
    });
    await new Promise((r) => requestAnimationFrame(r));
    return { ms: performance.now() - t0, computeMs: h.computeMs(), spots: h.pattern()!.count };
  }, uvw);
}

test('kinematic electron diffraction update', async ({ page }) => {
  const out: Record<string, unknown> = {};
  for (const [label, path, axes] of [
    [
      'Si',
      FIXTURE('Si'),
      [
        [1, 1, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
    ],
    [
      'albite',
      FIXTURE('albite'),
      [
        [0, 0, 1],
        [1, 0, 0],
        [0, 1, 0],
      ],
    ],
    [
      'COD 4128587 (11504 atoms/cell)',
      COD('4128587'),
      [
        [0, 0, 1],
        [1, 0, 0],
        [0, 1, 0],
      ],
    ],
  ] as const) {
    const firstMs = await openED(page, path);
    const runs = [];
    for (const uvw of axes) runs.push(await timedZone(page, [...uvw]));
    out[label] = {
      firstPatternMs: firstMs,
      medianMs: round(median(runs.map((r) => r.ms))),
      medianComputeMs: round(median(runs.map((r) => r.computeMs))),
      spots: runs.map((r) => r.spots),
    };
  }
  record('ed', out);
});

test('Kikuchi and HOLZ update while tilting', async ({ page }) => {
  const out: Record<string, unknown> = {};
  for (const [label, path] of [
    ['Si', FIXTURE('Si')],
    ['albite', FIXTURE('albite')],
  ] as const) {
    await openED(page, path);
    await page.getByTestId('ed-side-tab-kikuchi').click();
    await page.getByTestId('ed-kikuchi').check();
    await page.getByTestId('ed-rings').check();
    await page.getByTestId('ed-cbed').check();
    await page.locator('[data-testid="ed-tab"] .stage').focus();
    const ms: number[] = [];
    const pattern: number[] = [];
    for (let i = 0; i < 12; i++) {
      const before = await page.evaluate(() => window.__crystallensED.renders());
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction((b) => window.__crystallensED.renders() > b, before);
      await page.waitForTimeout(60);
      const o = await page.evaluate(() => ({
        overlay: window.__crystallensED.overlay().ms,
        pattern: window.__crystallensED.computeMs(),
      }));
      ms.push(o.overlay);
      pattern.push(o.pattern);
    }
    const o = await page.evaluate(() => window.__crystallensED.overlay());
    out[label] = {
      medianOverlayMs: round(median(ms)),
      maxOverlayMs: round(Math.max(...ms)),
      medianPatternMs: round(median(pattern)),
      bands: o.bands,
      holzLines: o.holz,
    };
  }
  record('kikuchi', out);
});

test('Bloch-wave (dynamical) solve', async ({ page }) => {
  const out: Record<string, unknown> = {};
  for (const [label, path, uvw] of [
    ['Si [110]', FIXTURE('Si'), [1, 1, 0]],
    ['albite [001]', FIXTURE('albite'), [0, 0, 1]],
  ] as const) {
    await openED(page, path);
    for (let k = 0; k < 3; k++) await page.getByTestId(`ed-uvw-${k}`).fill(String(uvw[k]));
    await page.getByTestId('ed-uvw-go').click();
    for (const beams of [150, 200, 300, 400]) {
      if (await page.getByTestId('ed-dyn-off').isVisible())
        await page.getByTestId('ed-dyn-off').click();
      await page.getByTestId('ed-dyn-beams').fill(String(beams));
      await page.getByTestId('ed-dyn-calc').click();
      await expect
        .poll(async () => (await page.evaluate(() => window.__crystallensED.dynamic())).shown, {
          timeout: 120_000,
        })
        .toBe(true);
      const d = await page.evaluate(() => window.__crystallensED.dynamic());
      out[`${label}, ${beams} beams`] = { ms: round(d.ms), beams: d.beams };
    }
  }
  record('bloch', out);
});

test('powder pattern update', async ({ page }) => {
  const out: Record<string, unknown> = {};
  for (const [label, path] of [
    ['Si', FIXTURE('Si')],
    ['albite', FIXTURE('albite')],
    ['COD 1552147 (2364 atoms/cell)', COD('1552147')],
    ['COD 4128587 (11504 atoms/cell)', COD('4128587')],
  ] as const) {
    await start(page);
    await timedLoad(page, path);
    await page.getByTestId('tab-xrd').click();
    await expect(page.getByTestId('xrd-hud')).toContainText('peaks');
    const runs: { peaks: number; profile: number }[] = [];
    // change the 2θ range end (peaks and profile both recompute)
    for (const max of [100, 110, 120]) {
      const before = await page.evaluate(() => window.__crystallensXRD.profile()?.last);
      await page.getByTestId('xrd-max').fill(String(max));
      await page.waitForFunction((b) => window.__crystallensXRD.profile()?.last !== b, before, {
        timeout: 120_000,
      });
      runs.push(await page.evaluate(() => window.__crystallensXRD.ms()));
    }
    out[label] = {
      medianMs: round(median(runs.map((r) => r.peaks + r.profile))),
      peaksMs: round(median(runs.map((r) => r.peaks))),
      profileMs: round(median(runs.map((r) => r.profile))),
      peaks: (await page.evaluate(() => window.__crystallensXRD.peaks())).length,
    };
  }
  record('pxrd', out);
});

test('switching between open files, and memory with many open', async ({ page }) => {
  await start(page);
  await timedLoad(page, FIXTURE('albite'));
  await timedLoad(page, FIXTURE('rutile'));
  const times: number[] = [];
  for (let i = 0; i < 6; i++) {
    times.push(
      await page.evaluate(async (i) => {
        const h = window.__crystallens;
        const previous = h.model();
        const before = h.stats().renders;
        const t0 = performance.now();
        const cards = document.querySelectorAll<HTMLButtonElement>(
          '[data-testid="cif-card-select"]',
        );
        cards[i % 2].click();
        await new Promise<void>((resolve) => {
          const loop = () => {
            if (h.model() !== previous && h.stats().renders > before) resolve();
            else requestAnimationFrame(loop);
          };
          loop();
        });
        return performance.now() - t0;
      }, i),
    );
  }
  const heap = () =>
    page.evaluate(
      () =>
        (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize ?? 0,
    );
  const heap2 = await heap();
  for (let i = 0; i < 38; i++) await timedLoad(page, FIXTURE(i % 2 ? 'albite' : 'Si'));
  await expect(page.getByTestId('cif-card')).toHaveCount(40);
  const heap40 = await heap();
  record('multi', {
    switchMedianMs: round(median(times)),
    switchRuns: times.map(round),
    heapMB: { twoOpen: round(heap2 / 2 ** 20), fortyOpen: round(heap40 / 2 ** 20) },
  });
});
