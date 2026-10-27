import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFirstStructure } from '../../src/core/cif';
import { buildCrystal, type Crystal } from '../../src/core/crystal';
import {
  detectorFrame,
  electronWavelength,
  excitationError,
} from '../../src/core/diffraction/electron';
import {
  approximateRingRadius,
  defaultKikuchiParams,
  discRadius,
  holzLines,
  kikuchiBands,
  laueRings,
  NO_STRAIN,
  type Frame,
  type HolzParams,
} from '../../src/core/diffraction/kikuchi';
import { hklToCart, uvwToCart } from '../../src/core/lattice';
import { cross, dot, normalize, type Vec3 } from '../../src/core/math/vec3';
import { defaultUp, rotateView } from '../../src/core/orientation';
import { fixtureDir } from './helpers/fixtures';

const load = (name: string): Crystal =>
  buildCrystal(parseFirstStructure(readFileSync(`${fixtureDir}cifs/${name}.cif`, 'utf8')).structure)
    .crystal;
const Si = load('Si');

function frameAlong(c: Crystal, uvw: Vec3): Frame {
  const d = uvwToCart(c.lattice, uvw);
  return detectorFrame(d, defaultUp(c.lattice, d));
}

const kikuchi = (c: Crystal, f: Frame, voltage = 300) =>
  kikuchiBands(c, f, { ...defaultKikuchiParams(), voltage });

