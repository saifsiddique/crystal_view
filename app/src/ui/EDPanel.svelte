<script lang="ts" module>
  export const ED_TABS = [
    { id: 'params', label: 'Parameters' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'kikuchi', label: 'Kikuchi / HOLZ' },
  ] as const;
  export type EDTab = (typeof ED_TABS)[number]['id'];
</script>

<script lang="ts">
  // The sidebar of the Electron Diffraction tab: the beam and specimen parameters, how the pattern
  // is drawn, and the Kikuchi / HOLZ overlays, one tab at a time (the tab bar is the SidePanel's).
  // It edits `settings` in place; the tab recomputes.
  import type { Crystal } from '../core/crystal';
  import { electronWavelength, meanB } from '../core/diffraction/electron';
  import {
    MAX_ALPHA_MRAD,
    MAX_B,
    MAX_EXPOSURE,
    MAX_KIKUCHI_BANDS,
    MAX_LAUE_ZONE,
    MAX_STRAIN_PERCENT,
    VOLTAGE_PRESETS,
    type EDSettings,
  } from '../state/settings';

  let {
    tab,
    crystal,
    settings = $bindable(),
    spotCount,
    onSaveSpots,
  }: {
    tab: EDTab;
    crystal: Crystal;
    settings: EDSettings;
    /** Spots of the pattern shown (0: nothing to save). */
    spotCount: number;
    /** Save the spot list of the pattern shown as CSV; returns the file name. */
    onSaveSpots: () => string;
  } = $props();

  const fmt = (x: number, d = 4) => x.toFixed(d);
  const lambda = $derived.by(() => {
    try {
      return electronWavelength(settings.voltage);
    } catch {
      return NaN;
    }
  });

  // ---- Debye-Waller factor: off, the CIF's own values, or one B typed by the user -------------

  /** Mean B of the CIF (angstrom²), the value the box starts with. */
  const cifB = $derived(meanB(crystal));
  const shownB = $derived(settings.debyeWallerB ?? Math.round(cifB * 10000) / 10000);

  function setB(text: string) {
    const v = Number(text);
    if (text.trim() === '' || !Number.isFinite(v) || v < 0 || v > MAX_B) return;
    settings.debyeWallerB = v;
    settings.debyeWaller = true;
  }

  const LAUE_OPTIONS = Array.from({ length: MAX_LAUE_ZONE + 1 }, (_, n) => n);
  const laueLabel = (n: number) =>
    n === 0
      ? 'ZOLZ only'
      : n === 1
        ? 'ZOLZ + FOLZ (|n| ≤ 1)'
        : n === 2
          ? 'up to SOLZ (|n| ≤ 2)'
          : `|n| ≤ ${n}`;

  let saved = $state('');
</script>

