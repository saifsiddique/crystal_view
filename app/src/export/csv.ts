/** CSV text of the diffraction results (context.md M12); the powder peak table is in plots/pxrdPlot. */
import type { Spot } from '../core/diffraction/electron';
import type { Profile } from '../core/diffraction/powder';
import { degToRad } from '../core/math/trig';

const num = (x: number, digits: number): string => (Number.isFinite(x) ? x.toFixed(digits) : '');

/**
 * The spot list of an electron-diffraction pattern, strongest first. For a dynamical pattern two
 * more columns hold the intensity as a fraction of the incident beam and whether the reflection is
 * kinematically forbidden.
 */
export function spotsToCsv(spots: readonly Spot[]): string {
  const dynamical = spots.some((s) => s.fraction !== undefined);
  const head = [
    'h',
    'k',
    'l',
    'laue_zone',
    'd_angstrom',
    'g_inv_angstrom',
    'x_inv_angstrom',
    'y_inv_angstrom',
    'F_angstrom',
    'I_rel',
    's_inv_angstrom',
    'forbidden',
  ];
  if (dynamical) head.push('I_fraction_of_incident', 'kinematically_forbidden');
  const lines = [head.join(',')];
  for (const s of [...spots].sort((a, b) => b.I - a.I || a.g - b.g)) {
    const row = [
      ...s.hkl,
      s.zone,
      num(s.d, 6),
      num(s.g, 6),
      num(s.x, 6),
      num(s.y, 6),
      num(s.F, 5),
      s.I.toExponential(5),
      s.s.toExponential(5),
      s.forbidden ? 1 : 0,
    ];
    if (dynamical) row.push((s.fraction ?? 0).toExponential(5), s.kinematicallyForbidden ? 1 : 0);
    lines.push(row.join(','));
  }
  return lines.join('\n') + '\n';
}

/**
 * The calculated powder pattern, one line per step. d and Q belong to the Kα₁ (or only)
 * wavelength `lambda`, from the 2θ column.
 */
export function profileToCsv(profile: Profile, lambda: number): string {
  const lines = ['two_theta_deg,d_angstrom,Q_inv_angstrom,intensity'];
  for (let i = 0; i < profile.twoTheta.length; i++) {
    const tt = profile.twoTheta[i];
    const s = Math.sin(degToRad(tt / 2));
    lines.push(
      [
        num(tt, 4),
        s > 0 ? num(lambda / (2 * s), 5) : '',
        s > 0 ? num((4 * Math.PI * s) / lambda, 5) : '',
        profile.intensity[i].toFixed(4),
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}
