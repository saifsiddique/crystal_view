/**
 * Dynamical electron diffraction by the Bloch-wave method (context.md M11), spot pattern only.
 *
 * For an incident wave k0 (|k0| = K = 1/lambda) along the beam, and beams g_0 = 000, g_1, ... the
 * Bloch-wave coefficients C^(j) and eigenvalues gamma^(j) solve A C = 2K gamma C with
 *   A_gg = 2K s_g,  A_gh = U_{g-h}  (g != h),
 *   U_g = (gamma_rel / (pi V)) F_e(g)  (angstrom^-2; F_e in angstrom, as in M8).
 * The surface normal is taken along the beam. Absorption is the usual first-order perturbation
 * with U'_g = kappa U_g: each Bloch wave decays as exp(-2 pi q^(j) t), q^(j) = C^(j)† A' C^(j) / 2K,
 * where A' has U'_{g-h} everywhere, U'_0 on the diagonal. Inside a degenerate eigenvalue group
 * A' is diagonalised first (degenerate perturbation theory), so q is well defined.
 * The amplitude of beam g after thickness t is
 *   psi_g(t) = sum_j C_0^(j)* C_g^(j) exp(2 pi i gamma^(j) t) exp(-2 pi q^(j) t),
 * and I_g = |psi_g|^2 is a fraction of the incident intensity (sum = 1 without absorption).
 *
 * The work is split so that the slow part can run in a worker: `blochProblem` (main thread: beam
 * selection and the structure matrix), `solveBloch` (pure numbers in, pure numbers out: the
 * eigen-decomposition), `beamIntensities` (cheap; reruns for every thickness).
 */
import type { Crystal } from '../crystal';
import { hermitianEigen } from '../math/hermitian';
import type { Vec3 } from '../math/vec3';
import {
  DiffractionError,
  detectorFrame,
  electronStructureFactor,
  electronWavelength,
  forEachLaue,
  reducedZoneAxis,
  reflectionStrength,
  relativisticGamma,
  type Pattern,
  type Spot,
  type Thermal,
} from './electron';

export interface BlochGeometry {
  /** Beam direction (Cartesian, any length) and screen-up, as in M8. */
  direction: Vec3;
  up: Vec3;
  /** Zone axis the Laue zones are counted from. */
  zoneAxis: Vec3;
  voltage: number;
  debyeWaller: Thermal;
  /** Laue zones |n| <= maxZone are candidates for beams. */
  maxZone: number;
  /** Number of beams, 000 included. */
  beams: number;
  /** Absorption: U'_g = kappa U_g. */
  absorption: number;
}

/** Candidates are reflections with |g| <= this (1/angstrom) and |s_g| <= MAX_EXCITATION. */
export const BEAM_G_MAX = 4;
export const MAX_EXCITATION = 0.2;
export const MAX_BEAMS = 400;

export interface Beam {
  hkl: Vec3;
  /** Detector position (1/angstrom), |g|, excitation error, Laue zone. */
  x: number;
  y: number;
  g: number;
  s: number;
  zone: number;
  /** |F_e| (angstrom) and the M8 "forbidden" flag: such beams are lit only by multiple scattering. */
  F: number;
  forbidden: boolean;
}

/** Everything the eigen-solver needs, as plain numbers (structured-clone friendly). */
export interface BlochMatrices {
  n: number;
  /** K = 1/lambda (1/angstrom). */
  K: number;
  /** A (real, imaginary) and the absorption matrix A' (real, imaginary), row-major n × n. */
  aRe: Float64Array;
  aIm: Float64Array;
  pRe: Float64Array;
  pIm: Float64Array;
}

export interface BlochProblem extends BlochMatrices {
  beams: Beam[];
  lambda: number;
  zoneAxis: Vec3;
  beam: Vec3;
  right: Vec3;
  up: Vec3;
  /** Largest |g| among the beams. */
  gReach: number;
}

/** What `beamIntensities` needs: gamma^(j), q^(j) and the products C_0^(j)* C_g^(j) (g row, j column). */
export interface BlochSolution {
  n: number;
  gamma: Float64Array;
  q: Float64Array;
  ampRe: Float64Array;
  ampIm: Float64Array;
}

/** True when a pure translation of the space group (lattice centring) extinguishes hkl. */
function centringAbsent(translations: Vec3[], h: number, k: number, l: number): boolean {
  for (const t of translations) {
    const p = h * t[0] + k * t[1] + l * t[2];
    if (Math.abs(p - Math.round(p)) > 1e-6) return true;
  }
  return false;
}

