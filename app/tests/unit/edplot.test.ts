import { describe, expect, it } from 'vitest';
import {
  indexPieces,
  isLowIndex,
  maxSpotRadius,
  measureSpots,
  MIN_SPOT_RADIUS,
  niceLength,
  placeLabels,
  scaledIntensity,
  spotRadius,
  type LabelCandidate,
} from '../../src/plots/edPlot';
import { defaultEDSettings, MAX_EXPOSURE, parseEDSettings } from '../../src/state/settings';

describe('spot sizes', () => {
  it('maps intensity to [0, 1] on each scale and saturates with exposure', () => {
    expect(scaledIntensity(0.25, 'linear')).toBe(0.25);
    expect(scaledIntensity(0.25, 'sqrt')).toBe(0.5);
    expect(scaledIntensity(1e-2, 'log')).toBeCloseTo(0.5, 12);
    expect(scaledIntensity(1e-5, 'log')).toBe(0);
    expect(scaledIntensity(0, 'sqrt')).toBe(0);
    expect(scaledIntensity(0.25, 'linear', 10)).toBe(1);
    expect(scaledIntensity(1e-4, 'linear', 100)).toBeCloseTo(1e-2, 12);
  });
  it('area is proportional to the scaled intensity; specks are not drawn', () => {
    expect(spotRadius(1, 'linear', 10)).toBe(10);
    expect(spotRadius(0.25, 'linear', 10)).toBe(5);
    expect(spotRadius(1e-6, 'linear', 10)).toBe(0);
    expect(spotRadius(1e-3, 'linear', 10, 1)).toBe(0);
    expect(spotRadius(1e-3, 'linear', 10, 100)).toBeGreaterThanOrEqual(MIN_SPOT_RADIUS);
    expect(maxSpotRadius(10)).toBe(4);
    expect(maxSpotRadius(200)).toBe(10);
    expect(maxSpotRadius(1e4)).toBe(16);
  });
});

describe('scale bar and indices', () => {
  it('nice lengths are 1, 2 or 5 times a power of ten, not above the target', () => {
    expect(niceLength(0.37)).toBeCloseTo(0.2, 12);
    expect(niceLength(0.6)).toBeCloseTo(0.5, 12);
    expect(niceLength(1.3)).toBe(1);
    expect(niceLength(27)).toBe(20);
    expect(niceLength(0)).toBe(0);
  });
  it('negative indices get a bar', () => {
    expect(indexPieces([1, -1, 10])).toEqual([
      { text: '1', bar: false },
      { text: '1', bar: true },
      { text: '10', bar: false },
    ]);
    expect(isLowIndex([3, -3, 0])).toBe(true);
    expect(isLowIndex([4, 0, 0])).toBe(false);
  });
});

describe('label placement', () => {
  const label = (index: number, x: number, y: number, priority: number): LabelCandidate => ({
    index,
    x,
    y,
    r: 3,
    width: 30,
    height: 10,
    priority,
  });
  it('places strongest first and never overlaps two labels', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      label(i, 50 + (i % 10) * 12, 50 + Math.floor(i / 10) * 9, i),
    );
    const placed = placeLabels(many, 400, 400);
    expect(placed[0].index).toBe(59);
    const boxes = placed.map((p) => [p.x, p.y - 10, p.x + 30, p.y]);
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        expect(a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]).toBe(false);
      }
    expect(placed.length).toBeLessThan(many.length);
  });
  it('tries the other corners near an edge and drops what cannot fit', () => {
    const [p] = placeLabels([label(0, 395, 200, 1)], 400, 400);
    expect(p.x + 30).toBeLessThanOrEqual(400);
    expect(p.x).toBeLessThan(395);
    expect(placeLabels([{ ...label(0, 10, 10, 1), width: 500 }], 400, 400)).toEqual([]);
  });
});

describe('measuring two spots', () => {
  it('gives |g|, d, the ratio and the angle between them', () => {
    const m = measureSpots({ x: 0.5, y: 0 }, { x: 0, y: 1 });
    expect(m.g1).toBe(0.5);
    expect(m.d2).toBe(1);
    expect(m.ratio).toBe(2);
    expect(m.angle).toBeCloseTo(90, 12);
    expect(measureSpots({ x: 1, y: 1 }, { x: -1, y: 0 }).angle).toBeCloseTo(135, 12);
  });
});

describe('EDSettings', () => {
  it('defaults: 300 kV, zero-order Laue zone only', () => {
    const s = defaultEDSettings();
    expect(s.voltage).toBe(300);
    expect(s.maxZone).toBe(0);
    expect(s.zoneAxis).toEqual([0, 0, 1]);
  });
  it('survive a JSON round trip, and bad values fall back to the defaults', () => {
    const s = defaultEDSettings();
    s.voltage = 120;
    s.maxZone = 2;
    s.exposure = 100;
    s.profile = 'sinc';
    s.labels = 'all';
    s.zoneAxis = [1, 1, 0];
    s.kikuchi = true;
    s.holzRings = true;
    s.cbed = true;
    s.alpha = 8;
    s.strain = [0.1, -0.2, 0.05];
    s.dragMode = 'tilt';
    s.range = { min: [0, 0, 0], max: [2, 3, 1], boundary: false, slab: null };
    expect(parseEDSettings(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const bad = parseEDSettings({
      voltage: -5,
      maxZone: 1.5,
      exposure: MAX_EXPOSURE * 10,
      profile: 'gauss',
      zoneAxis: [0, 0, 0],
      alpha: 500,
      strain: [9, 0, 0],
      dragMode: 'rotate',
      kikuchi: 'yes',
      range: { min: [1, 0, 0], max: [0, 1, 1] },
    });
    expect(bad).toEqual(defaultEDSettings());
    expect(parseEDSettings(null)).toEqual(defaultEDSettings());
  });
});
