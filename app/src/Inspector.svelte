<script lang="ts">
  // Temporary developer view of the core library (M1-M4): load a CIF, see what the parser, the
  // symmetry code and the lattice maths make of it. M14 replaces this with the real UI.
  import { parseCif, toP1Structure, writeCif, type BlockOutcome } from './core/cif';
  import { buildCrystal, type Crystal } from './core/crystal';
  import { density } from './core/density';
  import {
    angleDirectionToPlaneNormal,
    cartesianToNearestHkl,
    dSpacing,
    directionLength,
    uvwToCart,
    uvwToHkl,
  } from './core/lattice';
  import type { Vec3 } from './core/math/vec3';
  import { bn, elementInfo, fe, fx, parseSpecies, sFromD } from './core/scattering';
  import { detectSpaceGroup, type DetectedSymmetry } from './symmetry/detect';

  let fileName = $state('');
  let error = $state('');
  let outcomes = $state.raw<BlockOutcome[]>([]);
  let block = $state(0);
  let crystal = $state.raw<Crystal | null>(null);
  let warnings = $state<string[]>([]);
  let detected = $state.raw<DetectedSymmetry | null>(null);
  let detecting = $state(false);

  function select(index: number) {
    block = index;
    detected = null;
    crystal = null;
    warnings = [];
    const o = outcomes[index];
    if (!o?.structure) return;
    try {
      const built = buildCrystal(o.structure);
      crystal = built.crystal;
      warnings = [...o.warnings, ...built.warnings].map((w) => w.message);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function onFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    fileName = file.name;
    error = '';
    outcomes = [];
    crystal = null;
    try {
      outcomes = parseCif(await file.text());
      const first = outcomes.findIndex((o) => o.structure);
      if (first === -1) error = outcomes[0]?.error ?? 'No structure found in this file.';
      else select(first);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function detect() {
    if (!crystal) return;
    detecting = true;
    try {
      detected = await detectSpaceGroup(crystal);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      detecting = false;
    }
  }

  function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'chemical/x-cif' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmt = (x: number, digits = 4) => (Number.isFinite(x) ? x.toFixed(digits) : '–');

  // ---- lattice calculator -----------------------------------------------------------------------
  let uvw = $state<Vec3>([1, 1, 0]);
  let hkl = $state<Vec3>([1, 1, 0]);
  const calc = $derived.by(() => {
    if (!crystal) return null;
    const lat = crystal.lattice;
    try {
      const nearest = cartesianToNearestHkl(lat, uvwToCart(lat, uvw));
      return {
        length: directionLength(lat, uvw),
        d: dSpacing(lat, hkl),
        angle: angleDirectionToPlaneNormal(lat, uvw, hkl),
        planeNormalOfUvw: uvwToHkl(lat, uvw),
        nearest,
      };
    } catch {
      return null;
    }
  });

  // ---- low-index planes -------------------------------------------------------------------------
  const planes = $derived.by(() => {
    if (!crystal) return [];
    const lat = crystal.lattice;
    const seen: Record<string, { hkl: Vec3; d: number }> = {};
    for (let h = -3; h <= 3; h++)
      for (let k = -3; k <= 3; k++)
        for (let l = -3; l <= 3; l++) {
          if (h === 0 && k === 0 && l === 0) continue;
          const d = dSpacing(lat, [h, k, l]);
          const key = d.toFixed(6);
          const prev = seen[key];
          const better =
            [h, k, l].filter((x) => x < 0).length <
            (prev ? prev.hkl.filter((x) => x < 0).length : 9);
          if (!prev || better) seen[key] = { hkl: [h, k, l], d };
        }
    return Object.values(seen)
      .sort((a, b) => b.d - a.d)
      .slice(0, 12);
  });

  // ---- scattering lookup ------------------------------------------------------------------------
  let speciesText = $state('Fe3+');
  let s = $state(0.3);
  const scat = $derived.by(() => {
    try {
      const sp = parseSpecies(speciesText);
      const info = elementInfo(sp.element);
      return { info, fx: fx(sp, s), fe: fe(sp, s), bn: bn(sp), error: '' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
</script>

<section aria-label="Core inspector">
  <h2>Core inspector</h2>
  <p class="hint">Load a CIF to see how the parser, symmetry code and lattice maths read it.</p>
  <input type="file" accept=".cif,.txt" onchange={onFile} data-testid="cif-input" />
  {#if error}<p class="err" data-testid="error">{error}</p>{/if}

  {#if outcomes.length > 1}
    <label>
      Data block
      <select value={block} onchange={(e) => select(Number(e.currentTarget.value))}>
        {#each outcomes as o, i (i)}
          <option value={i} disabled={!o.structure}
            >{o.name}{o.structure ? '' : ' (no structure)'}</option
          >
        {/each}
      </select>
    </label>
  {/if}

  {#if crystal}
    {@const c = crystal}
    <h3 data-testid="crystal-title">{fileName} · {c.name}</h3>
    {#if c.title}<p class="hint">{c.title}</p>{/if}
    <dl data-testid="crystal-summary">
      <dt>Cell (Å, °)</dt>
      <dd>
        {fmt(c.cell.a)}
        {fmt(c.cell.b)}
        {fmt(c.cell.c)} · {fmt(c.cell.alpha, 3)}
        {fmt(c.cell.beta, 3)}
        {fmt(c.cell.gamma, 3)}
      </dd>
      <dt>Volume</dt>
      <dd>{fmt(c.summary.volume, 3)} Å³</dd>
      <dt>Space group</dt>
      <dd data-testid="space-group">
        {c.spaceGroup.number ?? '?'}
        {c.spaceGroup.symbol ?? ''} ({c.spaceGroup.crystalSystem ?? 'unknown'}),
        {c.spaceGroup.order} operations, from {c.spaceGroup.source}
      </dd>
      <dt>Declared</dt>
      <dd>{c.spaceGroup.declared.hm ?? '–'} · number {c.spaceGroup.declared.number ?? '–'}</dd>
      <dt>Content</dt>
      <dd data-testid="formula">
        {c.summary.formula}{c.summary.Z ? `, Z = ${c.summary.Z}` : ''} · {c.sites.length} sites →
        {c.atoms.length} atoms in {c.positions.length} positions
      </dd>
      <dt>Density</dt>
      <dd>{fmt(density(c), 3)} g/cm³</dd>
    </dl>

    <p>
      <button onclick={detect} disabled={detecting} data-testid="detect">
        {detecting ? 'Detecting…' : 'Detect symmetry from positions'}
      </button>
      <button onclick={() => download(writeCif(toP1Structure(c)), `${c.name}_P1.cif`)}>
        Download P1 cell
      </button>
      {#if detected}
        <span data-testid="detected">
          detected {detected.number}
          {detected.hmSymbol} ({detected.pearsonSymbol})
          {detected.number === c.spaceGroup.number
            ? '✓ matches the CIF'
            : '≠ the CIF declares ' + c.spaceGroup.number}
        </span>
      {/if}
    </p>

    {#if warnings.length}
      <details open>
        <summary>{warnings.length} warning{warnings.length === 1 ? '' : 's'}</summary>
        <ul>
          {#each warnings as w, i (i)}<li>{w}</li>{/each}
        </ul>
      </details>
    {/if}

    <h3>Asymmetric unit</h3>
    <table>
      <thead
        ><tr
          ><th>label</th><th>element</th><th>x</th><th>y</th><th>z</th><th>occ</th><th>mult</th></tr
        ></thead
      >
      <tbody>
        {#each c.sites as site (site.index)}
          <tr>
            <td>{site.label}</td><td>{site.typeSymbol ?? site.element}</td>
            <td>{fmt(site.frac[0])}</td><td>{fmt(site.frac[1])}</td><td>{fmt(site.frac[2])}</td>
            <td>{site.occupancy}</td><td>{site.multiplicity}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Lattice calculator</h3>
    <div class="row">
      <span>direction [uvw]</span>
      {#each [0, 1, 2] as i (i)}<input
          type="number"
          step="1"
          bind:value={uvw[i]}
          aria-label={'uvw ' + i}
        />{/each}
      <span>plane (hkl)</span>
      {#each [0, 1, 2] as i (i)}<input
          type="number"
          step="1"
          bind:value={hkl[i]}
          aria-label={'hkl ' + i}
        />{/each}
    </div>
    {#if calc}
      <dl data-testid="lattice-calc">
        <dt>|[uvw]|</dt>
        <dd>{fmt(calc.length)} Å</dd>
        <dt>d(hkl)</dt>
        <dd>{fmt(calc.d)} Å</dd>
        <dt>angle [uvw] ↔ (hkl) normal</dt>
        <dd>{fmt(calc.angle, 3)}°</dd>
        <dt>plane normal to [uvw] ∝ (hkl)</dt>
        <dd>
          ({calc.planeNormalOfUvw.map((x) => fmt(x, 3)).join(', ')}) ≈ ({calc.nearest.indices.join(
            ' ',
          )}), off by {fmt(calc.nearest.angleDeg, 3)}°
        </dd>
      </dl>
    {/if}

    <h3>Largest d-spacings</h3>
    <table>
      <thead><tr><th>(hkl)</th><th>d (Å)</th><th>s = 1/2d</th><th>F² X-ray (rel.)</th></tr></thead>
      <tbody>
        {#each planes as p (p.d)}
          {@const F2 = (() => {
            let re = 0,
              im = 0;
            for (const a of c.atoms) {
              const ph =
                2 * Math.PI * (p.hkl[0] * a.frac[0] + p.hkl[1] * a.frac[1] + p.hkl[2] * a.frac[2]);
              const f = a.occupancy * fx(a.element, sFromD(p.d));
              re += f * Math.cos(ph);
              im += f * Math.sin(ph);
            }
            return re * re + im * im;
          })()}
          <tr
            ><td>{p.hkl.join(' ')}</td><td>{fmt(p.d)}</td><td>{fmt(sFromD(p.d))}</td><td
              >{F2 < 1e-6 ? '0 (absent)' : fmt(F2, 1)}</td
            ></tr
          >
        {/each}
      </tbody>
    </table>
  {/if}

  <h3>Scattering factors</h3>
  <div class="row">
    <span>species</span><input type="text" bind:value={speciesText} aria-label="species" size="6" />
    <span>s = sinθ/λ (Å⁻¹)</span><input
      type="number"
      step="0.05"
      min="0"
      bind:value={s}
      aria-label="s"
    />
  </div>
  {#if scat.error}
    <p class="err">{scat.error}</p>
  {:else if scat.info}
    <dl data-testid="scattering">
      <dt>{scat.info.name} (Z = {scat.info.Z})</dt>
      <dd>
        <span class="swatch" style:background={scat.info.color}></span> mass {scat.info.mass} u · covalent
        {scat.info.covalentRadius} Å
      </dd>
      <dt>f X-ray</dt>
      <dd>{fmt(scat.fx)} e</dd>
      <dt>f electron</dt>
      <dd>{fmt(scat.fe)} Å</dd>
      <dt>b neutron</dt>
      <dd>{fmt(scat.bn)} fm</dd>
    </dl>
  {/if}
</section>

<style>
  section {
    margin-top: 2.5rem;
  }
  h3 {
    margin: 1.5rem 0 0.5rem;
    font-size: 0.95rem;
    color: var(--text-h);
  }
  .hint {
    margin: 0 0 0.75rem;
  }
  .err {
    color: var(--err);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .row input[type='number'] {
    width: 4.5rem;
  }
  table {
    border-collapse: collapse;
    font-family: var(--mono);
    font-size: 0.85rem;
  }
  th,
  td {
    padding: 0.15rem 0.7rem 0.15rem 0;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3rem 1.5rem;
    margin: 0 0 0.75rem;
  }
  dd {
    margin: 0;
    font-family: var(--mono);
    color: var(--text-h);
  }
  .swatch {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border: 1px solid var(--border);
    vertical-align: middle;
  }
  details {
    margin-bottom: 1rem;
  }
</style>
