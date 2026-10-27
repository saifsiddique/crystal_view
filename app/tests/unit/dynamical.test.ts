import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFirstStructure } from '../../src/core/cif';
import { buildCrystal, type Crystal } from '../../src/core/crystal';
import {
  beamIntensities,
  blochProblem,
  dynamicalPattern,
  extinctionDistance,
  solveBloch,
  type BlochGeometry,
  type BlochMatrices,
} from '../../src/core/diffraction/dynamical';
import {
  electronStructureFactor,
  electronWavelength,
  relativisticGamma,
} from '../../src/core/diffraction/electron';
import { hklToCart, uvwToCart } from '../../src/core/lattice';
import { hermitianEigen, symmetricEigen } from '../../src/core/math/hermitian';
import type { Vec3 } from '../../src/core/math/vec3';
import { defaultUp } from '../../src/core/orientation';
import { defaultEDSettings, parseEDSettings } from '../../src/state/settings';
import { fixtureDir } from './helpers/fixtures';

const load = (name: string): Crystal =>
  buildCrystal(parseFirstStructure(readFileSync(`${fixtureDir}cifs/${name}.cif`, 'utf8')).structure)
    .crystal;
const Si = load('Si');

/** Deterministic pseudo-random numbers in [-0.5, 0.5). */
function lcg(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296 - 0.5;
  };
}

function randomHermitian(n: number, seed: number) {
  const rnd = lcg(seed);
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);
  for (let r = 0; r < n; r++)
    for (let c = 0; c <= r; c++) {
      const a = rnd();
      const b = r === c ? 0 : rnd();
      re[r * n + c] = re[c * n + r] = a;
      im[r * n + c] = b;
      im[c * n + r] = -b;
    }
  return { re, im };
}

/** max |H v - lambda v| and max |V†V - 1| of a decomposition. */
function errors(re: Float64Array, im: Float64Array, n: number) {
  const e = hermitianEigen(re, im, n);
  let residual = 0;
  let orth = 0;
  for (let j = 0; j < n; j++)
    for (let r = 0; r < n; r++) {
      let sr = 0;
      let si = 0;
      for (let c = 0; c < n; c++) {
        sr += re[r * n + c] * e.re[c * n + j] - im[r * n + c] * e.im[c * n + j];
        si += re[r * n + c] * e.im[c * n + j] + im[r * n + c] * e.re[c * n + j];
      }
      residual = Math.max(
        residual,
        Math.hypot(sr - e.values[j] * e.re[r * n + j], si - e.values[j] * e.im[r * n + j]),
      );
    }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let sr = 0;
      let si = 0;
      for (let r = 0; r < n; r++) {
        sr += e.re[r * n + i] * e.re[r * n + j] + e.im[r * n + i] * e.im[r * n + j];
        si += e.re[r * n + i] * e.im[r * n + j] - e.im[r * n + i] * e.re[r * n + j];
      }
      orth = Math.max(orth, Math.hypot(sr - (i === j ? 1 : 0), si));
    }
  return { residual, orth, values: e.values };
}