describe('Kikuchi bands', () => {
  it('on a zone axis each band is symmetric about the centre and 2θ_B wide', () => {
    const lambda = electronWavelength(300);
    const bands = kikuchi(Si, frameAlong(Si, [0, 0, 1]));
    expect(bands.length).toBeGreaterThan(10);
    for (const b of bands) {
      if (Math.abs(b.hkl[2]) > 0) continue; // planes of the zone: g in the detector plane
      expect(b.D1).toBeCloseTo(-b.g / 2, 9);
      expect(b.D2).toBeCloseTo(b.g / 2, 9);
      // width in angle = λ × width in 1/Å = λ|g| = 2 sin θ_B ≈ 2 θ_B
      const twoTheta = 2 * Math.asin((lambda * b.g) / 2);
      expect(((b.D2 - b.D1) * lambda) / twoTheta - 1).toBeLessThan(1e-3);
      expect(((b.D2 - b.D1) * lambda) / (2 * Math.asin((lambda * b.g) / 2))).toBeCloseTo(1, 3);
    }
    // the {220} bands of Si [001] are present and the forbidden {200} is not
    expect(
      bands.some(
        (b) => b.hkl.every((x) => Math.abs(x) === 0 || Math.abs(x) === 2) && b.hkl[2] === 0,
      ),
    ).toBe(true);
    expect(bands.some((b) => b.hkl.join() === '2,0,0')).toBe(false);
  });

  it('a tilted band passes through the gnomonic image of every direction in its plane', () => {
    // exact check, no small-angle approximation: for a crystal direction u ⟂ g the screen point is
    // P = k u⊥ / (u·beam), and P·e must be the centre of the band, (D₁ + D₂) / 2
    const lambda = electronWavelength(300);
    const k = 1 / lambda;
    const f0 = frameAlong(Si, [1, 1, 0]);
    const turned = rotateView({ direction: f0.beam, up: f0.up }, { right: 2.1, upward: -1.4 });
    const f = detectorFrame(turned.direction, turned.up);
    const bands = kikuchi(Si, f);
    expect(bands.length).toBeGreaterThan(10);
    for (const b of bands.slice(0, 40)) {
      const g = hklToCart(Si.lattice, b.hkl);
      const trial: Vec3 = Math.abs(g[0]) < 0.8 * Math.hypot(...g) ? [1, 0, 0] : [0, 1, 0];
      for (const seed of [trial, [0, 0, 1] as Vec3]) {
        const u = normalize(cross(g, seed));
        if (!u) continue;
        const uz = dot(u, f.beam);
        if (Math.abs(uz) < 0.2) continue;
        const px = (k * dot(u, f.right)) / uz;
        const py = (k * dot(u, f.up)) / uz;
        expect(px * b.ex + py * b.ey).toBeCloseTo((b.D1 + b.D2) / 2, 8);
      }
    }
  });

  it('the line is where the exact Bragg condition holds (small-angle error < 1e-3 1/Å)', () => {
    const lambda = electronWavelength(300);
    const k = 1 / lambda;
    const f = frameAlong(Si, [0, 0, 1]);
    const b = kikuchi(Si, f).find((x) => x.hkl.join() === '2,2,0')!;
    for (const along of [-0.3, 0, 0.3]) {
      // a point on the first line, moved along it; the incident direction that points there
      const px = b.D1 * b.ex - along * b.ey;
      const py = b.D1 * b.ey + along * b.ex;
      const K: Vec3 = [
        k * f.beam[0] + px * f.right[0] + py * f.up[0],
        k * f.beam[1] + px * f.right[1] + py * f.up[1],
        k * f.beam[2] + px * f.right[2] + py * f.up[2],
      ];
      const dir = normalize(K)!;
      const g = hklToCart(Si.lattice, b.hkl);
      expect(Math.abs(excitationError(dir, lambda, g))).toBeLessThan(1e-3);
    }
  });

  it('strain scales the reciprocal lattice: +1% on a makes the (220) band 1% narrower', () => {
    const f = frameAlong(Si, [0, 0, 1]);
    const plain = kikuchi(Si, f).find((x) => x.hkl.join() === '2,2,0')!;
    const strained = kikuchiBands(Si, f, {
      ...defaultKikuchiParams(),
      strain: [0.01, 0.01, 0.01],
    }).find((x) => x.hkl.join() === '2,2,0')!;
    expect((strained.D2 - strained.D1) / (plain.D2 - plain.D1)).toBeCloseTo(1 / 1.01, 9);
    // a single axis moves only the planes that have an index along it
    const onlyC = kikuchiBands(Si, f, { ...defaultKikuchiParams(), strain: [0, 0, 0.02] }).find(
      (x) => x.hkl.join() === '2,2,0',
    )!;
    expect(onlyC.D2 - onlyC.D1).toBeCloseTo(plain.D2 - plain.D1, 9);
  });

  it('is fast once the structure factors are cached (albite, 50 ms budget)', () => {
    const albite = load('albite');
    const f = frameAlong(albite, [0, 0, 1]);
    kikuchi(albite, f); // fills the cache (once per crystal)
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t = rotateView({ direction: f.beam, up: f.up }, { right: 0.3 * i });
      const t0 = performance.now();
      kikuchi(albite, detectorFrame(t.direction, t.up));
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThan(50); // the typical frame
    expect(times[times.length - 1]).toBeLessThan(200); // the worst (a GC pause, a busy CPU)
  });
});

