<script lang="ts">
  // Scattering factors of one element or ion at one scattering angle (context.md M4), shown in the
  // Powder XRD tab: they set the peak intensities there. Moved from the Structure Viewer tab.
  import { bn, elementInfo, fe, fx, parseSpecies } from '../core/scattering';
  import { DEFAULT_XRAY_LINE, XRAY_LINES, sFromTwoTheta, twoThetaFromS } from '../core/radiation';

  let speciesText = $state('Fe3+');
  let angleMode = $state<'twoTheta' | 's'>('twoTheta');
  let twoTheta = $state(40);
  let sInput = $state(0.3);
  let lineId = $state(DEFAULT_XRAY_LINE.id);

  const line = $derived(XRAY_LINES.find((l) => l.id === lineId) ?? DEFAULT_XRAY_LINE);
  const s = $derived(angleMode === 's' ? sInput : sFromTwoTheta(twoTheta, line.lambda));
  const scat = $derived.by(() => {
    try {
      const sp = parseSpecies(speciesText);
      const info = elementInfo(sp.element);
      return { info, fx: fx(sp, s), fe: fe(sp, s), bn: bn(sp), error: '' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  });
  const fmt = (x: number, digits = 4) => (Number.isFinite(x) ? x.toFixed(digits) : '–');
</script>

<article class="card lookup" data-testid="scattering-card">
  <header><h3>Scattering factors</h3></header>
  <div class="row">
    <span>species</span><input type="text" bind:value={speciesText} aria-label="species" size="6" />
    <select bind:value={angleMode} aria-label="angle input">
      <option value="twoTheta">2θ (°)</option>
      <option value="s">s = sinθ/λ (Å⁻¹)</option>
    </select>
    {#if angleMode === 'twoTheta'}
      <input type="number" step="1" min="0" max="180" bind:value={twoTheta} aria-label="2θ" />
      <select bind:value={lineId} aria-label="wavelength">
        {#each XRAY_LINES as l (l.id)}<option value={l.id}>{l.label}</option>{/each}
      </select>
    {:else}
      <input type="number" step="0.05" min="0" bind:value={sInput} aria-label="s" />
    {/if}
  </div>
  <p class="hint">
    s = {fmt(s)} Å⁻¹, d = {fmt(1 / (2 * s), 3)} Å{#if angleMode === 's'}, 2θ = {fmt(
        twoThetaFromS(s, line.lambda),
        3,
      )}° with {line.label}{/if}.
  </p>
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
</article>

<style>
  .lookup {
    padding: 0.9rem 1.1rem;
    min-width: 0;
  }
  header {
    margin-bottom: 0.6rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-h);
  }
  .hint {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
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
  .row span {
    min-width: 5rem;
  }
  .row input[type='number'] {
    width: 4.5rem;
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
</style>