describe('Hermitian eigen-decomposition', () => {
  it('a real symmetric 2 × 2 has the textbook eigenvalues', () => {
    const d = symmetricEigen(Float64Array.from([2, 1, 1, 2]), 2);
    expect([...d].sort()).toEqual([1, 3].map((x) => expect.closeTo(x, 14)));
  });
  it('random complex Hermitian matrices: residual and orthonormality at rounding level', () => {
    for (const [n, seed] of [
      [1, 1],
      [2, 2],
      [7, 3],
      [40, 4],
    ]) {
      const { re, im } = randomHermitian(n, seed);
      const e = errors(re, im, n);
      expect(e.residual).toBeLessThan(1e-12);
      expect(e.orth).toBeLessThan(1e-12);
      for (let j = 1; j < n; j++) expect(e.values[j]).toBeGreaterThanOrEqual(e.values[j - 1]);
    }
  });
  it('degenerate eigenvalues still give a full orthonormal set (one of each v, i·v pair)', () => {
    // H = W diag(1, 1, 1, 2, 2, 5) W† with a unitary W from a random Hermitian matrix
    const n = 6;
    const { re, im } = randomHermitian(n, 9);
    const W = hermitianEigen(re, im, n);
    const lam = [1, 1, 1, 2, 2, 5];
    const hr = new Float64Array(n * n);
    const hi = new Float64Array(n * n);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        for (let k = 0; k < n; k++) {
          // W_rk lam_k conj(W_ck)
          const ar = W.re[r * n + k];
          const ai = W.im[r * n + k];
          const br = W.re[c * n + k];
          const bi = -W.im[c * n + k];
          hr[r * n + c] += lam[k] * (ar * br - ai * bi);
          hi[r * n + c] += lam[k] * (ar * bi + ai * br);
        }
    const e = errors(hr, hi, n);
    expect(e.residual).toBeLessThan(1e-12);
    expect(e.orth).toBeLessThan(1e-12);
    expect([...e.values].map((v) => Math.round(v * 1e9) / 1e9)).toEqual(lam);
  });
  it('a diagonal matrix (already tridiagonal, nothing to reduce)', () => {
    const e = errors(Float64Array.from([3, 0, 0, 0, -1, 0, 0, 0, 3]), new Float64Array(9), 3);
    expect([...e.values]).toEqual([-1, 3, 3]);
    expect(e.orth).toBeLessThan(1e-14);
  });
});

/** Two beams (000, g) with coupling U and excitation error s, no absorption. */
function twoBeam(U: number, s: number, K: number): BlochMatrices {
  return {
    n: 2,
    K,
    aRe: Float64Array.from([0, U, U, 2 * K * s]),
    aIm: new Float64Array(4),
    pRe: new Float64Array(4),
    pIm: new Float64Array(4),
  };
}

describe('two-beam limit (pendellösung)', () => {
  const kV = 200;
  const lambda = electronWavelength(kV);
  const K = 1 / lambda;
  const [fr, fi] = electronStructureFactor(Si, [2, 2, 0], { debyeWaller: false });
  const U = (relativisticGamma(kV) / (Math.PI * Si.lattice.volume)) * Math.hypot(fr, fi);
  const xi = 1 / (lambda * U);

  it('at the Bragg angle I_g = sin²(πt/ξ_g) with ξ_g = 1/(λ|U_g|)', () => {
    expect(extinctionDistance(Si, [2, 2, 0], kV)).toBeCloseTo(xi, 9);
    const sol = solveBloch(twoBeam(U, 0, K));
    for (const t of [0, 50, 0.25 * xi, 0.5 * xi, xi, 1234]) {
      const I = beamIntensities(sol, t);
      const want = Math.sin((Math.PI * t) / xi) ** 2;
      expect(I[1]).toBeCloseTo(want, 9);
      expect(I[0] + I[1]).toBeCloseTo(1, 12);
    }
  });
  it('off the Bragg angle I_g = sin²(πt s_eff)/(ξ s_eff)², s_eff = √(s² + 1/ξ²)', () => {
    for (const s of [2e-3, -5e-3, 0.02]) {
      const sol = solveBloch(twoBeam(U, s, K));
      const seff = Math.hypot(s, 1 / xi);
      for (const t of [100, 400, 900]) {
        const want = Math.sin(Math.PI * t * seff) ** 2 / (xi * seff) ** 2;
        // the eigenvalue equation is linearised in gamma, as is this textbook formula
        expect(Math.abs(beamIntensities(sol, t)[1] - want)).toBeLessThan(
          0.01 * Math.max(want, 1e-3),
        );
      }
    }
  });
  it('extinction distances of Si at 100 kV match the tables (602, 757, 1268 Å) to 4%', () => {
    // Hirsch et al.; Williams & Carter table 13.1 (no Debye-Waller factor)
    const table: [Vec3, number][] = [
      [[1, 1, 1], 602],
      [[2, 2, 0], 757],
      [[4, 0, 0], 1268],
    ];
    for (const [hkl, want] of table)
      expect(Math.abs(extinctionDistance(Si, hkl, 100) / want - 1)).toBeLessThan(0.04);
  });
});