describe('Laue-zone rings', () => {
  const ringParams = (zoneAxis: Vec3, extra = {}) => ({
    voltage: 300,
    zoneAxis,
    debyeWaller: true,
    strain: NO_STRAIN,
    nMax: 3,
    ...extra,
  });

  it('Si [111]: the FOLZ radius is sqrt(2kH − H²) with H = 1/(a√3), ≈ sqrt(2H/λ)', () => {
    const lambda = electronWavelength(300);
    const H = 1 / (Si.cell.a * Math.sqrt(3));
    const [n1] = laueRings(Si, frameAlong(Si, [1, 1, 1]), ringParams([1, 1, 1]));
    expect(n1.n).toBe(1);
    expect(n1.H).toBeCloseTo(H, 12);
    expect(n1.radius).toBeCloseTo(Math.sqrt((2 * H) / lambda - H * H), 9);
    expect(n1.radius / approximateRingRadius(H, lambda) - 1).toBeGreaterThan(-2e-3);
    expect(Math.abs(n1.radius / approximateRingRadius(H, lambda) - 1)).toBeLessThan(2e-3);
    expect(n1.radius).toBeCloseTo(3.3, 1); // 3.3 1/Å (about 66 mrad)
    expect([n1.cx, n1.cy]).toEqual([expect.closeTo(0, 9), expect.closeTo(0, 9)]);
    expect(n1.allowed).toBe(true);
  });

  it('centring: Si [110] has no first-order ring (h + k = 1 is mixed parity) but a second-order one', () => {
    const rings = laueRings(Si, frameAlong(Si, [1, 1, 0]), ringParams([1, 1, 0]));
    expect(rings.map((r) => r.allowed)).toEqual([false, true, false]);
    expect(rings[1].H).toBeCloseTo(2 / (Si.cell.a * Math.sqrt(2)), 12);
    const si001 = laueRings(Si, frameAlong(Si, [0, 0, 1]), ringParams([0, 0, 1]));
    expect(si001.map((r) => r.allowed)).toEqual([true, true, true]);
  });

  it('the voltage sets the radius: 120 kV rings are smaller than 300 kV rings', () => {
    const f = frameAlong(Si, [0, 0, 1]);
    const a = laueRings(Si, f, ringParams([0, 0, 1]))[0].radius;
    const b = laueRings(Si, f, ringParams([0, 0, 1], { voltage: 120 }))[0].radius;
    expect(b / a).toBeCloseTo(Math.sqrt(electronWavelength(300) / electronWavelength(120)), 2);
  });

  it('strain moves the ring: +1% on c along [001] shrinks H by 1%', () => {
    const f = frameAlong(Si, [0, 0, 1]);
    const plain = laueRings(Si, f, ringParams([0, 0, 1]))[0];
    const strained = laueRings(Si, f, ringParams([0, 0, 1], { strain: [0, 0, 0.01] }))[0];
    expect(strained.H / plain.H).toBeCloseTo(1 / 1.01, 9);
    expect(strained.radius).toBeLessThan(plain.radius);
  });

  it('a tilted beam shifts the ring centre in the direction of the zone axis', () => {
    const f0 = frameAlong(Si, [0, 0, 1]);
    const t = rotateView({ direction: f0.beam, up: f0.up }, { right: 2 });
    const f = detectorFrame(t.direction, t.up);
    const ring = laueRings(Si, f, ringParams([0, 0, 1]))[0];
    expect(Math.hypot(ring.cx, ring.cy)).toBeGreaterThan(0.5);
    // the circle's centre is the Ewald-sphere centre's projection on the layer plane, seen on the
    // screen: (k cos φ − H) r̂ projected, which is about k sin φ = 1.77 1/Å for a 2° tilt
    const rHat = normalize(uvwToCart(Si.lattice, [0, 0, 1]))!;
    const k = 1 / electronWavelength(300);
    const along = k * dot(f.beam, rHat) - ring.H;
    expect(ring.cx).toBeCloseTo(along * dot(rHat, f.right), 9);
    expect(ring.cy).toBeCloseTo(along * dot(rHat, f.up), 9);
    expect(Math.hypot(ring.cx, ring.cy)).toBeCloseTo(k * Math.sin((2 * Math.PI) / 180), 1);
  });
});

