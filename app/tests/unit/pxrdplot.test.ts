import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFirstStructure } from '../../src/core/cif';
import { buildCrystal, type Crystal } from '../../src/core/crystal';
import {
  electronStructureFactor,
  kinematicPattern,
  meanB,
} from '../../src/core/diffraction/electron';
import { uvwToCart } from '../../src/core/lattice';
import { defaultUp } from '../../src/core/orientation';
import {
  axisTitle,
  axisValue,
  lowerBound,
  niceTicks,
  peaksToCsv,
  thinLabels,
  tickText,
  twoThetaOf,
  yTransform,
} from '../../src/plots/pxrdPlot';
import {
  defaultEDSettings,
  defaultPXRDSettings,
  parseEDSettings,
  parsePXRDSettings,
} from '../../src/state/settings';
import { fixtureDir } from './helpers/fixtures';

const load = (name: string): Crystal =>
  buildCrystal(parseFirstStructure(readFileSync(`${fixtureDir}cifs/${name}.cif`, 'utf8')).structure)
    .crystal;

describe('plot axes', () => {
  const lambda = 1.5405929;
  it('2θ, d and Q round-trip and all three grow to the right', () => {
    for (const axis of ['tt', 'd', 'Q'] as const) {
      let last = -Infinity;
      for (const tt of [10, 28.4, 60, 120]) {
        const u = axisValue(axis, tt, lambda);
        expect(u).toBeGreaterThan(last);
        last = u;
        expect(twoThetaOf(axis, u, lambda)).toBeCloseTo(tt, 9);
      }
    }
  });
  it('the values are the textbook ones: d = λ/(2 sinθ), Q = 2π/d', () => {
    const tt = 28.443;
    const d = lambda / (2 * Math.sin((tt / 2) * (Math.PI / 180)));
    expect(-axisValue('d', tt, lambda)).toBeCloseTo(d, 12);
    expect(axisValue('Q', tt, lambda)).toBeCloseTo((2 * Math.PI) / d, 12);
    expect(tickText('d', axisValue('d', tt, lambda))).toBe(d.toFixed(2));
    expect(axisTitle('Q')).toContain('2π/d');
  });
  it('there is no 2θ beyond Q = 4π/λ or for d < λ/2', () => {
    expect(twoThetaOf('Q', (4 * Math.PI) / lambda + 0.1, lambda)).toBeNaN();
    expect(twoThetaOf('d', -0.3, lambda)).toBeNaN();
  });
  it('tick labels are tidy', () => {
    expect(tickText('tt', 30)).toBe('30');
    expect(tickText('tt', 12.5)).toBe('12.5');
    expect(tickText('Q', 0.25)).toBe('0.25');
    expect(tickText('d', -3.5)).toBe('3.5');
  });
});

describe('ticks and labels', () => {
  it('niceTicks gives round steps of 1, 2 or 5 times a power of ten', () => {
    expect(niceTicks(0, 100, 10)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    // the step is the first of 1, 2, 5 × 10ⁿ at least (range / count): never more ticks than asked
    expect(niceTicks(5, 90, 8)).toEqual([20, 40, 60, 80]);
    expect(niceTicks(5, 90, 12)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90]);
    expect(niceTicks(0.1, 0.9, 4)).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(niceTicks(3, 3)).toEqual([]);
    expect(niceTicks(0, Infinity)).toEqual([]);
  });
  it('thinLabels keeps the strongest and drops neighbours closer than the gap', () => {
    const spots = [
      { index: 0, x: 100, priority: 5 },
      { index: 1, x: 105, priority: 9 },
      { index: 2, x: 140, priority: 1 },
      { index: 3, x: 103, priority: 2 },
    ];
    expect(thinLabels(spots, 12)).toEqual([1, 2]);
    expect(thinLabels(spots, 12, 1)).toEqual([1]);
  });
  it('lowerBound is a binary search', () => {
    const a = [1, 2, 4, 4, 8];
    expect([lowerBound(a, 0), lowerBound(a, 4), lowerBound(a, 5), lowerBound(a, 9)]).toEqual([
      0, 2, 4, 5,
    ]);
  });
  it('the √ scale maps 0..100 to 0..10', () => {
    expect(yTransform(100, 'sqrt')).toBe(10);
    expect(yTransform(-3, 'sqrt')).toBe(0);
    expect(yTransform(50, 'linear')).toBe(50);
  });
});

