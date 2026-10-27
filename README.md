# Crystal Viewer Lite

A crystal-structure viewer and diffraction simulator that runs entirely in the browser. Open a CIF
file and look at the structure in 3D, simulate its electron diffraction pattern (kinematic or
dynamical, with Kikuchi bands and HOLZ rings) and its powder X-ray or neutron pattern, and export
the pictures, data and structure files.

**Use it online: <https://saifsiddique.github.io/crystal_view/>**

Nothing is uploaded: your CIF files are read and calculated in your own browser.

## Credit

This project is built upon the work of **Lisa Zhou**, the author of the original
**strFac_app**, a browser tool that calculates structure factors and diffraction from CIF files.
The original prototypes are kept unchanged in [`legacy/`](legacy/) as the reference this version
grew from.

## Features

### Opening structures
- Open CIF files with a button or by dropping them onto the page; several at once.
- Each open file is a card showing its formula (TiO₂, ErTe₃, NaAlSi₃O₈) and space group, with a ×
  to close it. Click a card to show that structure in every tab.
- Each open file keeps its own settings, camera and views while you look at another one.
- A warning appears when more than 10 files are open (the page may slow down); 40 is the limit.
- Files with several data blocks get a chooser; bad files are reported by name and the others still open.
- Reads symmetry from the Hall symbol, the Hermann–Mauguin symbol or the listed operations, and
  reports problems in the file as warnings.

### Crystal data
- Cell parameters, volume, space group and crystal system, content and density.
- A lattice calculator: length of [uvw], d-spacing of (hkl), the angle between a direction and a
  plane normal, and the plane normal to a direction.

### Structure Viewer (3D)
- Ball-and-stick, space-filling and stick styles; orthographic or perspective projection; optional
  cartoon (toon) shading; unit-cell box and axes.
- Rotate with the mouse, zoom with the wheel, pan with the right button, tilt with the arrow keys
  (step set by you); optional snap onto a nearby low-index zone axis.
- View along a direction [uvw] or the normal of a plane (hkl), with quick buttons for a, b, c, a\*,
  b\*, c\*; a live readout of the direction you are looking along.
- Range: one cell, one cell with boundary atoms, any supercell, or a slab cut along any (hkl) plane.
- Bonds from covalent radii with editable rules per element pair, manual bonds, complete molecules,
  and coordination polyhedra with adjustable opacity.
- Appearance: atom radii (automatic, covalent, ionic, van der Waals, uniform), scale, colours and
  radii per element or per site, hiding atoms, atom labels, background colour.
- Measure distances, angles and torsions by clicking 2, 3 or 4 atoms; hover an atom for its details.
- A legend of coloured balls with atom names, and a resizable, collapsible settings sidebar.
- Reset view, reset zoom and reset range.

### Electron Diffraction
- Kinematic spot pattern for the beam along the line of sight of a structure view beside it; type
  a zone axis [uvw], use the a, b, c, a\*, b\*, c\* presets, or take the orientation from the
  Structure Viewer.
- Tilt the crystal with the arrow keys or by dragging the pattern (Kikuchi navigation).
- Beam energy from 1 to 5000 kV with 300, 120 and 60 kV presets, and the electron wavelength.
- Specimen thickness and a choice of excitation-error profile; optional Debye–Waller damping that
  starts from the CIF's own displacement parameters or one B value you type.
- Zero-order and higher-order Laue zones, forbidden reflections as open circles, intensity scales
  (linear, square root, log) and exposure, index labels, and scale bar.
- Kikuchi bands, HOLZ rings with their radii, the CBED disc with its HOLZ lines for a chosen
  convergence angle, and strain of the cell edges.
- **Dynamical diffraction:** Bloch-wave intensities for the current orientation on request, with
  the number of beams and absorption settable; the thickness updates the result live, and the app
  asks before a move switches back to kinematic.
- Measure |g| and the angle between two spots; hover a spot for its indices, d, |g|, |F| and s_g.
- Structure range with 1×1×1, 2×2×2 and 3×3×3 presets and your own cell counts.

### Powder XRD
- Calculated powder pattern for Cu, Co, Mo, Cr, Fe or Ag Kα (with optional Kα₂), another X-ray
  wavelength, or neutrons.
- Peak shape: Caglioti U, V, W, pseudo-Voigt mixing, crystallite size (Scherrer) and microstrain.
- Zero shift, monochromator polarisation, March–Dollase preferred orientation, ionic scattering
  factors, Debye–Waller factor and the 2θ range and step.
- Horizontal axis in 2θ, d or Q; linear or square-root intensity; hkl labels on the peaks; zoom and pan.
- A sortable peak table (hkl, multiplicity, d, 2θ, |F|, intensity) and a scattering-factor lookup.

### Export
- **Images:** PNG at the DPI you choose (stored in the file, so Word and Inkscape place it at the
  right size) and vector SVG, with an optional transparent background, for the 3D structure, the
  diffraction pattern and the powder pattern. Save to a file or copy to the clipboard.
- **Data:** CSV of the electron-diffraction spot list, the powder profile and the peak table.
- **Structure files:** CIF (the full unit cell), XYZ, and XYZ in the computem format.

## Running it yourself

You need Node.js 24 and, to build the calculation kernel, Rust with
[wasm-pack](https://rustwasm.github.io/wasm-pack/).

```bash
cd app
npm ci
npm run build:wasm    # builds the Rust kernel
npm run dev           # development server
npm run build         # production build in app/dist
```

Checks: `npm run format:check`, `npm run lint`, `npm run check`, `npm test` (unit tests),
`npm run test:rust` and `npm run test:e2e` (browser tests). GitHub runs them on every push and
publishes the site from the `main` branch. [`context.md`](context.md) is the project plan and
design notes, and [`TESTING.md`](TESTING.md) lists how to check each part by hand.

Built with Svelte 5, TypeScript, Vite, Three.js and a Rust (WebAssembly) kernel.
