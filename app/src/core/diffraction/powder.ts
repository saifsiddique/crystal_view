/**
 * Powder diffraction, X-ray and neutron (context.md M9).
 *
 * Reflections: every hkl with d >= lambda / (2 sin θ_max) is grouped into classes of symmetry
 * equivalents. The classes are the orbits of hkl under the point-group rotations of the crystal
 * (h → hR, the rows of `Crystal.rotations`) and under Friedel's law (h → −h). A class has
 * multiplicity m = its number of distinct members, and its integrated intensity is
 *
 *     I = |F|² · LP(θ) · Σ_members P(α_j),
 *
 * which is m |F|² LP without preferred orientation. The structure factor is the sum over the
 * de-duplicated unit-cell atoms of occ · f(s) · T(s) · exp(2πi h·x), with f the Waasmaier-Kirfel
 * X-ray factor (the ion's own when `ionic` is set and the CIF gives oxidation states) or the
 * neutron scattering length b, and T = exp(−B s²), s = sinθ/λ (the CIF's own U per atom, or one
 * uniform B).
 *
 * LP = (1 + cos²2θ cos²2θ_m) / (sin²θ cosθ (1 + cos²2θ_m)) for X-rays (2θ_m is the monochromator
 * angle, 0 for none: then (1 + cos²2θ) / (2 sin²θ cosθ)); neutrons have the Lorentz factor only,
 * 1 / (sin²θ cosθ).
 *
 * Preferred orientation is March-Dollase: P(α) = (r² cos²α + sin²α / r)^(−3/2), α the angle between
 * the plane normal and the March axis (a reciprocal vector hkl), r < 1 for plates, r > 1 for needles.
 *
 * Line shape: a pseudo-Voigt, η·Lorentzian + (1 − η)·Gaussian of one FWHM (area-normalised, so the
 * peak area is the integrated intensity), with
 *   FWHM = sqrt(U tan²θ + V tanθ + W)  +  Kλ / (L cosθ)  +  4 ε tanθ,
 * the Caglioti instrument term, Scherrer size broadening (L: crystallite size, K = 0.9) and
 * microstrain ε; the last two are in radians and converted to degrees of 2θ.
 */
import type { Crystal } from '../crystal';
import { CrystalLensError } from '../errors';
import { KALPHA_RATIO } from '../radiation';
import { degToRad, radToDeg } from '../math/trig';
import type { Vec3 } from '../math/vec3';
import { bn, fx, parseSpecies } from '../scattering';
import { atomicU, type Thermal } from './electron';

export class PowderError extends CrystalLensError {}

export type RadiationKind = 'xray' | 'neutron';

/** Scherrer constant. */
export const SCHERRER_K = 0.9;

/** The most hkl classes one calculation may examine. */
export const MAX_REFLECTIONS = 400_000;

export interface PeakParams {
  kind: RadiationKind;
  /** The (Kα₁) wavelength, angstrom. */
  lambda: number;
  twoThetaMin: number;
  twoThetaMax: number;
  /** Zero-point shift added to every 2θ, degrees. */
  zeroShift: number;
  /** Vibration: off, the CIF's own U per atom, or one uniform B (angstrom²). */
  thermal: Thermal;
  /** X-ray only: use ionic factors where the CIF gives oxidation states. */
  ionic: boolean;
  /** Monochromator 2θ_m in degrees (X-ray polarisation), 0 for none. */
  monoAngle: number;
  /** March-Dollase axis and ratio, or null. */
  preferred: { hkl: Vec3; r: number } | null;
  /** Classes weaker than this fraction of the strongest are left out (0.001 = 0.1%). */
  minRelative: number;
}

export interface PowderPeak {
  /** Representative hkl of the class (the lexicographically largest member). */
  hkl: Vec3;
  /** Number of distinct hkl in the class (±hkl and all symmetry equivalents). */
  m: number;
  d: number;
  /** Kα₁ position with the zero shift, degrees. */
  twoTheta: number;
  /** |F| (electrons for X-rays, fm for neutrons) without multiplicity. */
  F: number;
  /** Integrated intensity, relative: 100 for the strongest merged peak. */
  I: number;
  /** The unscaled m |F|² LP P. */
  raw: number;
}