const isIdentity = (R: readonly (readonly number[])[]) =>
  R.every((row, i) => row.every((x, j) => x === (i === j ? 1 : 0)));

/**
 * Picks the beams and builds the structure matrix. Beams are 000 and the reflections of the Laue
 * zones |n| <= maxZone with |g| <= BEAM_G_MAX and |s_g| <= MAX_EXCITATION, nearest the Ewald sphere
 * first. Reflections extinguished by lattice centring are skipped: every U coupling them to the
 * other beams is zero. Space-group-forbidden reflections that are not centring absences (Si 002)
 * stay, since double diffraction lights them.
 */
export function blochProblem(crystal: Crystal, geometry: BlochGeometry): BlochProblem {
  const { beam, right, up } = detectorFrame(geometry.direction, geometry.up);
  const uvw = reducedZoneAxis(geometry.zoneAxis);
  const lambda = electronWavelength(geometry.voltage);
  const K = 1 / lambda;
  const nBeams = Math.floor(geometry.beams);
  if (!(nBeams >= 2 && nBeams <= MAX_BEAMS))
    throw new DiffractionError(`The number of beams must be 2 to ${MAX_BEAMS}.`);
  const kappa = geometry.absorption;
  if (!(kappa >= 0 && Number.isFinite(kappa)))
    throw new DiffractionError('The absorption factor must be zero or positive.');

  const lat = crystal.lattice;
  const B = lat.B;
  const translations = crystal.ops
    .filter((o) => isIdentity(o.R) && o.t.some((x) => Math.abs(x - Math.round(x)) > 1e-6))
    .map((o) => o.t);
  const maxZone = Math.max(0, Math.floor(geometry.maxZone));

  const candidates: Beam[] = [];
  forEachLaue(lat, uvw, -maxZone || 0, maxZone, BEAM_G_MAX, (h, k, l, n, g) => {
    if (centringAbsent(translations, h, k, l)) return;
    const gx = B[0][0] * h + B[0][1] * k + B[0][2] * l;
    const gy = B[1][0] * h + B[1][1] * k + B[1][2] * l;
    const gz = B[2][0] * h + B[2][1] * k + B[2][2] * l;
    const kgx = beam[0] * K + gx;
    const kgy = beam[1] * K + gy;
    const kgz = beam[2] * K + gz;
    const kg = Math.sqrt(kgx * kgx + kgy * kgy + kgz * kgz);
    const s = (K * K - kg * kg) / (2 * kg);
    if (Math.abs(s) > MAX_EXCITATION) return;
    candidates.push({
      hkl: [h, k, l],
      x: gx * right[0] + gy * right[1] + gz * right[2],
      y: gx * up[0] + gy * up[1] + gz * up[2],
      g,
      s,
      zone: n,
      F: 0,
      forbidden: false,
    });
  });
  if (candidates.length === 0)
    throw new DiffractionError('No reflection is close enough to the Ewald sphere.');
  // nearest the Ewald sphere first; ties (symmetry-equivalent beams) by |g| then hkl, so that a
  // cut never splits a symmetric set arbitrarily between runs
  candidates.sort(
    (a, b) =>
      Math.abs(a.s) - Math.abs(b.s) ||
      a.g - b.g ||
      a.hkl[0] - b.hkl[0] ||
      a.hkl[1] - b.hkl[1] ||
      a.hkl[2] - b.hkl[2],
  );
  const beams: Beam[] = [
    { hkl: [0, 0, 0], x: 0, y: 0, g: 0, s: 0, zone: 0, F: 0, forbidden: false },
    ...candidates.slice(0, nBeams - 1),
  ];
  for (const b of beams.slice(1)) {
    const st = reflectionStrength(crystal, b.hkl, geometry.debyeWaller);
    b.F = st.F;
    b.forbidden = st.forbidden;
  }

  const n = beams.length;
  const factor = relativisticGamma(geometry.voltage) / (Math.PI * lat.volume);
  const known = new Map<string, [number, number]>();
  const potential = (h: number, k: number, l: number): [number, number] => {
    const key = `${h},${k},${l}`;
    let v = known.get(key);
    if (!v) {
      const [re, im] = electronStructureFactor(crystal, [h, k, l], {
        debyeWaller: geometry.debyeWaller,
      });
      v = [factor * re, factor * im];
      known.set(key, v);
    }
    return v;
  };
  const aRe = new Float64Array(n * n);
  const aIm = new Float64Array(n * n);
  const pRe = new Float64Array(n * n);
  const pIm = new Float64Array(n * n);
  const [u0] = potential(0, 0, 0);
  for (let r = 0; r < n; r++) {
    const a = beams[r].hkl;
    aRe[r * n + r] = 2 * K * beams[r].s;
    pRe[r * n + r] = kappa * u0;
    for (let c = 0; c < r; c++) {
      const b = beams[c].hkl;
      const [ur, ui] = potential(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // Hermitian: U_{h-g} = conj(U_{g-h}) for a real potential
      aRe[r * n + c] = ur;
      aIm[r * n + c] = ui;
      aRe[c * n + r] = ur;
      aIm[c * n + r] = -ui;
      pRe[r * n + c] = pRe[c * n + r] = kappa * ur;
      pIm[r * n + c] = kappa * ui;
      pIm[c * n + r] = -kappa * ui;
    }
  }
  return {
    n,
    K,
    aRe,
    aIm,
    pRe,
    pIm,
    beams,
    lambda,
    zoneAxis: uvw,
    beam,
    right,
    up,
    gReach: Math.max(...beams.map((b) => b.g)),
  };
}

/** Projects the n × n Hermitian matrix (mRe, mIm) onto the columns cols of (vRe, vIm): V† M V. */
function project(
  mRe: Float64Array,
  mIm: Float64Array,
  vRe: Float64Array,
  vIm: Float64Array,
  n: number,
  cols: number[],
): { re: Float64Array; im: Float64Array } {
  const d = cols.length;
  // W = M V (n × d)
  const wRe = new Float64Array(n * d);
  const wIm = new Float64Array(n * d);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const ar = mRe[r * n + c];
      const ai = mIm[r * n + c];
      if (ar === 0 && ai === 0) continue;
      for (let j = 0; j < d; j++) {
        const br = vRe[c * n + cols[j]];
        const bi = vIm[c * n + cols[j]];
        wRe[r * d + j] += ar * br - ai * bi;
        wIm[r * d + j] += ar * bi + ai * br;
      }
    }
  const re = new Float64Array(d * d);
  const im = new Float64Array(d * d);
  for (let i = 0; i < d; i++)
    for (let j = 0; j < d; j++) {
      let sr = 0;
      let si = 0;
      for (let r = 0; r < n; r++) {
        // conj(v_ri) w_rj
        const vr = vRe[r * n + cols[i]];
        const vi = vIm[r * n + cols[i]];
        const wr = wRe[r * d + j];
        const wi = wIm[r * d + j];
        sr += vr * wr + vi * wi;
        si += vr * wi - vi * wr;
      }
      re[i * d + j] = sr;
      im[i * d + j] = si;
    }
  return { re, im };
}

