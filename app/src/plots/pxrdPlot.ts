/**
 * Helpers for the powder-pattern plot (context.md M9): axis variables, tick placement and label
 * thinning. No DOM; `ui/PxrdPlot.svelte` draws what these return.
 *
 * The three horizontal axes are 2θ (degrees), d (angstrom) and Q = 4π sinθ/λ = 2π/d (1/angstrom).
 * The plot works in one "axis coordinate" u that grows to the right in every case: u = 2θ, u = Q,
 * and u = −d (so large d is on the left, as 2θ is); tick labels undo the sign.
 */
import { degToRad, radToDeg } from '../core/math/trig';

export type PxrdAxis = 'tt' | 'd' | 'Q';

/** The axis coordinate of a scattering angle 2θ (degrees) for wavelength λ. */
export function axisValue(axis: PxrdAxis, twoTheta: number, lambda: number): number {
  if (axis === 'tt') return twoTheta;
  const s = Math.sin(degToRad(twoTheta / 2));
  if (axis === 'Q') return (4 * Math.PI * s) / lambda;
  return -lambda / (2 * s);
}

/** The scattering angle 2θ (degrees) of an axis coordinate; NaN where there is none. */
export function twoThetaOf(axis: PxrdAxis, u: number, lambda: number): number {
  if (axis === 'tt') return u;
  const s = axis === 'Q' ? (u * lambda) / (4 * Math.PI) : lambda / (2 * -u);
  return s > 0 && s <= 1 ? 2 * radToDeg(Math.asin(s)) : NaN;
}

export const axisTitle = (axis: PxrdAxis): string =>
  axis === 'tt' ? '2θ (°)' : axis === 'd' ? 'd (Å)' : 'Q = 2π/d (Å⁻¹)';

/** What a tick at axis coordinate u is called. */
export function tickText(axis: PxrdAxis, u: number): string {
  const v = axis === 'd' ? -u : u;
  const a = Math.abs(v);
  const text =
    a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toFixed(3);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** About `count` round tick positions covering [min, max] (steps of 1, 2 or 5 times a power of ten). */
export function niceTicks(min: number, max: number, count = 8): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [];
  const raw = (max - min) / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step)
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return out;
}

export interface LabelSpot {
  index: number;
  x: number;
  /** Larger is placed first. */
  priority: number;
}

/**
 * The labels to draw: strongest first, each at least `gap` pixels from every one already kept,
 * at most `limit` of them. Returns their indices.
 */
export function thinLabels(spots: readonly LabelSpot[], gap: number, limit = 60): number[] {
  const order = [...spots].sort((a, b) => b.priority - a.priority);
  const kept: number[] = [];
  const xs: number[] = [];
  for (const s of order) {
    if (kept.length >= limit) break;
    if (xs.some((x) => Math.abs(x - s.x) < gap)) continue;
    kept.push(s.index);
    xs.push(s.x);
  }
  return kept;
}

/** First index i of the ascending array `a` with a[i] >= v (a.length when none). */
export function lowerBound(a: ArrayLike<number>, v: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export type YScale = 'linear' | 'sqrt';

/** Intensity as drawn (0..100 stays 0..100 on the linear scale, 0..10 on the √ scale). */
export const yTransform = (y: number, scale: YScale): number =>
  scale === 'sqrt' ? Math.sqrt(Math.max(0, y)) : y;

/** Quote a CSV field if it needs it. */
const csvField = (x: string | number): string => {
  const s = String(x);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export interface PeakRow {
  hkl: readonly number[];
  m: number;
  d: number;
  twoTheta: number;
  F: number;
  I: number;
}

/** The peak table as CSV text (header line first). */
export function peaksToCsv(rows: readonly PeakRow[]): string {
  const lines = ['h,k,l,multiplicity,d_angstrom,two_theta_deg,F,I_rel'];
  for (const r of rows)
    lines.push(
      [...r.hkl, r.m, r.d.toFixed(6), r.twoTheta.toFixed(5), r.F.toFixed(5), r.I.toFixed(4)]
        .map(csvField)
        .join(','),
    );
  return lines.join('\n') + '\n';
}