describe('HOLZ lines in the central disc', () => {
  const holzParams = (zoneAxis: Vec3, extra: Partial<HolzParams> = {}): HolzParams => ({
    voltage: 300,
    zoneAxis,
    debyeWaller: true,
    strain: NO_STRAIN,
    alpha: 0.025,
    maxZone: 2,
    minIntensity: 1e-6,
    ...extra,
  });

  it('the disc radius is α/λ', () => {
    expect(discRadius(0.01, 300)).toBeCloseTo(0.01 / electronWavelength(300), 12);
  });

  it('on the axis a line is at D = (G² − |g⊥|²) / (2|g⊥|): it crosses the centre on the ring', () => {
    const lambda = electronWavelength(300);
    const k = 1 / lambda;
    const lines = holzLines(Si, frameAlong(Si, [1, 1, 1]), holzParams([1, 1, 1]));
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const H = 1 / (Si.cell.a * Math.sqrt(3));
    for (const l of lines) {
      expect(Math.abs(l.zone)).toBe(1);
      const G2 = 2 * k * H - H * H;
      expect(l.D).toBeCloseTo((G2 - l.gPerp * l.gPerp) / (2 * l.gPerp), 6);
      expect(Math.abs(l.D)).toBeLessThan(discRadius(0.025, 300));
      expect(l.half).toBeCloseTo(Math.sqrt(discRadius(0.025, 300) ** 2 - l.D * l.D), 12);
    }
  });

  it('Si [111] has three-fold symmetry: rotating the lines by 120° gives the same set', () => {
    const lines = holzLines(Si, frameAlong(Si, [1, 1, 1]), holzParams([1, 1, 1], { alpha: 0.04 }));
    expect(lines.length).toBeGreaterThanOrEqual(6);
    const turn = (deg: number) =>
      lines.map((l) => {
        let a = (Math.atan2(l.ey, l.ex) * 180) / Math.PI + deg;
        a = ((a % 360) + 360) % 360;
        return { a, D: l.D, I: l.I };
      });
    const base = turn(0);
    const rotated = turn(120);
    for (const r of rotated) {
      const match = base.find(
        (b) =>
          Math.abs(((b.a - r.a + 540) % 360) - 180) < 1e-4 &&
          Math.abs(b.D - r.D) < 1e-6 &&
          Math.abs(b.I - r.I) < 1e-9 * Math.max(1, r.I),
      );
      expect(match, `no line matches ${JSON.stringify(r)}`).toBeDefined();
    }
    // and not six-fold: the 60° rotation does not map the set onto itself
    const sixty = turn(60);
    const same = sixty.every((r) =>
      base.some(
        (b) =>
          Math.abs(((b.a - r.a + 540) % 360) - 180) < 1e-4 &&
          Math.abs(b.D - r.D) < 1e-6 &&
          Math.abs(b.I - r.I) < 1e-9 * Math.max(1, r.I),
      ),
    );
    expect(same).toBe(false);
  });

  it('a larger convergence angle shows more lines; zero shows none', () => {
    const f = frameAlong(Si, [0, 0, 1]);
    const n = (alpha: number) => holzLines(Si, f, holzParams([0, 0, 1], { alpha })).length;
    expect(n(0)).toBe(0);
    expect(n(0.01)).toBeLessThan(n(0.03));
    expect(n(0.03)).toBeGreaterThan(0);
  });

  it('strain shifts the lines (the basis of HOLZ strain sensitivity)', () => {
    const f = frameAlong(Si, [0, 0, 1]);
    const plain = holzLines(Si, f, holzParams([0, 0, 1], { alpha: 0.05 }));
    const strained = holzLines(
      Si,
      f,
      holzParams([0, 0, 1], { alpha: 0.05, strain: [0, 0, 0.005] }),
    );
    const key = (l: { hkl: Vec3 }) => l.hkl.join();
    const byKey = new Map(plain.map((l) => [key(l), l]));
    let moved = 0;
    for (const s of strained) {
      const p = byKey.get(key(s));
      if (p && Math.abs(p.D - s.D) > 0.005) moved++;
    }
    expect(moved).toBeGreaterThan(2);
  });

  it('is fast once the structure factors are cached (albite, 50 ms budget)', () => {
    const albite = load('albite');
    const f = frameAlong(albite, [0, 0, 1]);
    const p = holzParams([0, 0, 1], { alpha: 0.02 });
    holzLines(albite, f, p);
    laueRings(albite, f, { ...p, nMax: 3 });
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t = rotateView({ direction: f.beam, up: f.up }, { right: 0.2 * i });
      const fr = detectorFrame(t.direction, t.up);
      const t0 = performance.now();
      holzLines(albite, fr, p);
      laueRings(albite, fr, { ...p, nMax: 3 });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThan(50); // the typical frame
    expect(times[times.length - 1]).toBeLessThan(200); // the worst (a GC pause, a busy CPU)
  });
});