/** Eigen-decomposition of A and the first-order absorption of every Bloch wave. */
export function solveBloch(m: BlochMatrices): BlochSolution {
  const { n, K } = m;
  const eig = hermitianEigen(m.aRe, m.aIm, n);
  const vRe = eig.re;
  const vIm = eig.im;
  const q = new Float64Array(n);
  const absorbing = m.pRe.some((x) => x !== 0) || m.pIm.some((x) => x !== 0);

  if (absorbing) {
    // degenerate groups: diagonalise A' inside each so that every Bloch wave has its own q
    let scale = 0;
    for (const v of eig.values) scale = Math.max(scale, Math.abs(v));
    const tol = 1e-8 * Math.max(scale, 1e-300);
    let start = 0;
    while (start < n) {
      let end = start + 1;
      while (end < n && eig.values[end] - eig.values[end - 1] <= tol) end++;
      const cols = Array.from({ length: end - start }, (_, i) => start + i);
      const sub = project(m.pRe, m.pIm, vRe, vIm, n, cols);
      if (cols.length === 1) q[start] = sub.re[0] / (2 * K);
      else {
        const w = hermitianEigen(sub.re, sub.im, cols.length);
        const d = cols.length;
        // V_group <- V_group W
        const nr = new Float64Array(n * d);
        const ni = new Float64Array(n * d);
        for (let r = 0; r < n; r++)
          for (let j = 0; j < d; j++) {
            let sr = 0;
            let si = 0;
            for (let i = 0; i < d; i++) {
              const ar = vRe[r * n + cols[i]];
              const ai = vIm[r * n + cols[i]];
              const br = w.re[i * d + j];
              const bi = w.im[i * d + j];
              sr += ar * br - ai * bi;
              si += ar * bi + ai * br;
            }
            nr[r * d + j] = sr;
            ni[r * d + j] = si;
          }
        for (let r = 0; r < n; r++)
          for (let j = 0; j < d; j++) {
            vRe[r * n + cols[j]] = nr[r * d + j];
            vIm[r * n + cols[j]] = ni[r * d + j];
          }
        for (let j = 0; j < d; j++) q[cols[j]] = w.values[j] / (2 * K);
      }
      start = end;
    }
  }

  const gamma = new Float64Array(n);
  for (let j = 0; j < n; j++) gamma[j] = eig.values[j] / (2 * K);
  // amplitude of Bloch wave j in beam g: C_0^(j)* C_g^(j)
  const ampRe = new Float64Array(n * n);
  const ampIm = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    const c0r = vRe[j];
    const c0i = -vIm[j];
    for (let g = 0; g < n; g++) {
      const cr = vRe[g * n + j];
      const ci = vIm[g * n + j];
      ampRe[g * n + j] = c0r * cr - c0i * ci;
      ampIm[g * n + j] = c0r * ci + c0i * cr;
    }
  }
  return { n, gamma, q, ampRe, ampIm };
}

