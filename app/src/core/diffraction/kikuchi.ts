/**
 * Kikuchi lines and HOLZ (context.md M10): the geometric, "dynamical-looking" features. Nothing here
 * solves a wave equation; every feature is a straight line or circle in the detector plane of the
 * kinematic pattern (x right, y up, units 1/angstrom, so angle = position × lambda).
 *
 * One equation does the work. A reflection g is on the Bragg condition |K + g| = |K| when the
 * wave vector K = k·beam + τ (τ in the detector plane, small angle) satisfies
 *
 *     τ · ĝ⊥ = −(g² + 2 k g_z) / (2 |g⊥|)  =: D,
 *
 * with g_z = g·beam and g⊥ the part of g in the detector plane. Read as the incident-beam tilt τ,
 * it is the HOLZ (deficiency) line of g in the central CBED disc; read as the screen position of
 * the scattered direction it is a Kikuchi line. A Kikuchi band is the pair from +g and −g:
 * D₊ = −(g² + 2kg_z)/(2|g⊥|) and D₋ = +(g² − 2kg_z)/(2|g⊥|) along ĝ⊥, a distance g²/|g⊥| apart
 * (|g| on a zone axis, i.e. 2θ_B / λ). For g_z = −H (the excited HOLZ layer) D = (G² − |g⊥|²) / (2|g⊥|)
 * with G² = 2kH − H², so the line passes through the disc centre where |g⊥| = G, the HOLZ ring.
 *
 * Strain: `strain` = [εa, εb, εc] scales the cell edges by (1 + ε); the reciprocal basis becomes
 * B·diag(1/(1+ε)). Only the geometry of these features uses it (spots and intensities do not), which
 * is what makes HOLZ lines a sensitive strain probe.
 */
import type { Crystal } from '../crystal';
import type { Lattice } from '../lattice';
import { dot, norm, type Vec3 } from '../math/vec3';
import {
  DiffractionError,
  electronWavelength,
  forEachLaue,
  reducedZoneAxis,
  reflectionStrength,
  type Thermal,
} from './electron';

export type Strain = readonly [number, number, number];
export const NO_STRAIN: Strain = [0, 0, 0];

/** The detector frame of a pattern (see `detectorFrame`). */
export interface Frame {
  beam: Vec3;
  right: Vec3;
  up: Vec3;
}

/** g = B' · hkl for the strained reciprocal basis. */
function strainedG(lat: Lattice, strain: Strain, h: number, k: number, l: number): Vec3 {
  const B = lat.B;
  const a = h / (1 + strain[0]);
  const b = k / (1 + strain[1]);
  const c = l / (1 + strain[2]);
  return [
    B[0][0] * a + B[0][1] * b + B[0][2] * c,
    B[1][0] * a + B[1][1] * b + B[1][2] * c,
    B[2][0] * a + B[2][1] * b + B[2][2] * c,
  ];
}

/** Direct-lattice vector M' · uvw (angstrom) for the strained cell. */
function strainedR(lat: Lattice, strain: Strain, uvw: Vec3): Vec3 {
  const M = lat.M;
  const a = uvw[0] * (1 + strain[0]);
  const b = uvw[1] * (1 + strain[1]);
  const c = uvw[2] * (1 + strain[2]);
  return [
    M[0][0] * a + M[0][1] * b + M[0][2] * c,
    M[1][0] * a + M[1][1] * b + M[1][2] * c,
    M[2][0] * a + M[2][1] * b + M[2][2] * c,
  ];
}

const screenOf = (g: Vec3, f: Frame): { x: number; y: number; z: number } => ({
  x: dot(g, f.right),
  y: dot(g, f.up),
  z: dot(g, f.beam),
});

/** Smallest |g⊥| (1/angstrom) for which a line is computed; a g along the beam has none. */
const MIN_PERP = 1e-3;

// ---- Kikuchi bands --------------------------------------------------------------------------------

export interface KikuchiParams {
  voltage: number;
  debyeWaller: Thermal;
  strain: Strain;
  /** Planes with |g| up to this (1/angstrom) are considered. */
  gMax: number;
  /** Planes weaker than this (relative intensity) are left out. */
  minIntensity: number;
  /** At most this many (the strongest) bands are returned. */
  maxBands: number;
  /** Bands entirely farther than this (1/angstrom) from the pattern centre are left out. */
  maxOffset: number;
}

export const defaultKikuchiParams = (): KikuchiParams => ({
  voltage: 300,
  debyeWaller: true,
  strain: NO_STRAIN,
  gMax: 2.5,
  minIntensity: 1e-3,
  maxBands: 400,
  maxOffset: 12,
});

export interface KikuchiBand {
  hkl: Vec3;
  /** Unit normal of both lines, in detector coordinates. */
  ex: number;
  ey: number;
  /** Signed distances of the two lines from the pattern centre along the normal (D₊ < D₋). */
  D1: number;
  D2: number;
  /** |g| and |g⊥| (1/angstrom). */
  g: number;
  gPerp: number;
  /** Relative intensity of the plane, and |F|. */
  I: number;
  F: number;
}

