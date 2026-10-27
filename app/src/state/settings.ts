/**
 * Settings of the diffraction modules (context.md 5.4: one interface per module). Plain JSON-able
 * data, so M12 can save them in the session; each `parse*` reads one back and fills in defaults
 * for anything missing or malformed. Pure TypeScript, no DOM.
 */
import { MAX_BEAMS } from '../core/diffraction/dynamical';
import type { ExcitationProfile } from '../core/diffraction/electron';
import type { Vec3 } from '../core/math/vec3';
import { defaultRange, type RangeSettings } from '../core/structure/settings';

export type IntensityScale = 'linear' | 'sqrt' | 'log';
export type SpotLabels = 'none' | 'low' | 'all';

/** Electron diffraction tab (M8). */
export interface EDSettings {
  /** Accelerating voltage, kV. */
  voltage: number;
  /** Specimen thickness, angstrom. */
  thickness: number;
  profile: ExcitationProfile;
  debyeWaller: boolean;
  /**
   * One B (angstrom²) for every atom, typed by the user; null uses the CIF's own displacement
   * parameter of each atom. (B = 8π²U; the damping is exp(−B sin²θ/λ²).)
   */
  debyeWallerB: number | null;
  /** Laue zones |n| <= maxZone are drawn; 0 = the zero-order Laue zone only. */
  maxZone: number;
  /** |g| (1/angstrom) that "Fit" shows; zooming out computes further. */
  gMax: number;
  intensityScale: IntensityScale;
  /** Intensities are multiplied by this before drawing (saturating), like a longer exposure. */
  exposure: number;
  labels: SpotLabels;
  /** Draw kinematically forbidden reflections as open circles. */
  showForbidden: boolean;
  /** Kikuchi bands (M10). */
  kikuchi: boolean;
  /** How many of the strongest bands are drawn. */
  kikuchiBands: number;
  /** Circles where the Ewald sphere cuts the first Laue layers, with their radii (M10). */
  holzRings: boolean;
  /** The transmitted CBED disc with the HOLZ lines inside it (M10). */
  cbed: boolean;
  /** Convergence semi-angle of the disc, mrad. */
  alpha: number;
  /** Strain of the cell edges a, b, c in per cent: moves Kikuchi lines, rings and HOLZ lines. */
  strain: [number, number, number];
  /** What dragging the pattern does: pan the view, or tilt the crystal (Kikuchi navigation). */
  dragMode: 'pan' | 'tilt';
  /** Zone axis [uvw] last asked for. */
  zoneAxis: Vec3;
  /** Angle of one arrow-key press, degrees. */
  tiltStep: number;
  /** What the structure view on the left shows. */
  range: RangeSettings;
  /** Dynamical (Bloch-wave) pattern, M11: number of beams (000 included). */
  dynBeams: number;
  /** Absorption of the Bloch waves: U'_g = kappa U_g. */
  absorption: number;
}

/** The voltage preset buttons, kV. */
export const VOLTAGE_PRESETS = [300, 120, 60] as const;

export const MAX_LAUE_ZONE = 6;
export const MAX_EXPOSURE = 1e4;
export const MAX_ALPHA_MRAD = 100;
export const MAX_KIKUCHI_BANDS = 300;
export const MAX_B = 50;
export const MAX_STRAIN_PERCENT = 5;
export const MAX_DYN_BEAMS = MAX_BEAMS;
export const MAX_ABSORPTION = 1;

export const defaultEDSettings = (): EDSettings => ({
  voltage: 300,
  // Thin: kinematic theory only holds well below the extinction distance (a few hundred angstrom),
  // and at 500 angstrom the excitation error already erases most zero-order spots beyond 2 2 0.
  thickness: 100,
  profile: 'smooth',
  debyeWaller: true,
  debyeWallerB: null,
  maxZone: 0,
  gMax: 2,
  intensityScale: 'sqrt',
  exposure: 1,
  labels: 'low',
  showForbidden: false,
  kikuchi: false,
  kikuchiBands: 20,
  holzRings: false,
  cbed: false,
  alpha: 15,
  strain: [0, 0, 0],
  dragMode: 'pan',
  zoneAxis: [0, 0, 1],
  tiltStep: 1,
  range: defaultRange(),
  // 150 beams: about 0.2 s; Si [110] intensities change by < 10% from here to 400 beams
  dynBeams: 150,
  absorption: 0.1,
});

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isVec3 = (x: unknown): x is Vec3 => Array.isArray(x) && x.length === 3 && x.every(isNum);

