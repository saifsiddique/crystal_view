<script lang="ts">
  // Powder XRD tab (context.md M9): the calculated powder pattern of the loaded structure, X-ray
  // or neutron, an indexed peak table, and the scattering-factor lookup that sets the intensities.
  import { tick, untrack } from 'svelte';
  import type { Crystal } from '../core/crystal';
  import { meanB, type Thermal } from '../core/diffraction/electron';
  import {
    mergePeaks,
    powderPeaks,
    powderProfile,
    type PeakResult,
    type Profile,
    type RadiationKind,
  } from '../core/diffraction/powder';
  import { XRAY_DOUBLETS } from '../core/radiation';
  import { downloadText, safeName, svgSize } from '../export/browser';
  import { profileToCsv } from '../export/csv';
  import { svgImageRows, type ExportSection } from '../export/rows';
  import { peaksToCsv } from '../plots/pxrdPlot';
  import {
    defaultPXRDSettings,
    MAX_B,
    type PXRDSettings,
    type PxrdRadiation,
  } from '../state/settings';
  import ExportMenu from './ExportMenu.svelte';
  import Logo from './Logo.svelte';
  import PxrdPlot, { type PlotView } from './PxrdPlot.svelte';
  import ScatteringLookup from './ScatteringLookup.svelte';

  let { crystal, fileName = '' }: { crystal: Crystal | null; fileName?: string } = $props();

  let settings = $state<PXRDSettings>(defaultPXRDSettings());
  let plot = $state<ReturnType<typeof PxrdPlot>>();
  let plotView = $state<PlotView>({ u0: 5, u1: 90 });
  let error = $state('');
  let peakResult = $state.raw<PeakResult | null>(null);
  let profile = $state.raw<Profile | null>(null);
  let peakMs = $state(0);
  let profileMs = $state(0);
  let selected = $state<string | null>(null);

  const fmt = (x: number, d = 4) => (Number.isFinite(x) ? x.toFixed(d) : '–');

  // ---- several open files: each keeps its settings and plot view while another one is shown ------

  const kept = new WeakMap<Crystal, { settings: PXRDSettings; view: PlotView; hklText: string }>();
  let shownCrystal: Crystal | null = null;
  /** The plot view to put back instead of fitting, once the profile of a file shown before is in. */
  let restoreView: PlotView | null = null;

  $effect(() => {
    const c = crystal;
    untrack(() => {
      if (c === shownCrystal) return;
      if (shownCrystal)
        kept.set(shownCrystal, {
          settings: $state.snapshot(settings),
          view: { ...plotView },
          hklText,
        });
      shownCrystal = c;
      const saved = c ? kept.get(c) : undefined;
      restoreView = saved ? { ...saved.view } : null;
      if (saved) {
        settings = structuredClone(saved.settings);
        hklText = saved.hklText;
      }
    });
  });

  // ---- radiation ------------------------------------------------------------------------------------

  const anode = $derived(XRAY_DOUBLETS.find((d) => d.id === settings.radiation) ?? null);
  const kind = $derived<RadiationKind>(settings.radiation === 'neutron' ? 'neutron' : 'xray');
  const lambda1 = $derived(anode ? anode.lambda1 : settings.wavelength);
  const lambda2 = $derived(anode && settings.kalpha2 ? anode.lambda2 : null);
  const radiationName = $derived(
    anode
      ? `${anode.label}${settings.kalpha2 ? '₁ + Kα₂' : '₁'}`
      : settings.radiation === 'neutron'
        ? 'Neutrons'
        : 'X-rays',
  );

  // ---- Debye-Waller factor: off, the CIF's own values, or one B typed by the user ---------------------

  const cifB = $derived(crystal ? meanB(crystal) : 0);
  const thermal = $derived<Thermal>(settings.debyeWaller ? (settings.debyeWallerB ?? true) : false);
  const shownB = $derived(settings.debyeWallerB ?? Math.round(cifB * 10000) / 10000);

  function setB(text: string) {
    const v = Number(text);
    if (text.trim() === '' || !Number.isFinite(v) || v < 0 || v > MAX_B) return;
    settings.debyeWallerB = v;
    settings.debyeWaller = true;
  }

  // ---- the peaks and the profile ----------------------------------------------------------------------

  $effect(() => {
    const c = crystal;
    const p = {
      kind,
      lambda: lambda1,
      twoThetaMin: settings.twoThetaMin,
      twoThetaMax: settings.twoThetaMax,
      zeroShift: settings.zeroShift,
      thermal,
      ionic: settings.ionic && kind === 'xray',
      monoAngle: kind === 'xray' ? settings.monoAngle : 0,
      preferred: settings.preferred
        ? { hkl: $state.snapshot(settings.preferredHkl), r: settings.preferredR }
        : null,
      minRelative: Math.max(0, settings.minPercent) / 100,
    };
    if (!c) {
      peakResult = null;
      error = '';
      return;
    }
    untrack(() => {
      try {
        const t0 = performance.now();
        peakResult = powderPeaks(c, p);
        peakMs = performance.now() - t0;
        error = '';
      } catch (e) {
        peakResult = null;
        error = e instanceof Error ? e.message : String(e);
      }
    });
  });

  $effect(() => {
    const r = peakResult;
    const p = {
      lambda: lambda1,
      lambda2,
      ratio: settings.kalphaRatio,
      twoThetaMin: settings.twoThetaMin,
      twoThetaMax: settings.twoThetaMax,
      step: settings.step,
      zeroShift: settings.zeroShift,
      kind,
      monoAngle: kind === 'xray' ? settings.monoAngle : 0,
      U: settings.U,
      V: settings.V,
      W: settings.W,
      eta: settings.eta,
      sizeNm: settings.sizeNm,
      strainPercent: settings.strainPercent,
    };
    if (!r) {
      profile = null;
      return;
    }
    untrack(() => {
      try {
        const t0 = performance.now();
        profile = powderProfile(r.peaks, p);
        profileMs = performance.now() - t0;
      } catch (e) {
        profile = null;
        error = e instanceof Error ? e.message : String(e);
      }
    });
  });

  const merged = $derived(peakResult ? mergePeaks(peakResult.peaks) : []);

  // The view fits again when the structure, the axis or the angle range changes, not on every edit.
  let fitKey = '';
  $effect(() => {
    const key = [
      crystal?.name,
      settings.axis,
      settings.twoThetaMin,
      settings.twoThetaMax,
      lambda1,
      settings.zeroShift,
      profile ? 1 : 0,
    ].join('|');
    if (!profile || (key === fitKey && !restoreView)) return;
    fitKey = key;
    const back = restoreView;
    restoreView = null;
    void tick().then(() => (back ? (plotView = back) : plot?.fit()));
  });

  $effect(() => {
    void crystal;
    selected = null;
  });

  // ---- the peak table ---------------------------------------------------------------------------------

  type Column = 'hkl' | 'm' | 'd' | 'twoTheta' | 'F' | 'I';
  let sortBy = $state<{ column: Column; ascending: boolean }>({
    column: 'twoTheta',
    ascending: true,
  });

  function sortOn(column: Column) {
    sortBy =
      sortBy.column === column
        ? { column, ascending: !sortBy.ascending }
        : { column, ascending: column === 'hkl' || column === 'twoTheta' };
  }

  const rows = $derived.by(() => {
    const list = [...(peakResult?.peaks ?? [])];
    const sign = sortBy.ascending ? 1 : -1;
    const value = (p: (typeof list)[number]): number =>
      sortBy.column === 'hkl'
        ? p.hkl[0] * 1e6 + p.hkl[1] * 1e3 + p.hkl[2]
        : sortBy.column === 'm'
          ? p.m
          : sortBy.column === 'd'
            ? p.d
            : sortBy.column === 'F'
              ? p.F
              : sortBy.column === 'I'
                ? p.I
                : p.twoTheta;
    list.sort((a, b) => sign * (value(a) - value(b)) || a.twoTheta - b.twoTheta);
    return list;
  });

  const keyOf = (hkl: readonly number[]) => hkl.join(' ');
  const arrow = (c: Column) => (sortBy.column === c ? (sortBy.ascending ? ' ▲' : ' ▼') : '');

  function selectRow(hkl: readonly number[]) {
    selected = selected === keyOf(hkl) ? null : keyOf(hkl);
  }

  const baseName = () => safeName(fileName || (crystal?.name ?? ''), 'powder');

  // ---- export (M12): the plot as an image in its header, the data as CSV by the peak table -----------

  function savePeaks() {
    if (!peakResult) return;
    const sorted = [...peakResult.peaks].sort((a, b) => a.twoTheta - b.twoTheta);
    downloadText(peaksToCsv(sorted), `${baseName()}_peaks.csv`, 'text/csv');
  }

  /** 2θ, d, Q and the calculated intensity at every step (d and Q for the first wavelength). */
  function saveProfile() {
    if (!profile) return;
    downloadText(profileToCsv(profile, lambda1), `${baseName()}_profile.csv`, 'text/csv');
  }

  const exportSections: ExportSection[] = [
    {
      title: 'Image of the pattern',
      image: true,
      rows: svgImageRows({ get: () => plot?.svgElement(), name: () => `${baseName()}_xrd` }),
    },
  ];
  const plotSize = () => {
    const el = plot?.svgElement();
    if (!el) return null;
    const { w, h } = svgSize(el);
    return { width: w, height: h };
  };

  // ---- misc controls -------------------------------------------------------------------------------------

  const parseHkl = (t: string): [number, number, number] | null => {
    const v = t
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    return v.length === 3 && v.every(Number.isInteger) && v.some((x) => x !== 0)
      ? [v[0], v[1], v[2]]
      : null;
  };
  let hklText = $state('0 0 1');
  function setHkl(t: string) {
    hklText = t;
    const v = parseHkl(t);
    if (v) settings.preferredHkl = v;
  }

  const RADIATION_LABEL = (r: PxrdRadiation) => {
    const a = XRAY_DOUBLETS.find((d) => d.id === r);
    return a
      ? `${a.label} (${a.lambda1.toFixed(4)} Å)`
      : r === 'custom'
        ? 'Other X-ray λ'
        : 'Neutrons (constant λ)';
  };
  const RADIATIONS: PxrdRadiation[] = [
    'CuKa',
    'CoKa',
    'MoKa',
    'CrKa',
    'FeKa',
    'AgKa',
    'custom',
    'neutron',
  ];

  // The test hook (also handy in the console).
  (window as unknown as Record<string, unknown>).__crystallensXRD = {
    peaks: () =>
      (peakResult?.peaks ?? []).map((p) => ({
        hkl: [...p.hkl],
        m: p.m,
        d: p.d,
        twoTheta: p.twoTheta,
        F: p.F,
        I: p.I,
      })),
    merged: () => merged.length,
    lambda: () => lambda1,
    ms: () => ({ peaks: peakMs, profile: profileMs }),
    view: () => ({ ...plotView }),
    profile: () =>
      profile && {
        n: profile.twoTheta.length,
        max: Math.max(...profile.intensity),
        first: profile.twoTheta[0],
        last: profile.twoTheta[profile.twoTheta.length - 1],
      },
    labels: () => plot?.drawnLabels() ?? 0,
    ticks: () => plot?.visiblePeaks() ?? 0,
    peakClient: (key: string) => plot?.peakClient(key) ?? null,
    cifB: () => cifB,
  };
