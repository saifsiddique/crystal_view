"""Independent electron structure factors for the M8 tests.

    python -I scripts/make_ed_reference.py        (run from app/, env s-em)

pymatgen's TEMCalculator (the `tem` block of the main fixtures) ignores site occupancies and uses
its own 4-Gaussian electron factors, so it cannot check M8 tightly: olivine (Mg/Fe) and albite
(Al/Si) differ by tens of percent, and weak reflections of ordered structures by up to ~40%.
This script computes the same quantity M8 does, by separate means:

  * the unit cell from pymatgen's own CIF reader and symmetry expansion (not ours),
  * f_e from abTEM's Lobato-Van Dyck evaluator (`scattering_factor(q^2)`, q = 1/d; not our code),
  * F(hkl) = sum over sites and species of occupancy * f_e * exp(2 pi i h.x), no Debye-Waller,
  * d from pymatgen's `Lattice.d_hkl`.

Output: tests/fixtures/ed/lobato_reference.json, {name: {"columns": [...], "rows": [[h, k, l, d,
F2], ...]}} for every hkl with |h|, |k|, |l| <= 3 except 000, numbers to 10 significant digits.
"""

from __future__ import annotations

import itertools
import json
import warnings
from pathlib import Path

import numpy as np
from abtem.parametrizations import LobatoParametrization
from pymatgen.core import Structure

APP = Path(__file__).resolve().parent.parent
CIFS = APP / "tests" / "fixtures" / "cifs"
OUT = APP / "tests" / "fixtures" / "ed" / "lobato_reference.json"
HKL_MAX = 3


def r(x: float) -> float:
    return float(f"{float(x):.10g}")


def reference(cif: Path) -> dict:
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        structure = Structure.from_file(cif, primitive=False)
    lobato = LobatoParametrization()
    factors = {}
    rows = []
    for hkl in itertools.product(range(-HKL_MAX, HKL_MAX + 1), repeat=3):
        if hkl == (0, 0, 0):
            continue
        d = structure.lattice.d_hkl(hkl)
        q2 = np.array([1.0 / d**2])
        F = 0j
        for site in structure:
            for sp, occ in site.species.items():
                el = sp.symbol
                if el not in factors:
                    factors[el] = lobato.scattering_factor(el)
                f = float(factors[el](q2)[0])
                F += occ * f * np.exp(2j * np.pi * np.dot(hkl, site.frac_coords))
        rows.append([*hkl, r(d), r(abs(F) ** 2)])
    return {"columns": ["h", "k", "l", "d", "F2"], "rows": rows}


def main() -> None:
    out = {cif.stem: reference(cif) for cif in sorted(CIFS.glob("*.cif"))}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print("wrote", OUT.relative_to(APP), {k: len(v["rows"]) for k, v in out.items()})


if __name__ == "__main__":
    main()
