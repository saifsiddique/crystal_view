import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFirstStructure } from '../../src/core/cif';
import { buildCrystal, type Crystal } from '../../src/core/crystal';
import {
  braggTwoTheta,
  equivalentReflections,
  fwhm,
  lorentzPolarisation,
  marchDollase,
  mergePeaks,
  powderPeaks,
  powderProfile,
  pseudoVoigt,
  PowderError,
  type PeakParams,
  type ProfileParams,
} from '../../src/core/diffraction/powder';
import { XRAY_DOUBLETS } from '../../src/core/radiation';
import { bn } from '../../src/core/scattering';
import { fixtureDir, fixtures, names } from './helpers/fixtures';

const load = (name: string): Crystal =>
  buildCrystal(parseFirstStructure(readFileSync(`${fixtureDir}cifs/${name}.cif`, 'utf8')).structure)
    .crystal;
const crystals: Record<string, Crystal> = Object.fromEntries(names.map((n) => [n, load(n)]));

const peakParams = (extra: Partial<PeakParams> = {}): PeakParams => ({
  kind: 'xray',
  lambda: 1.54184,
  twoThetaMin: 10,
  twoThetaMax: 90,
  zeroShift: 0,
  thermal: false,
  ionic: false,
  monoAngle: 0,
  preferred: null,
  minRelative: 1e-5,
  ...extra,
});

describe('multiplicities from the point group and Friedel pairs', () => {
  const m = (name: string, hkl: [number, number, number]) =>
    equivalentReflections(crystals[name], hkl).length;
  it('cubic m-3m: 111 -> 8, 200 -> 6, 220 -> 12, 311 -> 24, 321 -> 48, 410 and 330', () => {
    expect([
      m('Si', [1, 1, 1]),
      m('Si', [2, 0, 0]),
      m('Si', [2, 2, 0]),
      m('Si', [3, 1, 1]),
    ]).toEqual([8, 6, 12, 24]);
    expect([m('Si', [3, 2, 1]), m('Si', [4, 1, 0]), m('Si', [3, 3, 0])]).toEqual([48, 24, 12]);
  });
  it('tetragonal 4/mmm (rutile): 110 -> 4, 101 -> 8, 001 -> 2, 111 -> 8, 121 -> 16', () => {
    expect([
      m('rutile', [1, 1, 0]),
      m('rutile', [1, 0, 1]),
      m('rutile', [0, 0, 1]),
      m('rutile', [1, 1, 1]),
      m('rutile', [1, 2, 1]),
    ]).toEqual([4, 8, 2, 8, 16]);
  });
  it('hexagonal 6/mmm (graphite, hexagonal axes): 100 -> 6, 001 -> 2, 101 -> 12, 110 -> 6', () => {
    expect([
      m('graphite', [1, 0, 0]),
      m('graphite', [0, 0, 1]),
      m('graphite', [1, 0, 1]),
      m('graphite', [1, 1, 0]),
    ]).toEqual([6, 2, 12, 6]);
  });
  it('monoclinic 2/m: general hkl -> 4, 0k0 -> 2; triclinic -1: always 2', () => {
    expect([m('ZrO2_baddeleyite', [1, 2, 3]), m('ZrO2_baddeleyite', [0, 1, 0])]).toEqual([4, 2]);
    expect([m('albite', [1, 2, 3]), m('albite', [1, 0, 0])]).toEqual([2, 2]);
  });
  it('orthorhombic mmm: general hkl -> 8, h00 -> 2 (olivine)', () => {
    expect([m('olivine_partial', [1, 2, 3]), m('olivine_partial', [2, 0, 0])]).toEqual([8, 2]);
  });
});