export function parseEDSettings(json: unknown): EDSettings {
  const out = defaultEDSettings();
  if (!json || typeof json !== 'object') return out;
  const j = json as Record<string, unknown>;
  const positive = (x: unknown, max: number): x is number => isNum(x) && x > 0 && x <= max;
  if (positive(j.voltage, 5000)) out.voltage = j.voltage;
  if (isNum(j.thickness) && j.thickness >= 0 && j.thickness <= 1e6) out.thickness = j.thickness;
  if (j.profile === 'sinc' || j.profile === 'smooth' || j.profile === 'none')
    out.profile = j.profile;
  if (typeof j.debyeWaller === 'boolean') out.debyeWaller = j.debyeWaller;
  if (
    j.debyeWallerB === null ||
    (isNum(j.debyeWallerB) && j.debyeWallerB >= 0 && j.debyeWallerB <= MAX_B)
  )
    out.debyeWallerB = j.debyeWallerB;
  if (
    Number.isInteger(j.maxZone) &&
    (j.maxZone as number) >= 0 &&
    (j.maxZone as number) <= MAX_LAUE_ZONE
  )
    out.maxZone = j.maxZone as number;
  if (positive(j.gMax, 10)) out.gMax = j.gMax;
  if (j.intensityScale === 'linear' || j.intensityScale === 'sqrt' || j.intensityScale === 'log')
    out.intensityScale = j.intensityScale;
  if (isNum(j.exposure) && j.exposure >= 1 && j.exposure <= MAX_EXPOSURE) out.exposure = j.exposure;
  if (j.labels === 'none' || j.labels === 'low' || j.labels === 'all') out.labels = j.labels;
  if (typeof j.showForbidden === 'boolean') out.showForbidden = j.showForbidden;
  if (typeof j.kikuchi === 'boolean') out.kikuchi = j.kikuchi;
  if (
    Number.isInteger(j.kikuchiBands) &&
    (j.kikuchiBands as number) >= 1 &&
    (j.kikuchiBands as number) <= MAX_KIKUCHI_BANDS
  )
    out.kikuchiBands = j.kikuchiBands as number;
  if (typeof j.holzRings === 'boolean') out.holzRings = j.holzRings;
  if (typeof j.cbed === 'boolean') out.cbed = j.cbed;
  if (positive(j.alpha, MAX_ALPHA_MRAD)) out.alpha = j.alpha;
  if (isVec3(j.strain) && j.strain.every((x) => Math.abs(x) <= MAX_STRAIN_PERCENT))
    out.strain = [j.strain[0], j.strain[1], j.strain[2]];
  if (j.dragMode === 'pan' || j.dragMode === 'tilt') out.dragMode = j.dragMode;
  if (isVec3(j.zoneAxis) && j.zoneAxis.some((x) => x !== 0)) out.zoneAxis = [...j.zoneAxis];
  if (positive(j.tiltStep, 90)) out.tiltStep = j.tiltStep;
  const r = j.range && typeof j.range === 'object' ? (j.range as Record<string, unknown>) : {};
  if (isVec3(r.min) && isVec3(r.max) && r.min.every((x, k) => x <= (r.max as Vec3)[k])) {
    out.range.min = [...r.min];
    out.range.max = [...r.max];
  }
  if (typeof r.boundary === 'boolean') out.range.boundary = r.boundary;
  if (
    Number.isInteger(j.dynBeams) &&
    (j.dynBeams as number) >= 2 &&
    (j.dynBeams as number) <= MAX_DYN_BEAMS
  )
    out.dynBeams = j.dynBeams as number;
  if (isNum(j.absorption) && j.absorption >= 0 && j.absorption <= MAX_ABSORPTION)
    out.absorption = j.absorption;
  return out;
}

// ---- powder diffraction (M9) ---------------------------------------------------------------------

export type PxrdRadiation =
  'CuKa' | 'CoKa' | 'MoKa' | 'CrKa' | 'FeKa' | 'AgKa' | 'custom' | 'neutron';
export const PXRD_RADIATIONS: readonly PxrdRadiation[] = [
  'CuKa',
  'CoKa',
  'MoKa',
  'CrKa',
  'FeKa',
  'AgKa',
  'custom',
  'neutron',
];

