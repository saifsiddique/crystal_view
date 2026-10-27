/**
 * Layout helpers for the electron-diffraction pattern (context.md M8): spot sizes, label placement
 * without overlaps, the scale bar and the two-spot measurement. No DOM; `ui/EDPattern.svelte`
 * draws the SVG from what these return.
 */
import type { Spot } from '../core/diffraction/electron';
import type { IntensityScale } from '../state/settings';

/** Decades shown by the log scale: relative intensity 1e-4 is the smallest visible spot. */
export const LOG_DECADES = 4;

/** Intensity times the exposure, mapped to [0, 1] for drawing (bright spots saturate). */
export function scaledIntensity(I: number, scale: IntensityScale, exposure = 1): number {
  I *= exposure;
  if (!(I > 0)) return 0;
  const v =
    scale === 'linear' ? I : scale === 'sqrt' ? Math.sqrt(I) : 1 + Math.log10(I) / LOG_DECADES;
  return Math.min(1, Math.max(0, v));
}

/** Spots smaller than this (pixels) are not drawn. */
export const MIN_SPOT_RADIUS = 0.6;

/** Spot radius in pixels (area proportional to the scaled intensity); 0 when too small to draw. */
export function spotRadius(
  I: number,
  scale: IntensityScale,
  maxRadius: number,
  exposure = 1,
): number {
  const r = maxRadius * Math.sqrt(scaledIntensity(I, scale, exposure));
  return r >= MIN_SPOT_RADIUS ? r : 0;
}

/** Largest spot radius (px) for a zoom of `pxPerInvA` pixels per 1/angstrom. */
export const maxSpotRadius = (pxPerInvA: number): number =>
  Math.min(16, Math.max(4, 0.05 * pxPerInvA));

/** A length of the form 1, 2 or 5 times a power of ten, close to `target` and not above it. */
export function niceLength(target: number): number {
  if (!(target > 0)) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(target)));
  const m = target / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

/** An index as text pieces; negative numbers are drawn as a digit with a bar over it. */
export function indexPieces(hkl: readonly number[]): { text: string; bar: boolean }[] {
  return hkl.map((x) => ({ text: String(Math.abs(x)), bar: x < 0 }));
}

/** Plain-text index, e.g. "1 -1 1". */
export const hklText = (hkl: readonly number[]): string => hkl.join(' ');

/** Whether a spot gets a label in the "low index" mode. */
export const isLowIndex = (hkl: readonly number[], limit = 3): boolean =>
  hkl.every((x) => Math.abs(x) <= limit);

export interface LabelCandidate {
  /** Index into the caller's spot list. */
  index: number;
  /** Spot centre and radius in pixels. */
  x: number;
  y: number;
  r: number;
  /** Rough text size in pixels. */
  width: number;
  height: number;
  /** Larger is placed first. */
  priority: number;
}

export interface PlacedLabel {
  index: number;
  /** Text anchor: the left end of the baseline. */
  x: number;
  y: number;
}

/**
 * Greedy label placement: strongest first, each tried above-right, below-right, above-left and
 * below-left of its spot, and dropped when every place overlaps a label already placed or falls
 * outside the `width` × `height` box.
 */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  width: number,
  height: number,
  limit = 400,
): PlacedLabel[] {
  const order = [...candidates].sort((a, b) => b.priority - a.priority);
  const boxes: [number, number, number, number][] = [];
  const out: PlacedLabel[] = [];
  for (const c of order) {
    if (out.length >= limit) break;
    const gap = c.r + 2;
    const tries: [number, number][] = [
      [c.x + gap, c.y - gap],
      [c.x + gap, c.y + gap + c.height],
      [c.x - gap - c.width, c.y - gap],
      [c.x - gap - c.width, c.y + gap + c.height],
    ];
    for (const [x, y] of tries) {
      const box: [number, number, number, number] = [x, y - c.height, x + c.width, y];
      if (box[0] < 0 || box[1] < 0 || box[2] > width || box[3] > height) continue;
      const hit = boxes.some(
        (b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1],
      );
      if (hit) continue;
      boxes.push(box);
      out.push({ index: c.index, x, y });
      break;
    }
  }
  return out;
}

export interface SpotMeasurement {
  g1: number;
  g2: number;
  d1: number;
  d2: number;
  /** |g2| / |g1|. */
  ratio: number;
  /** Angle between the two spots as seen from the central beam, degrees. */
  angle: number;
}

/** Distances and angle of two spots on the detector plane, as measured on a recorded pattern. */
export function measureSpots(a: Pick<Spot, 'x' | 'y'>, b: Pick<Spot, 'x' | 'y'>): SpotMeasurement {
  const g1 = Math.hypot(a.x, a.y);
  const g2 = Math.hypot(b.x, b.y);
  const angle =
    (Math.atan2(Math.abs(a.x * b.y - a.y * b.x), a.x * b.x + a.y * b.y) * 180) / Math.PI;
  return { g1, g2, d1: 1 / g1, d2: 1 / g2, ratio: g2 / g1, angle };
}