describe('Friedel pairs join the classes of a non-centrosymmetric crystal', () => {
  // zinc blende, F-43m: no inversion centre, so the point group alone gives 4 for (111) and 24 for (321)
  const zincBlende = buildCrystal(
    parseFirstStructure(`data_ZnS
_cell_length_a 5.4093
_cell_length_b 5.4093
_cell_length_c 5.4093
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_symmetry_space_group_name_H-M 'F -4 3 m'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
Zn1 Zn 0 0 0
S1 S 0.25 0.25 0.25
`).structure,
  ).crystal;

  it('the point group has no inversion; (111) has 4 + 4 members and (321) has 24 + 24', () => {
    expect(zincBlende.spaceGroup.centrosymmetric).toBe(false);
    expect(zincBlende.rotations.length).toBe(24);
    expect(equivalentReflections(zincBlende, [1, 1, 1]).length).toBe(8);
    expect(equivalentReflections(zincBlende, [3, 2, 1]).length).toBe(48);
  });

  it('the powder pattern counts them: m(111) = 8, as for a centrosymmetric cubic crystal', () => {
    const r = powderPeaks(zincBlende, peakParams({ lambda: 1.5405929 }));
    const p111 = r.peaks.find((p) => p.hkl.join() === '1,1,1')!;
    expect(p111.m).toBe(8);
    // both (111) and (-1-1-1) scatter with the same |F| (no anomalous scattering in this model)
    expect(p111.F).toBeGreaterThan(0);
  });
});

describe('X-ray peaks against the pymatgen fixtures (Cu Kα average 1.54184 Å, no Kα₂, no Debye-Waller)', () => {
  for (const name of names) {
    it(name, () => {
      const fx = fixtures[name].pxrd;
      const result = powderPeaks(
        crystals[name],
        peakParams({
          lambda: fx.wavelength,
          twoThetaMin: fx.two_theta_range[0],
          twoThetaMax: fx.two_theta_range[1],
        }),
      );
      const merged = mergePeaks(result.peaks);
      // the same peaks, merged at equal 2θ like pymatgen
      expect(merged.length).toBe(fx.peaks.length);
      for (const ref of fx.peaks) {
        const ours = merged.reduce((best, g) =>
          Math.abs(g.twoTheta - ref.two_theta) < Math.abs(best.twoTheta - ref.two_theta) ? g : best,
        );
        // positions to 1e-6° (the fixture is rounded to 10 digits), multiplicities exactly
        expect(Math.abs(ours.twoTheta - ref.two_theta)).toBeLessThan(1e-6);
        expect(ours.d).toBeCloseTo(ref.d, 6);
        expect(ours.m).toBe(ref.hkls.reduce((a, h) => a + h.m, 0));
        // intensities: our Waasmaier-Kirfel factors against pymatgen's own table, on the 0-100
        // scale. Measured worst for peaks above 1%: 0.58 (ZrO2). The plan asks for 3%.
        if (ref.intensity > 1)
          expect(Math.abs(ours.I - ref.intensity)).toBeLessThan(0.03 * Math.max(ref.intensity, 20));
      }
      expect(Math.max(...merged.map((g) => g.I))).toBeCloseTo(100, 9);
    });
  }
});