/** I_g(t) for every beam, as fractions of the incident intensity. */
export function beamIntensities(sol: BlochSolution, thickness: number): Float64Array {
  const { n } = sol;
  const t = Math.max(0, thickness);
  const er = new Float64Array(n);
  const ei = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const decay = Math.exp(-2 * Math.PI * sol.q[j] * t);
    const phase = 2 * Math.PI * sol.gamma[j] * t;
    er[j] = decay * Math.cos(phase);
    ei[j] = decay * Math.sin(phase);
  }
  const I = new Float64Array(n);
  for (let g = 0; g < n; g++) {
    let sr = 0;
    let si = 0;
    const row = g * n;
    for (let j = 0; j < n; j++) {
      const ar = sol.ampRe[row + j];
      const ai = sol.ampIm[row + j];
      sr += ar * er[j] - ai * ei[j];
      si += ar * ei[j] + ai * er[j];
    }
    I[g] = sr * sr + si * si;
  }
  return I;
}

/** Extinction distance xi_g = 1 / (lambda |U_g|) in angstrom (De Graef convention). */
export function extinctionDistance(
  crystal: Crystal,
  hkl: Vec3,
  voltage: number,
  debyeWaller: Thermal = false,
): number {
  const [re, im] = electronStructureFactor(crystal, hkl, { debyeWaller });
  const U = (relativisticGamma(voltage) / (Math.PI * crystal.lattice.volume)) * Math.hypot(re, im);
  return 1 / (electronWavelength(voltage) * U);
}

/**
 * The spot pattern of a solved problem at one thickness, in the M8 `Pattern` shape: I is relative
 * to the strongest diffracted beam (so the drawing scale matches the kinematic one), and every beam
 * is drawn as a spot, kinematically forbidden or not.
 */
export function dynamicalPattern(
  problem: BlochProblem,
  intensities: Float64Array,
): { pattern: Pattern; transmitted: number; strongest: number; total: number } {
  let strongest = 0;
  let total = 0;
  for (let g = 0; g < problem.n; g++) {
    total += intensities[g];
    if (g > 0) strongest = Math.max(strongest, intensities[g]);
  }
  const ref = strongest > 0 ? strongest : 1;
  const spots: Spot[] = problem.beams.slice(1).map((b, i) => ({
    hkl: b.hkl,
    x: b.x,
    y: b.y,
    g: b.g,
    d: 1 / b.g,
    F: b.F,
    I: intensities[i + 1] / ref,
    s: b.s,
    zone: b.zone,
    forbidden: false,
    fraction: intensities[i + 1],
    kinematicallyForbidden: b.forbidden,
  }));
  return {
    pattern: {
      spots,
      lambda: problem.lambda,
      zoneAxis: problem.zoneAxis,
      beam: problem.beam,
      right: problem.right,
      up: problem.up,
      evaluated: problem.n,
    },
    transmitted: intensities[0],
    strongest,
    total,
  };
}