<div class="panel" data-testid="ed-panel">
  {#if tab === 'params'}
    <h4>Beam</h4>
    <div class="row wrap">
      <span class="seg" role="group" aria-label="Voltage presets">
        {#each VOLTAGE_PRESETS as kv (kv)}
          <button
            type="button"
            aria-pressed={settings.voltage === kv}
            onclick={() => (settings.voltage = kv)}
            data-testid={`ed-preset-${kv}`}>{kv} kV</button
          >
        {/each}
      </span>
    </div>
    <div class="row">
      <label class="unit" title="Accelerating voltage">
        voltage
        <input
          class="num"
          type="number"
          min="1"
          max="5000"
          step="10"
          bind:value={settings.voltage}
          aria-label="Accelerating voltage in kV"
          data-testid="ed-voltage"
        />kV
      </label>
      <span class="muted" data-testid="ed-lambda"
        >λ = {Number.isFinite(lambda) ? fmt(lambda, 5) : '–'} Å</span
      >
    </div>

    <h4>Specimen</h4>
    <div class="row">
      <label class="unit" title="Thickness: sets how fast spots fade with the excitation error">
        thickness
        <input
          class="num"
          type="number"
          min="0"
          step="50"
          bind:value={settings.thickness}
          aria-label="Thickness in angstrom"
          data-testid="ed-thickness"
        />Å
      </label>
    </div>
    <div class="row">
      <select
        bind:value={settings.profile}
        aria-label="Excitation-error profile"
        title="How intensity falls off with the excitation error"
        data-testid="ed-profile"
      >
        <option value="smooth">Smooth (sinc² envelope)</option>
        <option value="sinc">Thin slab (sinc²)</option>
        <option value="none">None (zone-axis |F|²)</option>
      </select>
    </div>

    <h4>Debye–Waller factor</h4>
    <label
      class="row"
      title="Thermal vibration damps every reflection by exp(−B sin²θ/λ²), B = 8π²U"
    >
      <input type="checkbox" bind:checked={settings.debyeWaller} data-testid="ed-dw" /> Damp the reflections
      by thermal vibration
    </label>
    <div class="row">
      <label
        class="unit"
        title="B in Å², one value for every atom. It starts as the mean of the CIF's own displacement parameters (B = 8π²U); type another value to use it instead."
      >
        B
        <input
          class="num"
          type="number"
          min="0"
          max={MAX_B}
          step="0.05"
          value={shownB}
          disabled={!settings.debyeWaller}
          oninput={(e) => setB(e.currentTarget.value)}
          aria-label="Debye-Waller B in square angstrom"
          data-testid="ed-dw-b"
        />Å²
      </label>
      {#if settings.debyeWallerB !== null}
        <button
          type="button"
          onclick={() => (settings.debyeWallerB = null)}
          title="Back to the displacement parameters of the CIF, atom by atom"
          data-testid="ed-dw-cif">use CIF</button
        >
      {:else}
        <span class="muted" data-testid="ed-dw-note"
          >{cifB > 0 ? 'from the CIF' : 'CIF has none'}</span
        >
      {/if}
    </div>
  {:else if tab === 'pattern'}
    <h4>Spots</h4>
    <div class="row">
      <select bind:value={settings.maxZone} aria-label="Laue zones" data-testid="ed-laue">
        {#each LAUE_OPTIONS as n (n)}
          <option value={n}>{laueLabel(n)}</option>
        {/each}
      </select>
    </div>
    <label class="row" title="Draw kinematically forbidden reflections as open circles">
      <input type="checkbox" bind:checked={settings.showForbidden} data-testid="ed-forbidden" /> Show
      forbidden reflections
    </label>

    <h4>Intensity</h4>
    <div class="row">
      <select
        bind:value={settings.intensityScale}
        aria-label="Intensity scale"
        data-testid="ed-scale"
      >
        <option value="linear">Linear</option>
        <option value="sqrt">√ intensity</option>
        <option value="log">Log</option>
      </select>
    </div>
    <label
      class="row"
      title="Multiply the intensities before drawing (bright spots saturate), like a longer exposure: weak HOLZ reflections show up"
    >
      exposure
      <input
        type="range"
        min="0"
        max={Math.log10(MAX_EXPOSURE)}
        step="0.25"
        value={Math.log10(settings.exposure)}
        oninput={(e) => (settings.exposure = 10 ** Number(e.currentTarget.value))}
        aria-label="Exposure (log10)"
        data-testid="ed-exposure"
      />
      <span class="muted expo"
        >×{settings.exposure < 10
          ? settings.exposure.toFixed(1)
          : Math.round(settings.exposure)}</span
      >
    </label>

    <h4>Index labels</h4>
    <div class="row">
      <select bind:value={settings.labels} aria-label="Spot labels" data-testid="ed-labels">
        <option value="none">No labels</option>
        <option value="low">Low-index labels</option>
        <option value="all">All labels</option>
      </select>
    </div>

    <h4>Data</h4>
    <div class="row wrap">
      <button
        type="button"
        disabled={spotCount === 0}
        onclick={() => (saved = `Saved ${onSaveSpots()}`)}
        title="Every computed spot: hkl, Laue zone, d, position, |F|, intensity, s_g (a dynamical pattern adds its own intensities)"
        data-testid="ed-spots-csv">Save spot list (CSV)</button
      >
      <span class="muted" role="status">{saved}</span>
    </div>
  {:else}
    <h4>Kikuchi bands</h4>
    <label class="row" title="Kikuchi bands: the Bragg lines of every strong plane, 2θ wide">
      <input type="checkbox" bind:checked={settings.kikuchi} data-testid="ed-kikuchi" /> Draw Kikuchi
      bands
    </label>
    <div class="row">
      <label class="unit" title="How many of the strongest Kikuchi bands to draw">
        bands
        <input
          class="num"
          type="number"
          min="1"
          max={MAX_KIKUCHI_BANDS}
          step="5"
          bind:value={settings.kikuchiBands}
          aria-label="Number of Kikuchi bands"
          data-testid="ed-kikuchi-count"
        />
      </label>
    </div>

    <h4>HOLZ</h4>
    <label
      class="row"
      title="Rings where the Ewald sphere cuts the first Laue layers, with their radii"
    >
      <input type="checkbox" bind:checked={settings.holzRings} data-testid="ed-rings" /> HOLZ rings
    </label>
    <label class="row" title="The central CBED disc with its HOLZ lines">
      <input type="checkbox" bind:checked={settings.cbed} data-testid="ed-cbed" /> CBED disc with HOLZ
      lines
    </label>
    <div class="row">
      <label class="unit" title="Convergence semi-angle: the disc radius is α/λ">
        α
        <input
          class="num"
          type="number"
          min="0.1"
          max={MAX_ALPHA_MRAD}
          step="1"
          bind:value={settings.alpha}
          aria-label="Convergence semi-angle in mrad"
          data-testid="ed-alpha"
        />mrad
      </label>
    </div>

    <h4>Strain</h4>
    <div
      class="row wrap"
      title="Strain of the cell edges (per cent): moves the Kikuchi lines, rings and HOLZ lines"
    >
      {#each ['a', 'b', 'c'] as axis, k (axis)}
        <label class="unit">
          {axis}
          <input
            class="num small"
            type="number"
            min={-MAX_STRAIN_PERCENT}
            max={MAX_STRAIN_PERCENT}
            step="0.05"
            bind:value={settings.strain[k]}
            aria-label={`Strain along ${axis} in per cent`}
            data-testid={`ed-strain-${k}`}
          />
        </label>
      {/each}
      %
    </div>
  {/if}
</div>

<style>
  .panel {
    min-width: 0;
  }
  h4 {
    margin: 0.7rem 0 0.2rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h4:first-child {
    margin-top: 0.2rem;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0.3rem 0;
  }
  .row.wrap {
    flex-wrap: wrap;
  }
  .unit {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .num {
    width: 4.6rem;
    padding: 0.15rem 0.3rem;
  }
  .num.small {
    width: 3.8rem;
  }
  .muted {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.8rem;
  }
  .expo {
    display: inline-block;
    min-width: 3.2rem;
  }
  input[type='range'] {
    flex: 1;
    min-width: 5rem;
  }
  .seg {
    display: inline-flex;
  }
  .seg > button {
    border-radius: 0;
    margin-left: -1px;
  }
  .seg > button:first-child {
    border-radius: 6px 0 0 6px;
    margin-left: 0;
  }
  .seg > button:last-child {
    border-radius: 0 6px 6px 0;
  }
  .seg > button:hover:not(:disabled) {
    position: relative;
    z-index: 1;
  }
  .seg > button[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-ink);
    position: relative;
    z-index: 1;
  }
</style>