export interface PeakResult {
  peaks: PowderPeak[];
  /** Scale such that I = raw × scale. */
  scale: number;
  warnings: string[];
}

// ---- the polarisation-Lorentz factor and preferred orientation --------------------------------------

/** LP(θ) for θ in radians. */
export function lorentzPolarisation(kind: RadiationKind, theta: number, monoAngle: number): number {
  const s = Math.sin(theta);
  const lorentz = 1 / (s * s * Math.cos(theta));
  if (kind === 'neutron') return lorentz;
  const c2m = Math.cos(degToRad(monoAngle)) ** 2;
  const c2 = Math.cos(2 * theta) ** 2;
  return ((1 + c2 * c2m) / (1 + c2m)) * lorentz;
}

/** March-Dollase factor for the angle α (radians) between a plane normal and the March axis. */
export function marchDollase(r: number, alpha: number): number {
  const c = Math.cos(alpha);
  const sn = Math.sin(alpha);
  return Math.pow(r * r * c * c + (sn * sn) / r, -1.5);
}

// ---- symmetry classes ---------------------------------------------------------------------------------

const key = (h: number, k: number, l: number): string => `${h} ${k} ${l}`;

/** All distinct hkl equivalent to `hkl` under the crystal's rotations and Friedel's law. */
export function equivalentReflections(crystal: Crystal, hkl: Vec3): Vec3[] {
  const seen = new Map<string, Vec3>();
  for (const R of crystal.rotations) {
    // (hR)_j = Σ_i h_i R_ij, the action on Miller indices of x → R x
    const h = Math.round(hkl[0] * R[0][0] + hkl[1] * R[1][0] + hkl[2] * R[2][0]) + 0;
    const k = Math.round(hkl[0] * R[0][1] + hkl[1] * R[1][1] + hkl[2] * R[2][1]) + 0;
    const l = Math.round(hkl[0] * R[0][2] + hkl[1] * R[1][2] + hkl[2] * R[2][2]) + 0;
    seen.set(key(h, k, l), [h, k, l]);
    seen.set(key(-h + 0, -k + 0, -l + 0), [-h + 0, -k + 0, -l + 0]);
  }
  return [...seen.values()];
}

/** The lexicographically largest of the members: h, then k, then l. */
function representative(members: readonly Vec3[]): Vec3 {
  let best = members[0];
  for (const m of members)
    if (
      m[0] > best[0] ||
      (m[0] === best[0] && (m[1] > best[1] || (m[1] === best[1] && m[2] > best[2])))
    )
      best = m;
  return best;
}

// ---- structure factors --------------------------------------------------------------------------------------

interface AtomTable {
  species: string[];
  /** Per atom: index into `species`, occupancy, position, U (angstrom²). */
  sp: Uint16Array;
  occ: Float64Array;
  frac: Float64Array;
  u: Float64Array;
}

function atomTable(crystal: Crystal, kind: RadiationKind, ionic: boolean): AtomTable {
  const names: string[] = [];
  const index = new Map<string, number>();
  const n = crystal.atoms.length;
  const sp = new Uint16Array(n);
  const occ = new Float64Array(n);
  const frac = new Float64Array(3 * n);
  const u = atomicU(crystal);
  crystal.atoms.forEach((a, i) => {
    const site = crystal.sites[a.site];
    let name = a.element;
    if (kind === 'neutron') name = site?.isotope ?? a.element;
    else if (ionic && site?.typeSymbol) name = site.typeSymbol;
    let e = index.get(name);
    if (e === undefined) {
      e = names.length;
      names.push(name);
      index.set(name, e);
    }
    sp[i] = e;
    occ[i] = a.occupancy;
    frac.set(a.frac, 3 * i);
  });
  return { species: names, sp, occ, frac, u };
}

/** The scattering factor of a species at s; ions without a table fall back to the neutral atom. */
function factor(name: string, kind: RadiationKind, s: number): number {
  if (kind === 'neutron') return bn(parseSpecies(name));
  try {
    return fx(parseSpecies(name), s);
  } catch {
    return fx(parseSpecies(name).element, s);
  }
}