describe('structure factors, neutron scattering and thermal factors', () => {
  it('NaCl neutron: |F(111)| = 4 |b_Na − b_Cl| and |F(200)| = 4 (b_Na + b_Cl)', () => {
    const r = powderPeaks(
      crystals.NaCl,
      peakParams({ kind: 'neutron', lambda: 1.5, twoThetaMax: 120 }),
    );
    const at = (h: number, k: number, l: number) =>
      r.peaks.find((p) => p.hkl.join() === [h, k, l].join())!;
    const bNa = bn('Na');
    const bCl = bn('Cl');
    expect(at(1, 1, 1).F).toBeCloseTo(4 * Math.abs(bNa - bCl), 6);
    expect(at(2, 0, 0).F).toBeCloseTo(4 * (bNa + bCl), 6);
    // neutrons have no form-factor fall-off: |F| of (400) equals that of (200) without vibration
    expect(at(4, 0, 0).F).toBeCloseTo(4 * (bNa + bCl), 6);
  });

  it('forbidden reflections are not returned (Si 200, 222 absent; 111, 220 present)', () => {
    const keys = powderPeaks(crystals.Si, peakParams({ twoThetaMax: 120 })).peaks.map((p) =>
      p.hkl.join(' '),
    );
    expect(keys).toContain('1 1 1');
    expect(keys).toContain('2 2 0');
    expect(keys).not.toContain('2 0 0');
    expect(keys).not.toContain('2 2 2');
  });

  it('a uniform B damps by exp(−B s²) in |F|² · ... and B = 0 equals no vibration', () => {
    const base = powderPeaks(crystals.NaCl, peakParams());
    const off = powderPeaks(crystals.NaCl, peakParams({ thermal: 0 }));
    const b = powderPeaks(crystals.NaCl, peakParams({ thermal: 1.5 }));
    base.peaks.forEach((p, i) => expect(off.peaks[i].F).toBeCloseTo(p.F, 9));
    for (const p of base.peaks) {
      const q = b.peaks.find((x) => x.hkl.join() === p.hkl.join())!;
      const s = 1 / (2 * p.d);
      expect(q.F / p.F).toBeCloseTo(Math.exp(-1.5 * s * s), 9);
    }
    // the CIF's own U (true) differs from the undamped pattern and damps high angles more
    // (NaCl's CIF has no displacement parameters; albite's has U_iso for every site)
    const plain = powderPeaks(crystals.albite, peakParams());
    const cif = powderPeaks(crystals.albite, peakParams({ thermal: true }));
    const ratioOf = (p: { hkl: readonly number[]; F: number }) =>
      p.F / plain.peaks.find((q) => q.hkl.join() === p.hkl.join())!.F;
    const first = cif.peaks.find((p) => p.d > 6)!; // a low-angle peak
    const last = cif.peaks[cif.peaks.length - 1];
    expect(ratioOf(first)).toBeGreaterThan(ratioOf(last));
    expect(ratioOf(last)).toBeLessThan(0.9);
    const none = powderPeaks(crystals.NaCl, peakParams({ thermal: true }));
    none.peaks.forEach((p, i) => expect(p.F).toBeCloseTo(base.peaks[i].F, 9));
  });

  it('ionic factors change the low-angle intensities of NaCl and nothing else about the positions', () => {
    const neutral = powderPeaks(crystals.NaCl, peakParams());
    const ionic = powderPeaks(crystals.NaCl, peakParams({ ionic: true }));
    expect(ionic.peaks.map((p) => p.twoTheta)).toEqual(neutral.peaks.map((p) => p.twoTheta));
    expect(ionic.peaks[0].F).not.toBeCloseTo(neutral.peaks[0].F, 3);
  });

  it('errors are typed: empty range, absurd range, bad March axis', () => {
    expect(() =>
      powderPeaks(crystals.Si, peakParams({ twoThetaMin: 50, twoThetaMax: 40 })),
    ).toThrow(PowderError);
    expect(() => powderPeaks(crystals.Si, peakParams({ lambda: 0 }))).toThrow(PowderError);
    expect(() =>
      powderPeaks(crystals.Si, peakParams({ preferred: { hkl: [0, 0, 0], r: 0.8 } })),
    ).toThrow(/axis/);
  });
});

describe('Lorentz-polarisation factor', () => {
  it('without a monochromator it is (1 + cos²2θ) / (2 sin²θ cosθ); neutrons have 1 / (sin²θ cosθ)', () => {
    const th = (30 * Math.PI) / 180;
    expect(lorentzPolarisation('xray', th, 0)).toBeCloseTo(
      (1 + Math.cos(2 * th) ** 2) / (2 * Math.sin(th) ** 2 * Math.cos(th)),
      12,
    );
    expect(lorentzPolarisation('neutron', th, 0)).toBeCloseTo(
      1 / (Math.sin(th) ** 2 * Math.cos(th)),
      12,
    );
  });
  it('a graphite monochromator (2θ_m = 26.6°) changes it and a 90° one removes the polarisation term', () => {
    const th = (20 * Math.PI) / 180;
    const none = lorentzPolarisation('xray', th, 0);
    const graphite = lorentzPolarisation('xray', th, 26.6);
    expect(graphite).not.toBeCloseTo(none, 3);
    // cos²(2θ_m) = 0: (1 + 0) / (1 + 0) = Lorentz only
    expect(lorentzPolarisation('xray', th, 90)).toBeCloseTo(
      1 / (Math.sin(th) ** 2 * Math.cos(th)),
      12,
    );
  });
});