describe('CSV export', () => {
  it('has a header, one line per peak and numbers with fixed decimals', () => {
    const csv = peaksToCsv([
      { hkl: [1, 1, 1], m: 8, d: 3.13560123456, twoTheta: 28.44, F: 12.5, I: 100 },
      { hkl: [-1, 0, 2], m: 4, d: 1.5, twoTheta: 61.8, F: 1.25, I: 0.5 },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('h,k,l,multiplicity,d_angstrom,two_theta_deg,F,I_rel');
    expect(lines[1]).toBe('1,1,1,8,3.135601,28.44000,12.50000,100.0000');
    expect(lines[2].startsWith('-1,0,2,4,1.500000')).toBe(true);
    expect(lines.length).toBe(3);
  });
});

describe('PXRDSettings', () => {
  it('start at Cu Kα₁, 5-90°, the CIF thermal values and no Kα₂', () => {
    const s = defaultPXRDSettings();
    expect([s.radiation, s.kalpha2, s.twoThetaMin, s.twoThetaMax]).toEqual(['CuKa', false, 5, 90]);
    expect([s.debyeWaller, s.debyeWallerB]).toEqual([true, null]);
  });
  it('survive a JSON round trip; bad values fall back to the defaults', () => {
    const s = defaultPXRDSettings();
    Object.assign(s, {
      radiation: 'neutron',
      wavelength: 1.8,
      kalpha2: true,
      twoThetaMin: 10,
      twoThetaMax: 120,
      step: 0.05,
      U: 0.02,
      eta: 0.8,
      sizeNm: 25,
      zeroShift: 0.1,
      monoAngle: 26.6,
      preferred: true,
      preferredHkl: [1, 1, 0],
      preferredR: 0.8,
      debyeWallerB: 1.2,
      ionic: true,
      axis: 'Q',
      intensityScale: 'sqrt',
      labels: false,
      minPercent: 1,
    });
    expect(parsePXRDSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(
      parsePXRDSettings({
        radiation: 'laser',
        wavelength: -1,
        twoThetaMin: 100,
        twoThetaMax: 50,
        step: 0,
        eta: 3,
        preferredHkl: [0, 0, 0],
        debyeWallerB: -2,
        axis: 'k',
      }),
    ).toEqual(defaultPXRDSettings());
    expect(parsePXRDSettings(undefined)).toEqual(defaultPXRDSettings());
  });
  it('the ED settings gained the Debye-Waller box and the Kikuchi band count', () => {
    const s = defaultEDSettings();
    expect([s.kikuchiBands, s.debyeWallerB]).toEqual([20, null]);
    s.kikuchiBands = 7;
    s.debyeWallerB = 2.5;
    expect(parseEDSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const bad = parseEDSettings({ kikuchiBands: 0, debyeWallerB: -1 });
    expect([bad.kikuchiBands, bad.debyeWallerB]).toEqual([20, null]);
    expect(parseEDSettings({ kikuchiBands: 1000 }).kikuchiBands).toBe(20);
  });
});

describe('Debye-Waller B', () => {
  it('meanB is the occupancy-weighted 8π²U of the CIF, 0 when the CIF has none', () => {
    expect(meanB(load('NaCl'))).toBe(0);
    const rutile = load('rutile');
    expect(meanB(rutile)).toBeGreaterThan(0.3);
    expect(meanB(rutile)).toBeLessThan(1);
    // all Uiso of one value: mean B = 8 pi² U
    expect(meanB(load('albite'))).toBeGreaterThan(0.5);
  });
  it('a uniform B equal to zero is no vibration; the CIF mean B gives a similar, not equal, damping', () => {
    const c = load('rutile');
    const [r0, i0] = electronStructureFactor(c, [3, 1, 0], { debyeWaller: false });
    const [r1, i1] = electronStructureFactor(c, [3, 1, 0], { debyeWaller: 0 });
    expect([r1, i1]).toEqual([r0, i0]);
    const plain = Math.hypot(r0, i0);
    const uniform = Math.hypot(...electronStructureFactor(c, [3, 1, 0], { debyeWaller: meanB(c) }));
    const perAtom = Math.hypot(...electronStructureFactor(c, [3, 1, 0], { debyeWaller: true }));
    expect(uniform).toBeLessThan(plain);
    expect(perAtom).toBeLessThan(plain);
    expect(Math.abs(uniform / perAtom - 1)).toBeLessThan(0.25);
    expect(uniform).not.toBeCloseTo(perAtom, 6);
  });
  it('the pattern uses the typed B: a larger B dims the high-order spots more', () => {
    const c = load('rutile');
    const d = uvwToCart(c.lattice, [0, 0, 1]);
    const geom = (debyeWaller: boolean | number) => ({
      direction: d,
      up: defaultUp(c.lattice, d),
      zoneAxis: [0, 0, 1] as [number, number, number],
      voltage: 300,
      thickness: 100,
      gMax: 2,
      maxZone: 0,
      profile: 'none' as const,
      debyeWaller,
      minIntensity: 0,
      includeForbidden: false,
    });
    const small = kinematicPattern(c, geom(0.2)).spots;
    const large = kinematicPattern(c, geom(3)).spots;
    const far = (spots: typeof small) => spots.reduce((a, b) => (b.g > a.g ? b : a));
    expect(far(large).I / far(small).I).toBeLessThan(0.5);
  });
});