describe('absorption inside a degenerate group', () => {
  it('is diagonalised there first: an exact case, I_1 = exp(-2ap) sinh²(ar), a = 2πt/2K', () => {
    // beams 0 and 1 degenerate (both d), beam 2 apart; A' couples 0 and 1 only. Without the
    // diagonalisation, q of the (arbitrary) basis vectors e0, e1 would leave beam 1 dark.
    const K = 50;
    const d = 0.3;
    const pv = 0.004;
    const r = 0.0015;
    const sol = solveBloch({
      n: 3,
      K,
      aRe: Float64Array.from([d, 0, 0, 0, d, 0, 0, 0, -0.2]),
      aIm: new Float64Array(9),
      pRe: Float64Array.from([pv, r, 0, r, pv, 0, 0, 0, pv]),
      pIm: new Float64Array(9),
    });
    for (const t of [100, 1000, 3000]) {
      const a = (2 * Math.PI * t) / (2 * K);
      const I = beamIntensities(sol, t);
      expect(I[1]).toBeCloseTo(Math.exp(-2 * a * pv) * Math.sinh(a * r) ** 2, 12);
      expect(I[0]).toBeCloseTo(Math.exp(-2 * a * pv) * Math.cosh(a * r) ** 2, 12);
      expect(I[2]).toBeCloseTo(0, 14);
    }
  });
});

function along(c: Crystal, uvw: Vec3, extra: Partial<BlochGeometry> = {}): BlochGeometry {
  const d = uvwToCart(c.lattice, uvw);
  return {
    direction: d,
    up: defaultUp(c.lattice, d),
    zoneAxis: uvw,
    voltage: 200,
    debyeWaller: true,
    maxZone: 0,
    beams: 60,
    absorption: 0,
    ...extra,
  };
}

const key = (hkl: Vec3) => hkl.join(' ');