interface Strong {
  hkl: Vec3;
  I: number;
  F: number;
}

const strongCache = new WeakMap<Crystal, Map<string, Strong[]>>();

/** The strong reflections (one of each ±hkl pair), strongest first; cached per crystal. */
function strongReflections(
  crystal: Crystal,
  gMax: number,
  minIntensity: number,
  dw: Thermal,
): Strong[] {
  let byKey = strongCache.get(crystal);
  if (!byKey) strongCache.set(crystal, (byKey = new Map()));
  const key = `${gMax}|${minIntensity}|${dw}`;
  const cached = byKey.get(key);
  if (cached) return cached;
  const lat = crystal.lattice;
  const bound = [0, 1, 2].map((i) => Math.floor(gMax * Math.sqrt(lat.G[i][i]) + 1e-9));
  const out: Strong[] = [];
  const B = lat.B;
  for (let h = 0; h <= bound[0]; h++)
    for (let k = -bound[1]; k <= bound[1]; k++)
      for (let l = -bound[2]; l <= bound[2]; l++) {
        // one of each ±pair: the first non-zero index is positive
        if (h === 0 && (k < 0 || (k === 0 && l <= 0))) continue;
        const g = Math.hypot(
          B[0][0] * h + B[0][1] * k + B[0][2] * l,
          B[1][0] * h + B[1][1] * k + B[1][2] * l,
          B[2][0] * h + B[2][1] * k + B[2][2] * l,
        );
        if (g > gMax) continue;
        const s = reflectionStrength(crystal, [h, k, l], dw);
        if (s.forbidden || s.I < minIntensity) continue;
        out.push({ hkl: [h, k, l], I: s.I, F: s.F });
      }
  out.sort((a, b) => b.I - a.I);
  byKey.set(key, out);
  return out;
}

/**
 * The Kikuchi bands for a beam direction (frame), as pairs of straight lines. Each band is the
 * pair of lines of +g and −g, at D₊ and D₋ along the unit normal (ex, ey).
 */
export function kikuchiBands(crystal: Crystal, frame: Frame, params: KikuchiParams): KikuchiBand[] {
  const k = 1 / electronWavelength(params.voltage);
  const lat = crystal.lattice;
  const strong = strongReflections(crystal, params.gMax, params.minIntensity, params.debyeWaller);
  const out: KikuchiBand[] = [];
  for (const s of strong) {
    const g = strainedG(lat, params.strain, s.hkl[0], s.hkl[1], s.hkl[2]);
    const { x, y, z } = screenOf(g, frame);
    const gp = Math.hypot(x, y);
    if (gp < MIN_PERP) continue;
    const g2 = x * x + y * y + z * z;
    const D1 = -(g2 / 2 + k * z) / gp;
    const D2 = (g2 / 2 - k * z) / gp;
    if (Math.min(Math.abs(D1), Math.abs(D2)) > params.maxOffset && D1 * D2 > 0) continue;
    out.push({
      hkl: s.hkl,
      ex: x / gp,
      ey: y / gp,
      D1,
      D2,
      g: Math.sqrt(g2),
      gPerp: gp,
      I: s.I,
      F: s.F,
    });
    if (out.length >= params.maxBands) break;
  }
  return out;
}

// ---- Laue-zone rings ------------------------------------------------------------------------------

export interface LaueRingParams {
  voltage: number;
  zoneAxis: Vec3;
  debyeWaller: Thermal;
  strain: Strain;
  /** Rings for the Laue zones 1..nMax. */
  nMax: number;
}

export interface LaueRing {
  /** Order of the Laue zone (1 = FOLZ, 2 = SOLZ, ...); the excited layer is −n along the beam. */
  n: number;
  /** Layer spacing H = n / |r_uvw| (1/angstrom), with the cell strained. */
  H: number;
  /** Radius sqrt(2kH − H²) (exact sphere/plane intersection; ≈ sqrt(2H/λ) for small H). */
  radius: number;
  /** Centre in the detector plane (the origin when the beam is on the zone axis). */
  cx: number;
  cy: number;
  /** False when the layer has no allowed reflection near the ring (e.g. fcc [110], n = 1). */
  allowed: boolean;
}

/** sqrt(2H/λ), the textbook approximation of the ring radius. */
export const approximateRingRadius = (H: number, lambda: number): number =>
  Math.sqrt((2 * H) / lambda);

/**
 * Where the Ewald sphere cuts the Laue layers n = 1..nMax of the zone axis: circles in the
 * detector plane. A ring is `allowed` only when the layer holds a reflection that is neither
 * forbidden nor negligible near the circle (so the centring is accounted for: in the F-centred
 * Si, [110] has no first-order ring but a second-order one).
 */