describe('preferred orientation (March-Dollase)', () => {
  it('r = 1 changes nothing; plates (r < 1) along 001 strengthen 00l and weaken hk0 of graphite', () => {
    const none = powderPeaks(crystals.graphite, peakParams());
    const unit = powderPeaks(
      crystals.graphite,
      peakParams({ preferred: { hkl: [0, 0, 1], r: 1 } }),
    );
    none.peaks.forEach((p, i) => expect(unit.peaks[i].I).toBeCloseTo(p.I, 9));
    const plates = powderPeaks(
      crystals.graphite,
      peakParams({ preferred: { hkl: [0, 0, 1], r: 0.6 } }),
    );
    const rel = (key: string) =>
      plates.peaks.find((p) => p.hkl.join() === key)!.raw /
      none.peaks.find((p) => p.hkl.join() === key)!.raw;
    expect(rel('0,0,2')).toBeGreaterThan(1.3); // along the axis: α = 0, P = r^(−3)
    expect(rel('0,0,2')).toBeCloseTo(0.6 ** -3, 6);
    expect(rel('1,0,0')).toBeCloseTo(0.6 ** 1.5, 6); // perpendicular: P = r^(3/2)
  });
  it('the factor itself: α = 0 gives r^(−3), α = 90° gives r^(3/2)', () => {
    expect(marchDollase(0.5, 0)).toBeCloseTo(0.5 ** -3, 12);
    expect(marchDollase(0.5, Math.PI / 2)).toBeCloseTo(0.5 ** 1.5, 12);
    expect(marchDollase(1, 0.7)).toBeCloseTo(1, 12);
  });
});