/** Powder XRD tab. */
export interface PXRDSettings {
  radiation: PxrdRadiation;
  /** Wavelength (angstrom) for `custom` X-rays and for neutrons. */
  wavelength: number;
  /** Add the Kα₂ line of an anode, at `kalphaRatio` of the Kα₁ intensity. */
  kalpha2: boolean;
  kalphaRatio: number;
  twoThetaMin: number;
  twoThetaMax: number;
  step: number;
  /** Caglioti U, V, W (degrees²) and the pseudo-Voigt mixing η. */
  U: number;
  V: number;
  W: number;
  eta: number;
  /** Crystallite size (nm, 0 = off) and microstrain (per cent, 0 = off). */
  sizeNm: number;
  strainPercent: number;
  /** Zero shift (degrees 2θ) and monochromator angle 2θ_m (degrees, 0 = none). */
  zeroShift: number;
  monoAngle: number;
  /** March-Dollase preferred orientation. */
  preferred: boolean;
  preferredHkl: Vec3;
  preferredR: number;
  /** Debye-Waller factor: as for `EDSettings` (a box starting at the CIF's mean B). */
  debyeWaller: boolean;
  debyeWallerB: number | null;
  /** Use ionic scattering factors where the CIF gives oxidation states. */
  ionic: boolean;
  axis: 'tt' | 'd' | 'Q';
  intensityScale: 'linear' | 'sqrt';
  labels: boolean;
  /** Peaks weaker than this per cent of the strongest are left out. */
  minPercent: number;
}

export const defaultPXRDSettings = (): PXRDSettings => ({
  radiation: 'CuKa',
  wavelength: 1.54,
  kalpha2: false,
  kalphaRatio: 0.5,
  twoThetaMin: 5,
  twoThetaMax: 90,
  step: 0.02,
  U: 0.01,
  V: -0.005,
  W: 0.005,
  eta: 0.5,
  sizeNm: 0,
  strainPercent: 0,
  zeroShift: 0,
  monoAngle: 0,
  preferred: false,
  preferredHkl: [0, 0, 1],
  preferredR: 1,
  debyeWaller: true,
  debyeWallerB: null,
  ionic: false,
  axis: 'tt',
  intensityScale: 'linear',
  labels: true,
  minPercent: 0.1,
});

export function parsePXRDSettings(json: unknown): PXRDSettings {
  const out = defaultPXRDSettings();
  if (!json || typeof json !== 'object') return out;
  const j = json as Record<string, unknown>;
  const between = (x: unknown, lo: number, hi: number): x is number =>
    isNum(x) && x >= lo && x <= hi;
  if (PXRD_RADIATIONS.includes(j.radiation as PxrdRadiation))
    out.radiation = j.radiation as PxrdRadiation;
  if (between(j.wavelength, 0.05, 20) && j.wavelength > 0) out.wavelength = j.wavelength;
  if (typeof j.kalpha2 === 'boolean') out.kalpha2 = j.kalpha2;
  if (between(j.kalphaRatio, 0, 1)) out.kalphaRatio = j.kalphaRatio;
  if (
    between(j.twoThetaMin, 0, 179) &&
    between(j.twoThetaMax, 1, 180) &&
    j.twoThetaMax > j.twoThetaMin
  ) {
    out.twoThetaMin = j.twoThetaMin;
    out.twoThetaMax = j.twoThetaMax;
  }
  if (between(j.step, 0.001, 2)) out.step = j.step;
  if (between(j.U, 0, 10)) out.U = j.U;
  if (between(j.V, -10, 10)) out.V = j.V;
  if (between(j.W, 0, 10)) out.W = j.W;
  if (between(j.eta, 0, 1)) out.eta = j.eta;
  if (between(j.sizeNm, 0, 1e5)) out.sizeNm = j.sizeNm;
  if (between(j.strainPercent, 0, 10)) out.strainPercent = j.strainPercent;
  if (between(j.zeroShift, -5, 5)) out.zeroShift = j.zeroShift;
  if (between(j.monoAngle, 0, 90)) out.monoAngle = j.monoAngle;
  if (typeof j.preferred === 'boolean') out.preferred = j.preferred;
  if (isVec3(j.preferredHkl) && j.preferredHkl.some((x) => x !== 0))
    out.preferredHkl = [...j.preferredHkl];
  if (isNum(j.preferredR) && j.preferredR > 0 && j.preferredR <= 10) out.preferredR = j.preferredR;
  if (typeof j.debyeWaller === 'boolean') out.debyeWaller = j.debyeWaller;
  if (j.debyeWallerB === null || between(j.debyeWallerB, 0, MAX_B))
    out.debyeWallerB = j.debyeWallerB;
  if (typeof j.ionic === 'boolean') out.ionic = j.ionic;
  if (j.axis === 'tt' || j.axis === 'd' || j.axis === 'Q') out.axis = j.axis;
  if (j.intensityScale === 'linear' || j.intensityScale === 'sqrt')
    out.intensityScale = j.intensityScale;
  if (typeof j.labels === 'boolean') out.labels = j.labels;
  if (between(j.minPercent, 0, 50)) out.minPercent = j.minPercent;
  return out;
}