/** [Re F, Im F] of one reflection. */
function structureFactor(
  t: AtomTable,
  kind: RadiationKind,
  thermal: Thermal,
  h: number,
  k: number,
  l: number,
  s: number,
  fbuf: Float64Array,
): [number, number] {
  for (let e = 0; e < t.species.length; e++) fbuf[e] = factor(t.species[e], kind, s);
  const s2 = s * s;
  let re = 0;
  let im = 0;
  for (let i = 0; i < t.occ.length; i++) {
    let w = t.occ[i] * fbuf[t.sp[i]];
    if (thermal === true) {
      if (t.u[i] > 0) w *= Math.exp(-8 * Math.PI * Math.PI * t.u[i] * s2);
    } else if (typeof thermal === 'number') w *= Math.exp(-thermal * s2);
    const ph = 2 * Math.PI * (h * t.frac[3 * i] + k * t.frac[3 * i + 1] + l * t.frac[3 * i + 2]);
    re += w * Math.cos(ph);
    im += w * Math.sin(ph);
  }
  return [re, im];
}

// ---- the peak list ---------------------------------------------------------------------------------------------

/** 2θ (degrees) of a plane spacing d, NaN when λ > 2d. */
export const braggTwoTheta = (d: number, lambda: number): number => {
  const x = lambda / (2 * d);
  return x > 1 ? NaN : 2 * radToDeg(Math.asin(x));
};

/**
 * Every reflection class in the 2θ range, with its multiplicity, |F| and intensity. Classes with a
 * (numerically) zero structure factor are absences and are not returned.
 */