describe('Bloch-wave spot patterns', () => {
  it('two beams built from the crystal: Si 2 2 0 at and near the Bragg angle', () => {
    // k0 = K (cos t n - sin t g/|g|) with n perpendicular to g; sin t = |g| / 2K puts 2 2 0 on
    // the Ewald sphere. n is not a symmetry direction ([001] would put 2 0 0 and 0 2 0 on it too).
    const kV = 200;
    const K = 1 / electronWavelength(kV);
    const g = hklToCart(Si.lattice, [2, 2, 0]);
    const gl = Math.hypot(...g);
    const xi = extinctionDistance(Si, [2, 2, 0], kV);
    for (const tilt of [0, 1.5e-3]) {
      const sin = gl / (2 * K) + tilt;
      const cos = Math.sqrt(1 - sin * sin);
      const nl = Math.hypot(1, 1, 0.37);
      const nv: Vec3 = [1 / nl, -1 / nl, 0.37 / nl];
      const dir = (i: number) => cos * nv[i] - (sin * g[i]) / gl;
      const direction: Vec3 = [dir(0), dir(1), dir(2)];
      const p = blochProblem(Si, {
        ...along(Si, [0, 0, 1], { voltage: kV, beams: 2, debyeWaller: false }),
        direction,
        up: [0, 0, 1],
      });
      expect(p.beams[1].hkl).toEqual([2, 2, 0]);
      const s = p.beams[1].s;
      if (tilt === 0) expect(Math.abs(s)).toBeLessThan(1e-12);
      else expect(Math.abs(s)).toBeGreaterThan(5e-4); // comparable to 1/xi, about 1e-3
      const seff = Math.hypot(s, 1 / xi);
      const sol = solveBloch(p);
      for (const t of [150, 500]) {
        const want = Math.sin(Math.PI * t * seff) ** 2 / (xi * seff) ** 2;
        expect(Math.abs(beamIntensities(sol, t)[1] / want - 1)).toBeLessThan(0.01);
      }
    }
  });
  it('the result does not depend on the order of the beams (degenerate Bloch waves with absorption)', () => {
    // At the exact [001] zone axis many Bloch waves are degenerate; their absorption must be
    // found by diagonalising A' inside each group, or the answer depends on an arbitrary basis.
    const p = blochProblem(Si, along(Si, [0, 0, 1], { beams: 90, absorption: 0.1 }));
    const n = p.n;
    // keep 000 first, reverse the others
    const order = [0, ...Array.from({ length: n - 1 }, (_, i) => n - 1 - i)];
    const perm = (a: Float64Array) => {
      const out = new Float64Array(n * n);
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) out[r * n + c] = a[order[r] * n + order[c]];
      return out;
    };
    const a = beamIntensities(solveBloch(p), 800);
    const b = beamIntensities(
      solveBloch({
        n,
        K: p.K,
        aRe: perm(p.aRe),
        aIm: perm(p.aIm),
        pRe: perm(p.pRe),
        pIm: perm(p.pIm),
      }),
      800,
    );
    for (let i = 0; i < n; i++) expect(b[i]).toBeCloseTo(a[order[i]], 8);
  });
  it('beams: 000 first, nearest the Ewald sphere next, no centring absences', () => {
    const p = blochProblem(Si, along(Si, [1, 1, 0], { beams: 80 }));
    expect(p.n).toBe(80);
    expect(p.beams[0].hkl).toEqual([0, 0, 0]);
    for (let i = 2; i < p.n; i++)
      expect(Math.abs(p.beams[i].s)).toBeGreaterThanOrEqual(Math.abs(p.beams[i - 1].s) - 1e-15);
    // F centring: h, k, l all even or all odd
    for (const b of p.beams) {
      const odd = b.hkl.map((x) => Math.abs(x) % 2);
      expect(odd[0] === odd[1] && odd[1] === odd[2]).toBe(true);
    }
    // the diamond-glide absence 002 is a beam (and flagged kinematically forbidden)
    const b002 = p.beams.find((b) => key(b.hkl) === '0 0 2');
    expect(b002?.forbidden).toBe(true);
  });
  it('without absorption the beams carry all the intensity at every thickness', () => {
    const sol = solveBloch(blochProblem(Si, along(Si, [1, 1, 0], { beams: 100 })));
    for (const t of [0, 100, 500, 2000]) {
      const I = beamIntensities(sol, t);
      expect(I.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
    expect(beamIntensities(sol, 0)[0]).toBeCloseTo(1, 12);
  });
  it('absorption only takes intensity away, more for thicker crystals', () => {
    const sol = solveBloch(blochProblem(Si, along(Si, [1, 1, 0], { absorption: 0.1 })));
    let last = 1 + 1e-12;
    for (const t of [0, 200, 500, 1000, 2000]) {
      const total = beamIntensities(sol, t).reduce((a, b) => a + b, 0);
      expect(total).toBeLessThan(last);
      last = total;
    }
    expect(last).toBeLessThan(0.7);
    expect(sol.q.every((q) => q > 0)).toBe(true);
  });
  it('Si [110] at 200 kV: the forbidden 002 is lit by double diffraction', () => {
    const p = blochProblem(Si, along(Si, [1, 1, 0], { beams: 100, absorption: 0.1 }));
    const i002 = p.beams.findIndex((b) => key(b.hkl) === '0 0 2');
    const sol = solveBloch(p);
    const best = Math.max(...[100, 200, 400, 800].map((t) => beamIntensities(sol, t)[i002]));
    expect(best).toBeGreaterThan(1e-2);
  });
  it('symmetry: at the exact zone axis, equivalent beams have equal intensities (with absorption)', () => {
    // Si [001]: the projection has 4mm symmetry; 220, -220, 2-20, -2-20 must agree
    for (const absorption of [0, 0.1]) {
      const p = blochProblem(Si, along(Si, [0, 0, 1], { beams: 120, absorption }));
      const I = beamIntensities(solveBloch(p), 600);
      const at = (hkl: string) => I[p.beams.findIndex((b) => key(b.hkl) === hkl)];
      const ref = at('2 2 0');
      expect(ref).toBeGreaterThan(1e-3);
      for (const h of ['-2 2 0', '2 -2 0', '-2 -2 0']) expect(at(h)).toBeCloseTo(ref, 8);
      expect(at('4 0 0')).toBeCloseTo(at('0 -4 0'), 8);
    }
  });
  it('a very thin crystal is kinematic: I_g ≈ (π t λ |U_g|)²', () => {
    const kV = 200;
    const t = 3;
    const p = blochProblem(Si, along(Si, [1, 1, 0], { voltage: kV, beams: 60 }));
    const I = beamIntensities(solveBloch(p), t);
    const lambda = electronWavelength(kV);
    const factor = relativisticGamma(kV) / (Math.PI * Si.lattice.volume);
    for (const h of ['1 -1 1', '2 -2 0', '0 0 4']) {
      const i = p.beams.findIndex((b) => key(b.hkl) === h);
      const want = (Math.PI * t * lambda * factor * p.beams[i].F) ** 2;
      expect(Math.abs(I[i] / want - 1)).toBeLessThan(0.02);
    }
  });
  it('the pattern: I relative to the strongest diffracted beam, fraction of the incident beam kept', () => {
    const p = blochProblem(Si, along(Si, [1, 1, 0], { absorption: 0.1 }));
    const I = beamIntensities(solveBloch(p), 300);
    const view = dynamicalPattern(p, I);
    expect(view.pattern.spots.length).toBe(p.n - 1);
    expect(Math.max(...view.pattern.spots.map((s) => s.I))).toBe(1);
    expect(view.transmitted).toBe(I[0]);
    const s002 = view.pattern.spots.find((s) => key(s.hkl) === '0 0 2')!;
    expect(s002.forbidden).toBe(false);
    expect(s002.kinematicallyForbidden).toBe(true);
    expect(s002.fraction).toBe(I[p.beams.findIndex((b) => key(b.hkl) === '0 0 2')]);
    expect(view.total).toBeLessThan(1);
  });
  it('other structures solve too (tilted off the zone axis, HOLZ beams, low symmetry)', () => {
    for (const [name, uvw] of [
      ['rutile', [0, 0, 1]],
      ['graphite', [0, 0, 1]],
      ['albite', [0, 0, 1]],
    ] as [string, Vec3][]) {
      const c = load(name);
      const g = along(c, uvw, { beams: 80, maxZone: 1, absorption: 0.05 });
      const d = g.direction;
      g.direction = [d[0] + 0.02 * Math.hypot(...d), d[1], d[2]];
      const I = beamIntensities(solveBloch(blochProblem(c, g)), 400);
      expect(I.every((x) => x >= 0 && x <= 1)).toBe(true);
      expect(I.reduce((a, b) => a + b, 0)).toBeLessThan(1);
    }
  });
  it('rejects bad input', () => {
    expect(() => blochProblem(Si, along(Si, [1, 1, 0], { beams: 1 }))).toThrow(/beams/);
    expect(() => blochProblem(Si, along(Si, [1, 1, 0], { beams: 401 }))).toThrow(/beams/);
    expect(() => blochProblem(Si, along(Si, [1, 1, 0], { absorption: -0.1 }))).toThrow(
      /absorption/,
    );
  });
  it('speed: 200 beams solve in under 1 s (median of 3; the plan target)', () => {
    const p = blochProblem(Si, along(Si, [1, 1, 0], { beams: 200, absorption: 0.1 }));
    const times = [0, 1, 2].map(() => {
      const t0 = performance.now();
      solveBloch(p);
      return performance.now() - t0;
    });
    expect(times.sort((a, b) => a - b)[1]).toBeLessThan(1000);
  }, 20000);
});

describe('settings', () => {
  it('beams and absorption have defaults and survive a round trip', () => {
    const s = defaultEDSettings();
    expect([s.dynBeams, s.absorption]).toEqual([150, 0.1]);
    s.dynBeams = 220;
    s.absorption = 0.05;
    expect(parseEDSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const bad = parseEDSettings({ dynBeams: 1, absorption: -1 });
    expect([bad.dynBeams, bad.absorption]).toEqual([150, 0.1]);
    expect(parseEDSettings({ dynBeams: 1000 }).dynBeams).toBe(150);
  });
});