export function laueRings(crystal: Crystal, frame: Frame, params: LaueRingParams): LaueRing[] {
  const lambda = electronWavelength(params.voltage);
  const k = 1 / lambda;
  const lat = crystal.lattice;
  const uvw = reducedZoneAxis(params.zoneAxis);
  const r = strainedR(lat, params.strain, uvw);
  const rLen = norm(r);
  if (!(rLen > 0)) throw new DiffractionError('The zone axis has zero length.');
  const rHat: Vec3 = [r[0] / rLen, r[1] / rLen, r[2] / rLen];
  const cosTilt = dot(frame.beam, rHat);
  // the layer the Ewald sphere bends towards: g·beam < 0
  const sign = cosTilt >= 0 ? -1 : 1;
  const out: LaueRing[] = [];
  for (let n = 1; n <= params.nMax; n++) {
    const H = n / rLen;
    // sphere centre at −k·beam in g-space; layer plane g·r̂ = sign·H
    const along = sign * H + k * cosTilt;
    const rho2 = k * k - along * along;
    if (rho2 <= 0) continue;
    const cx3: Vec3 = [
      -k * frame.beam[0] + along * rHat[0],
      -k * frame.beam[1] + along * rHat[1],
      -k * frame.beam[2] + along * rHat[2],
    ];
    const radius = Math.sqrt(rho2);
    // allowed: some reflection of the layer within 0.6 1/A of the circle is present
    let allowed = false;
    forEachLaue(lat, uvw, sign * n, sign * n, radius + 0.8, (h, kk, l) => {
      if (allowed) return;
      const g = strainedG(lat, params.strain, h, kk, l);
      const dist = Math.abs(
        Math.hypot(
          dot(g, frame.right) - dot(cx3, frame.right),
          dot(g, frame.up) - dot(cx3, frame.up),
        ) - radius,
      );
      if (dist > 0.6) return;
      const s = reflectionStrength(crystal, [h, kk, l], params.debyeWaller);
      if (!s.forbidden && s.I > 1e-6) allowed = true;
    });
    out.push({
      n,
      H,
      radius,
      cx: dot(cx3, frame.right),
      cy: dot(cx3, frame.up),
      allowed,
    });
  }
  return out;
}

// ---- HOLZ lines in the central CBED disc ----------------------------------------------------------------

export interface HolzParams {
  voltage: number;
  zoneAxis: Vec3;
  debyeWaller: Thermal;
  strain: Strain;
  /** Convergence semi-angle (rad): the transmitted disc has radius α/λ. */
  alpha: number;
  /** Laue zones 1..maxZone (both signs of n) are searched. */
  maxZone: number;
  /** Reflections weaker than this (relative intensity) are left out. */
  minIntensity: number;
}

export interface HolzLine {
  hkl: Vec3;
  /** Laue zone hu + kv + lw (never 0). */
  zone: number;
  ex: number;
  ey: number;
  /** Signed distance from the disc centre along (ex, ey), 1/angstrom; |D| <= disc radius. */
  D: number;
  /** Half the chord of the disc this line cuts (1/angstrom). */
  half: number;
  gPerp: number;
  I: number;
}

/** Radius of the central disc in the detector plane, 1/angstrom. */
export const discRadius = (alpha: number, voltage: number): number =>
  alpha / electronWavelength(voltage);

/**
 * The HOLZ lines inside the central disc: for every reflection g of the Laue zones 1..maxZone
 * (on either side) whose line passes through the disc. Lines are straight (linearised in τ).
 */
export function holzLines(crystal: Crystal, frame: Frame, params: HolzParams): HolzLine[] {
  const lambda = electronWavelength(params.voltage);
  const k = 1 / lambda;
  const R = params.alpha / lambda;
  if (!(R > 0)) return [];
  const lat = crystal.lattice;
  const uvw = reducedZoneAxis(params.zoneAxis);
  const rLen = norm(strainedR(lat, params.strain, uvw));
  const out: HolzLine[] = [];
  for (const sign of [-1, 1]) {
    for (let n = 1; n <= params.maxZone; n++) {
      const H = n / rLen;
      const G2 = 2 * k * H - H * H;
      if (G2 <= 0) continue;
      // |D| <= R  =>  |g⊥| <= R + sqrt(R² + G²); 10% and 0.3 1/A for the strain and small tilts
      const gPerpMax = R + Math.sqrt(R * R + G2);
      const gMax = Math.min(14, 1.1 * Math.hypot(gPerpMax, H) + 0.3);
      forEachLaue(lat, uvw, sign * n, sign * n, gMax, (h, kk, l, zone) => {
        const g = strainedG(lat, params.strain, h, kk, l);
        const { x, y, z } = screenOf(g, frame);
        const gp = Math.hypot(x, y);
        if (gp < MIN_PERP) return;
        const D = -((x * x + y * y + z * z) / 2 + k * z) / gp;
        if (Math.abs(D) >= R) return;
        const s = reflectionStrength(crystal, [h, kk, l], params.debyeWaller);
        if (s.forbidden || s.I < params.minIntensity) return;
        out.push({
          hkl: [h, kk, l],
          zone,
          ex: x / gp,
          ey: y / gp,
          D,
          half: Math.sqrt(R * R - D * D),
          gPerp: gp,
          I: s.I,
        });
      });
    }
  }
  out.sort((a, b) => b.I - a.I);
  return out;
}