describe('profile', () => {
  const prof = (extra: Partial<ProfileParams> = {}): ProfileParams => ({
    lambda: 1.5405929,
    lambda2: null,
    ratio: 0.5,
    twoThetaMin: 10,
    twoThetaMax: 90,
    step: 0.01,
    zeroShift: 0,
    kind: 'xray',
    monoAngle: 0,
    U: 0.01,
    V: -0.005,
    W: 0.005,
    eta: 0.5,
    sizeNm: 0,
    strainPercent: 0,
    ...extra,
  });
  const peaks = (extra: Partial<PeakParams> = {}) =>
    powderPeaks(crystals.Si, peakParams({ lambda: 1.5405929, ...extra })).peaks;

  it('a pseudo-Voigt is area-normalised and has the requested FWHM at η = 0 and η = 1', () => {
    for (const eta of [0, 0.5, 1]) {
      let area = 0;
      const dx = 0.002;
      for (let x = -40; x <= 40; x += dx) area += pseudoVoigt(x, 0.2, eta) * dx;
      // a Lorentzian keeps 0.5% of its area beyond ±40 widths
      expect(area).toBeGreaterThan(eta === 1 ? 0.99 : 0.999);
      expect(area).toBeLessThan(1.0001);
    }
    for (const eta of [0, 1])
      expect(pseudoVoigt(0.1, 0.2, eta)).toBeCloseTo(pseudoVoigt(0, 0.2, eta) / 2, 9);
  });

  it('Caglioti width, Scherrer size and microstrain', () => {
    const th = (14.2 * Math.PI) / 180;
    const t = Math.tan(th);
    const p = prof();
    expect(fwhm(p, th, 1.54)).toBeCloseTo(Math.sqrt(0.01 * t * t - 0.005 * t + 0.005), 12);
    // Scherrer: K λ / (L cos θ) in degrees; 10 nm at 28.4° 2θ with Cu Kα1
    const scherrer = (0.9 * 1.5405929 * 180) / (Math.PI * 100 * Math.cos(th));
    expect(fwhm(prof({ sizeNm: 10 }), th, 1.5405929) - fwhm(p, th, 1.5405929)).toBeCloseTo(
      scherrer,
      9,
    );
    expect(fwhm(prof({ strainPercent: 0.1 }), th, 1.5) - fwhm(p, th, 1.5)).toBeCloseTo(
      (180 / Math.PI) * 4 * 0.001 * t,
      12,
    );
    // smaller crystals, broader peaks
    expect(fwhm(prof({ sizeNm: 5 }), th, 1.54)).toBeGreaterThan(
      fwhm(prof({ sizeNm: 50 }), th, 1.54),
    );
  });

  it('the pattern peaks at the Bragg positions, is scaled to 100 and the zero shift moves everything', () => {
    const pk = peaks();
    const a = powderProfile(pk, prof());
    expect(Math.max(...a.intensity)).toBeCloseTo(100, 9);
    const top = a.twoTheta[a.intensity.indexOf(Math.max(...a.intensity))];
    expect(Math.abs(top - pk.find((p) => p.hkl.join() === '1,1,1')!.twoTheta)).toBeLessThan(0.011);
    const shifted = powderProfile(peaks({ zeroShift: 0.1 }), prof({ zeroShift: 0.1 }));
    const top2 = shifted.twoTheta[shifted.intensity.indexOf(Math.max(...shifted.intensity))];
    expect(top2 - top).toBeCloseTo(0.1, 2);
  });

  it('Kα₂ adds a second line at the longer wavelength with half the intensity', () => {
    const cu = XRAY_DOUBLETS.find((d) => d.id === 'CuKa')!;
    const pk = peaks({ lambda: cu.lambda1, twoThetaMin: 80, twoThetaMax: 100 });
    // a high-angle peak where the doublet is resolved: Si (400) at about 69.1° and (331) at 76.4°
    const p = prof({
      lambda: cu.lambda1,
      lambda2: cu.lambda2,
      twoThetaMin: 60,
      twoThetaMax: 100,
      step: 0.005,
      U: 0,
      V: 0,
      W: 0.0004,
    });
    const high = peaks({ lambda: cu.lambda1, twoThetaMin: 60, twoThetaMax: 100 });
    expect(high.length).toBeGreaterThan(1);
    const doublet = powderProfile(high, p);
    const single = powderProfile(high, { ...p, lambda2: null });
    expect(pk.length).toBeGreaterThan(0);
    const first = high[0];
    const pos2 = braggTwoTheta(first.d, cu.lambda2);
    const at = (profile: ReturnType<typeof powderProfile>, x: number) =>
      profile.intensity[Math.round((x - 60) / 0.005)];
    // at the Kα₂ position the doublet pattern is clearly above the single-line pattern
    expect(at(doublet, pos2)).toBeGreaterThan(5 * (at(single, pos2) + 1e-6));
    expect(pos2).toBeGreaterThan(first.twoTheta);
    // the two heights are in the ratio 0.5 × (LP₂/LP₁) / (width ratio)
    expect(at(doublet, pos2) / at(doublet, first.twoTheta)).toBeGreaterThan(0.35);
    expect(at(doublet, pos2) / at(doublet, first.twoTheta)).toBeLessThan(0.65);
  });

  it('validates its input', () => {
    expect(() => powderProfile([], prof({ step: 0 }))).toThrow(PowderError);
    expect(() => powderProfile([], prof({ twoThetaMax: 10 }))).toThrow(PowderError);
  });
});

describe('speed', () => {
  it('peaks and profile for the largest fixture (albite, 5-90°, 0.02° step) in under 200 ms', () => {
    const times: number[] = [];
    for (let i = 0; i < 6; i++) {
      const t0 = performance.now();
      const r = powderPeaks(crystals.albite, peakParams({ twoThetaMin: 5, thermal: true }));
      powderProfile(r.peaks, {
        lambda: 1.54184,
        lambda2: 1.54439,
        ratio: 0.5,
        twoThetaMin: 5,
        twoThetaMax: 90,
        step: 0.02,
        zeroShift: 0,
        kind: 'xray',
        monoAngle: 0,
        U: 0.01,
        V: -0.005,
        W: 0.005,
        eta: 0.5,
        sizeNm: 0,
        strainPercent: 0,
      });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThan(200);
  });
});