</script>

<section class="xrd" aria-label="Powder X-ray diffraction" data-testid="xrd-tab">
  <div class="toolbar card">
    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Radiation</legend>
      <div class="ctl">
        <select bind:value={settings.radiation} aria-label="Radiation" data-testid="xrd-radiation">
          {#each RADIATIONS as r (r)}<option value={r}>{RADIATION_LABEL(r)}</option>{/each}
        </select>
        {#if !anode}
          <label class="unit" title="Wavelength">
            λ
            <input
              class="num"
              type="number"
              min="0.05"
              max="20"
              step="0.01"
              bind:value={settings.wavelength}
              aria-label="Wavelength in angstrom"
              data-testid="xrd-lambda"
            />Å
          </label>
        {:else}
          <label class="chip" title="Add the Kα₂ line of the anode">
            <input type="checkbox" bind:checked={settings.kalpha2} data-testid="xrd-ka2" /> Kα₂
          </label>
          <label class="unit" title="Intensity ratio Kα₂ / Kα₁" class:off={!settings.kalpha2}>
            ratio
            <input
              class="num small"
              type="number"
              min="0"
              max="1"
              step="0.05"
              bind:value={settings.kalphaRatio}
              disabled={!settings.kalpha2}
              aria-label="Kalpha2 to Kalpha1 ratio"
              data-testid="xrd-ratio"
            />
          </label>
        {/if}
        <span class="muted" data-testid="xrd-wavelength">λ = {fmt(lambda1, 5)} Å</span>
      </div>
    </fieldset>

    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Range (2θ)</legend>
      <div class="ctl">
        <input
          class="num"
          type="number"
          min="0"
          max="179"
          step="1"
          bind:value={settings.twoThetaMin}
          aria-label="2θ from"
          data-testid="xrd-min"
        />–<input
          class="num"
          type="number"
          min="1"
          max="180"
          step="1"
          bind:value={settings.twoThetaMax}
          aria-label="2θ to"
          data-testid="xrd-max"
        />°
        <label class="unit" title="Step of the calculated curve">
          step
          <input
            class="num small"
            type="number"
            min="0.001"
            max="2"
            step="0.005"
            bind:value={settings.step}
            aria-label="Step in degrees"
            data-testid="xrd-step"
          />°
        </label>
      </div>
    </fieldset>

    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Peak shape</legend>
      <div class="ctl">
        <span class="strain" title="Caglioti width: FWHM² = U tan²θ + V tanθ + W (degrees²)">
          U
          <input
            class="num small"
            type="number"
            step="0.001"
            bind:value={settings.U}
            aria-label="Caglioti U"
            data-testid="xrd-U"
          />
          V
          <input
            class="num small"
            type="number"
            step="0.001"
            bind:value={settings.V}
            aria-label="Caglioti V"
            data-testid="xrd-V"
          />
          W
          <input
            class="num small"
            type="number"
            step="0.001"
            bind:value={settings.W}
            aria-label="Caglioti W"
            data-testid="xrd-W"
          />
        </span>
        <label class="unit" title="Pseudo-Voigt mixing: 0 Gaussian, 1 Lorentzian">
          η
          <input
            class="num small"
            type="number"
            min="0"
            max="1"
            step="0.05"
            bind:value={settings.eta}
            aria-label="Pseudo-Voigt mixing eta"
            data-testid="xrd-eta"
          />
        </label>
        <label class="unit" title="Crystallite size for Scherrer broadening; 0 = none">
          size
          <input
            class="num small"
            type="number"
            min="0"
            step="5"
            bind:value={settings.sizeNm}
            aria-label="Crystallite size in nm"
            data-testid="xrd-size"
          />nm
        </label>
        <label class="unit" title="Microstrain broadening 4 ε tanθ; 0 = none">
          strain
          <input
            class="num small"
            type="number"
            min="0"
            max="10"
            step="0.05"
            bind:value={settings.strainPercent}
            aria-label="Microstrain in per cent"
            data-testid="xrd-strain"
          />%
        </label>
      </div>
    </fieldset>

    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Instrument and sample</legend>
      <div class="ctl">
        <label class="unit" title="Zero-point shift added to every 2θ">
          zero
          <input
            class="num small"
            type="number"
            min="-5"
            max="5"
            step="0.01"
            bind:value={settings.zeroShift}
            aria-label="Zero shift in degrees"
            data-testid="xrd-zero"
          />°
        </label>
        {#if kind === 'xray'}
          <label
            class="unit"
            title="Monochromator angle 2θ_m for the polarisation factor; 0 = none (graphite 002 with Cu: 26.6°)"
          >
            2θ<sub>m</sub>
            <input
              class="num small"
              type="number"
              min="0"
              max="90"
              step="0.1"
              bind:value={settings.monoAngle}
              aria-label="Monochromator angle in degrees"
              data-testid="xrd-mono"
            />°
          </label>
        {/if}
        <label class="chip" title="March-Dollase preferred orientation along a plane normal (hkl)">
          <input type="checkbox" bind:checked={settings.preferred} data-testid="xrd-po" /> Preferred orientation
        </label>
        {#if settings.preferred}
          <label class="unit" title="March axis (hkl)">
            <input
              class="hkl"
              value={hklText}
              oninput={(e) => setHkl(e.currentTarget.value)}
              aria-label="March axis hkl"
              data-testid="xrd-po-hkl"
            />
          </label>
          <label class="unit" title="March ratio r: below 1 plates, above 1 needles">
            r
            <input
              class="num small"
              type="number"
              min="0.1"
              max="10"
              step="0.05"
              bind:value={settings.preferredR}
              aria-label="March ratio"
              data-testid="xrd-po-r"
            />
          </label>
        {/if}
      </div>
    </fieldset>

    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Atoms</legend>
      <div class="ctl">
        <label
          class="chip"
          title="Thermal vibration damps every reflection by exp(−B sin²θ/λ²), B = 8π²U"
        >
          <input type="checkbox" bind:checked={settings.debyeWaller} data-testid="xrd-dw" /> Debye–Waller
          factor
        </label>
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
            data-testid="xrd-dw-b"
          />Å²
        </label>
        {#if settings.debyeWallerB !== null}
          <button
            type="button"
            onclick={() => (settings.debyeWallerB = null)}
            title="Back to the displacement parameters of the CIF, atom by atom"
            data-testid="xrd-dw-cif">use CIF</button
          >
        {:else}
          <span class="muted" data-testid="xrd-dw-note"
            >{cifB > 0 ? 'from the CIF' : 'CIF has none'}</span
          >
        {/if}
        {#if kind === 'xray'}
          <label
            class="chip"
            title="Use ionic scattering factors where the CIF gives oxidation states (e.g. Fe3+)"
          >
            <input type="checkbox" bind:checked={settings.ionic} data-testid="xrd-ionic" /> Ionic factors
          </label>
        {/if}
      </div>
    </fieldset>

    <fieldset class="tgroup" disabled={!crystal}>
      <legend>Display</legend>
      <div class="ctl">
        <select bind:value={settings.axis} aria-label="Horizontal axis" data-testid="xrd-axis">
          <option value="tt">2θ</option>
          <option value="d">d</option>
          <option value="Q">Q = 2π/d</option>
        </select>
        <select
          bind:value={settings.intensityScale}
          aria-label="Intensity scale"
          data-testid="xrd-scale"
        >
          <option value="linear">Linear</option>
          <option value="sqrt">√ intensity</option>
        </select>
        <label class="chip" title="Label the strongest peaks with their hkl">
          <input type="checkbox" bind:checked={settings.labels} data-testid="xrd-labels" /> hkl labels
        </label>
        <label class="unit" title="Peaks weaker than this per cent of the strongest are left out">
          min
          <input
            class="num small"
            type="number"
            min="0"
            max="50"
            step="0.1"
            bind:value={settings.minPercent}
            aria-label="Weakest peak kept, per cent"
            data-testid="xrd-minpct"
          />%
        </label>
      </div>
    </fieldset>
  </div>

  <div class="card plotcard">
    <div class="phead">
      <span class="phead-title">
        <span>Powder pattern · <span class="proper">{radiationName}</span></span>
        <ExportMenu
          sections={exportSections}
          disabled={!crystal}
          imageSize={plotSize}
          testid="xrd-export"
          compact
        />
      </span>
      <span class="phead-tools">
        <span class="seg small">
          <button
            type="button"
            onclick={() => plot?.zoomOut()}
            aria-label="Zoom out"
            data-testid="xrd-zoom-out">−</button
          ><button
            type="button"
            onclick={() => plot?.fit()}
            title="Show the whole range"
            data-testid="xrd-fit">Reset</button
          ><button
            type="button"
            onclick={() => plot?.zoomIn()}
            aria-label="Zoom in"
            data-testid="xrd-zoom-in">+</button
          >
        </span>
      </span>
    </div>
    <div class="plotbox">
      <PxrdPlot
        bind:this={plot}
        {profile}
        peaks={merged}
        lambda={lambda1}
        axis={settings.axis}
        scale={settings.intensityScale}
        labels={settings.labels}
        bind:view={plotView}
        {selected}
        onSelect={(k) => (selected = k)}
      />
      {#if !crystal}
        <div class="empty">
          <Logo size={48} />
          <p>Open a CIF above to calculate its powder pattern.</p>
        </div>
      {/if}
      {#if crystal && peakResult}
        <div class="hud" data-testid="xrd-hud">
          {peakResult.peaks.length.toLocaleString('en')} peaks · {fmt(peakMs + profileMs, 1)} ms
        </div>
      {/if}
      {#if error}<p class="empty err" role="alert">{error}</p>{/if}
    </div>
    {#each peakResult?.warnings ?? [] as w, i (i)}<p class="warn" role="status">{w}</p>{/each}
  </div>

  <div class="below">
    <article class="card table" data-testid="peak-table">
      <header>
        <h3>Peak table</h3>
        <span class="muted">{rows.length} peaks · Kα₁ positions</span>
        <span class="csv">
          <button
            type="button"
            onclick={savePeaks}
            disabled={rows.length === 0}
            title="hkl, multiplicity, d, 2θ, |F| and intensity of every line in the table"
            data-testid="xrd-csv">Save peak table (CSV)</button
          >
          <button
            type="button"
            onclick={saveProfile}
            disabled={!profile}
            title="2θ, d, Q and the calculated intensity at every step of the curve (d and Q for Kα₁)"
            data-testid="xrd-profile-csv">Save profile (CSV)</button
          >
        </span>
      </header>
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th
                ><button class="sort" onclick={() => sortOn('hkl')} data-testid="sort-hkl"
                  >(hkl){arrow('hkl')}</button
                ></th
              >
              <th
                ><button class="sort" onclick={() => sortOn('m')} data-testid="sort-m"
                  >m{arrow('m')}</button
                ></th
              >
              <th
                ><button class="sort" onclick={() => sortOn('d')} data-testid="sort-d"
                  >d (Å){arrow('d')}</button
                ></th
              >
              <th
                ><button class="sort" onclick={() => sortOn('twoTheta')} data-testid="sort-tt"
                  >2θ (°){arrow('twoTheta')}</button
                ></th
              >
              <th
                ><button class="sort" onclick={() => sortOn('F')} data-testid="sort-F"
                  >|F|{arrow('F')}</button
                ></th
              >
              <th
                ><button class="sort" onclick={() => sortOn('I')} data-testid="sort-I"
                  >I{arrow('I')}</button
                ></th
              >
            </tr>
          </thead>
          <tbody>
            {#each rows as p (keyOf(p.hkl))}
              <tr
                class:sel={selected === keyOf(p.hkl)}
                onclick={() => selectRow(p.hkl)}
                data-testid="peak-row"
              >
                <td>{p.hkl.join(' ')}</td>
                <td>{p.m}</td>
                <td>{fmt(p.d)}</td>
                <td>{fmt(p.twoTheta, 3)}</td>
                <td>{fmt(p.F, 2)}</td>
                <td>{fmt(p.I, 2)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="note">
        m: number of equivalent planes (± included); |F| in {kind === 'xray' ? 'electrons' : 'fm'};
        I: integrated, 100 = the strongest peak. Reflections at the same 2θ appear in separate rows.
      </p>
    </article>

    <ScatteringLookup />
  </div>

  <p class="hint">
    <kbd>wheel</kbd> zoom the horizontal axis · <kbd>drag</kbd> pan · <kbd>double-click</kbd> reset to
    the whole range · hover a tick for its data, click it (or a table row) to select it. The curve is
    the sum of one pseudo-Voigt per peak with its integrated intensity as area; the horizontal axis can
    show 2θ, d or Q.
  </p>
</section>

<style>
  .xrd {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    padding: 0.35rem 0.4rem;
    font-size: 0.84rem;
  }
  .tgroup {
    margin: 0;
    padding: 0.25rem 0.85rem 0.35rem;
    border: none;
    border-right: 1px solid var(--border);
    min-width: 0;
  }
  .tgroup:last-child {
    border-right: none;
  }
  .tgroup:disabled {
    opacity: 0.55;
  }
  legend {
    float: left;
    width: 100%;
    padding: 0;
    margin-bottom: 0.25rem;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ctl {
    clear: both;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.6rem;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.15rem 0.55rem 0.15rem 0.4rem;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    cursor: pointer;
    user-select: none;
  }
  .chip:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--accent-ink);
  }
  .chip input {
    margin: 0;
  }
  .unit,
  .strain {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .off {
    opacity: 0.5;
  }
  .num {
    width: 4.4rem;
    padding: 0.15rem 0.3rem;
  }
  .num.small {
    width: 3.9rem;
  }
  .hkl {
    width: 4.4rem;
    padding: 0.15rem 0.3rem;
    text-align: center;
    font-family: var(--mono);
  }
  .muted {
    color: var(--muted);
    font-family: var(--mono);
    font-size: 0.8rem;
  }
  .seg {
    display: inline-flex;
  }
  .seg > button {
    border-radius: 0;
    margin-left: -1px;
    min-width: 1.8rem;
    padding: 0.05rem 0.5rem;
    font-size: 0.78rem;
  }
  .seg > button:first-child {
    border-radius: 6px 0 0 6px;
    margin-left: 0;
  }
  .seg > button:last-child {
    border-radius: 0 6px 6px 0;
  }

  .plotcard {
    overflow: hidden;
  }
  .proper {
    text-transform: none;
    letter-spacing: 0;
  }
  .plotbox {
    position: relative;
    min-height: 380px;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    margin: 0;
    padding: 1rem;
    text-align: center;
    pointer-events: none;
    color: #5b6578;
    background: rgba(255, 255, 255, 0.7);
  }
  .empty p {
    margin: 0;
  }
  .err {
    color: var(--err);
  }
  .warn {
    margin: 0;
    padding: 0.3rem 0.6rem;
    font-size: 0.82rem;
    color: var(--warn);
  }
  .hud {
    position: absolute;
    right: 0.7rem;
    top: 0.5rem;
    padding: 0.05rem 0.45rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.75);
    font: 0.7rem var(--mono);
    color: #5b6578;
    pointer-events: none;
  }

  .below {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 1fr);
    gap: 0.75rem;
    align-items: start;
  }
  .table {
    padding: 0.7rem 1rem;
    min-width: 0;
  }
  .table header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem 1rem;
    margin-bottom: 0.5rem;
  }
  .table h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-h);
  }
  .csv {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-left: auto;
  }
  .scroll {
    max-height: 22rem;
    overflow: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--mono);
    font-size: 0.82rem;
  }
  thead th {
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 1;
  }
  th,
  td {
    padding: 0.2rem 0.8rem 0.2rem 0;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  .sort {
    padding: 0;
    border: none;
    background: none;
    color: var(--muted);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .sort:hover {
    color: var(--accent-ink);
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover {
    background: var(--surface-2);
  }
  tbody tr.sel {
    background: var(--accent-soft);
  }
  .note {
    margin: 0.5rem 0 0;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
  }
  kbd {
    padding: 0 0.3rem;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 4px;
    font: 0.72rem var(--mono);
    background: var(--surface);
  }
  @media (max-width: 60rem) {
    .below {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