export function powderPeaks(crystal: Crystal, p: PeakParams): PeakResult {
  const warnings: string[] = [];
  if (!(p.lambda > 0)) throw new PowderError('The wavelength must be positive.');
  const tMax = Math.min(180, p.twoThetaMax - p.zeroShift);
  if (!(p.twoThetaMax > p.twoThetaMin)) throw new PowderError('The 2θ range is empty.');
  const dMin = p.lambda / (2 * Math.sin(degToRad(tMax / 2)));
  const gMax = 1 / dMin;
  const lat = crystal.lattice;
  const bound = [0, 1, 2].map((i) => Math.floor(gMax * Math.sqrt(lat.G[i][i]) + 1e-9));
  const total = (2 * bound[0] + 1) * (2 * bound[1] + 1) * (2 * bound[2] + 1);
  if (total > 20 * MAX_REFLECTIONS)
    throw new PowderError(
      `The 2θ range reaches d = ${dMin.toFixed(2)} Å: too many reflections for this cell. Lower the upper 2θ limit.`,
    );

  const table = atomTable(crystal, p.kind, p.ionic);
  const fbuf = new Float64Array(table.species.length);
  const B = lat.B;
  const maxMarch = p.preferred ? p.preferred.hkl : null;
  const axis: Vec3 | null = maxMarch
    ? [
        B[0][0] * maxMarch[0] + B[0][1] * maxMarch[1] + B[0][2] * maxMarch[2],
        B[1][0] * maxMarch[0] + B[1][1] * maxMarch[1] + B[1][2] * maxMarch[2],
        B[2][0] * maxMarch[0] + B[2][1] * maxMarch[1] + B[2][2] * maxMarch[2],
      ]
    : null;
  const axisLen = axis ? Math.hypot(...axis) : 0;
  if (p.preferred && !(axisLen > 0)) throw new PowderError('The March-Dollase axis is [0 0 0].');
  if (p.preferred && !(p.preferred.r > 0))
    throw new PowderError('The March-Dollase ratio must be positive.');

  const found: PowderPeak[] = [];
  let examined = 0;
  for (let h = -bound[0]; h <= bound[0]; h++)
    for (let k = -bound[1]; k <= bound[1]; k++)
      for (let l = -bound[2]; l <= bound[2]; l++) {
        // the representative has h > 0, or h = 0 and k > 0, or h = k = 0 and l > 0 (its −hkl is a
        // member too and would be larger otherwise)
        if (h < 0 || (h === 0 && (k < 0 || (k === 0 && l <= 0)))) continue;
        const gx = B[0][0] * h + B[0][1] * k + B[0][2] * l;
        const gy = B[1][0] * h + B[1][1] * k + B[1][2] * l;
        const gz = B[2][0] * h + B[2][1] * k + B[2][2] * l;
        const g = Math.sqrt(gx * gx + gy * gy + gz * gz);
        if (g > gMax || g === 0) continue;
        const d = 1 / g;
        const twoTheta = braggTwoTheta(d, p.lambda) + p.zeroShift;
        if (!(twoTheta >= p.twoThetaMin && twoTheta <= p.twoThetaMax)) continue;
        // only the representative of each class is worked on; the others are skipped
        const members = equivalentReflections(crystal, [h, k, l]);
        const rep = representative(members);
        if (rep[0] !== h || rep[1] !== k || rep[2] !== l) continue;
        if (++examined > MAX_REFLECTIONS)
          throw new PowderError('Too many reflections: lower the upper 2θ limit.');
        const [re, im] = structureFactor(table, p.kind, p.thermal, h, k, l, g / 2, fbuf);
        const F2 = re * re + im * im;
        if (!(F2 > 0)) continue;
        const theta = degToRad((twoTheta - p.zeroShift) / 2);
        let sumP = members.length;
        if (p.preferred && axis) {
          sumP = 0;
          for (const mb of members) {
            const mx = B[0][0] * mb[0] + B[0][1] * mb[1] + B[0][2] * mb[2];
            const my = B[1][0] * mb[0] + B[1][1] * mb[1] + B[1][2] * mb[2];
            const mz = B[2][0] * mb[0] + B[2][1] * mb[1] + B[2][2] * mb[2];
            const c = (mx * axis[0] + my * axis[1] + mz * axis[2]) / (g * axisLen);
            sumP += marchDollase(p.preferred.r, Math.acos(Math.max(-1, Math.min(1, c))));
          }
        }
        const raw = F2 * lorentzPolarisation(p.kind, theta, p.monoAngle) * sumP;
        found.push({ hkl: rep, m: members.length, d, twoTheta, F: Math.sqrt(F2), I: 0, raw });
      }
  found.sort((a, b) => a.twoTheta - b.twoTheta || b.hkl[0] - a.hkl[0]);

  // scale: 100 for the strongest merged peak, then drop what is below the threshold
  const merged = mergePeaks(found);
  const max = merged.reduce((m, g) => Math.max(m, g.raw), 0);
  const scale = max > 0 ? 100 / max : 0;
  for (const f of found) f.I = f.raw * scale;
  // a class whose |F|² is only rounding noise (a forbidden reflection)
  const peaks = found.filter((f) => f.I >= 100 * Math.max(p.minRelative, 1e-9));
  if (peaks.length === 0) warnings.push('No reflections in this 2θ range.');
  return { peaks, scale, warnings };
}

/** Peaks that sit at the same 2θ (within `tol` degrees) merged, as in a measured pattern. */
export interface MergedPeak {
  twoTheta: number;
  d: number;
  /** Total multiplicity and unscaled intensity of the members. */
  m: number;
  raw: number;
  I: number;
  members: PowderPeak[];
}

export function mergePeaks(peaks: readonly PowderPeak[], tol = 1e-5): MergedPeak[] {
  const sorted = [...peaks].sort((a, b) => a.twoTheta - b.twoTheta);
  const out: MergedPeak[] = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(p.twoTheta - last.twoTheta) < tol) {
      last.members.push(p);
      last.m += p.m;
      last.raw += p.raw;
      last.I += p.I;
    } else {
      out.push({ twoTheta: p.twoTheta, d: p.d, m: p.m, raw: p.raw, I: p.I, members: [p] });
    }
  }
  return out;
}

// ---- the profile ---------------------------------------------------------------------------------------------------

export interface ProfileParams {
  /** The Kα₁ wavelength and, when set, Kα₂ with its intensity ratio. */
  lambda: number;
  lambda2: number | null;
  ratio: number;
  twoThetaMin: number;
  twoThetaMax: number;
  step: number;
  zeroShift: number;
  kind: RadiationKind;
  monoAngle: number;
  /** Caglioti U, V, W (degrees²), mixing η (0 Gaussian .. 1 Lorentzian). */
  U: number;
  V: number;
  W: number;
  eta: number;
  /** Crystallite size in nm (0 = no size broadening) and microstrain in per cent. */
  sizeNm: number;
  strainPercent: number;
}

/** FWHM in degrees of 2θ at the Bragg angle θ (radians). */
export function fwhm(p: ProfileParams, theta: number, lambda: number): number {
  const t = Math.tan(theta);
  let w = Math.sqrt(Math.max(p.U * t * t + p.V * t + p.W, 1e-6));
  if (p.sizeNm > 0) w += radToDeg((SCHERRER_K * lambda) / (p.sizeNm * 10 * Math.cos(theta)));
  if (p.strainPercent > 0) w += radToDeg(4 * (p.strainPercent / 100) * t);
  return w;
}

const LN2 = Math.LN2;

/** Area-normalised pseudo-Voigt with full width `w` at offset `x`. */
export function pseudoVoigt(x: number, w: number, eta: number): number {
  const gauss = (2 / w) * Math.sqrt(LN2 / Math.PI) * Math.exp((-4 * LN2 * x * x) / (w * w));
  const lorentz = 2 / (Math.PI * w) / (1 + (4 * x * x) / (w * w));
  return eta * lorentz + (1 - eta) * gauss;
}

export interface Profile {
  twoTheta: Float64Array;
  intensity: Float64Array;
}

/**
 * The pattern: every peak (and its Kα₂ copy) as a pseudo-Voigt. `peaks` are the Kα₁ positions of
 * `powderPeaks`; the result is scaled so that the highest point is 100.
 */
export function powderProfile(peaks: readonly PowderPeak[], p: ProfileParams): Profile {
  if (!(p.step > 0)) throw new PowderError('The step must be positive.');
  const n = Math.floor((p.twoThetaMax - p.twoThetaMin) / p.step + 1e-9) + 1;
  if (n < 2 || n > 2_000_000)
    throw new PowderError('Choose a 2θ range and step giving 2 to 2 million points.');
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = p.twoThetaMin + i * p.step;
  const eta = Math.min(1, Math.max(0, p.eta));

  const add = (centre: number, area: number, theta: number, lambda: number) => {
    const w = fwhm(p, theta, lambda);
    // ±(8 widths) holds 99.9% of a Gaussian; a Lorentzian tail beyond is below 1%
    const reach = 8 * w;
    const i0 = Math.max(0, Math.ceil((centre - reach - p.twoThetaMin) / p.step));
    const i1 = Math.min(n - 1, Math.floor((centre + reach - p.twoThetaMin) / p.step));
    for (let i = i0; i <= i1; i++) y[i] += area * pseudoVoigt(x[i] - centre, w, eta);
  };

  for (const pk of peaks) {
    const theta = degToRad((pk.twoTheta - p.zeroShift) / 2);
    add(pk.twoTheta, pk.I, theta, p.lambda);
    if (p.lambda2) {
      const x2 = pk.d > 0 ? braggTwoTheta(pk.d, p.lambda2) : NaN;
      if (Number.isFinite(x2)) {
        const th2 = degToRad(x2 / 2);
        const lp1 = lorentzPolarisation(p.kind, theta, p.monoAngle);
        const lp2 = lorentzPolarisation(p.kind, th2, p.monoAngle);
        add(x2 + p.zeroShift, pk.I * p.ratio * (lp2 / lp1), th2, p.lambda2);
      }
    }
  }
  let max = 0;
  for (let i = 0; i < n; i++) if (y[i] > max) max = y[i];
  if (max > 0) for (let i = 0; i < n; i++) y[i] *= 100 / max;
  return { twoTheta: x, intensity: y };
}

export { KALPHA_RATIO };
