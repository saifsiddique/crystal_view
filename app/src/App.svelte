<script lang="ts">
  import { onMount } from 'svelte';
  import { APP_NAME } from './core/meta';
  import { getCompute } from './workers/client';
  import Inspector from './Inspector.svelte';
  import LoadBar, { type Loaded } from './ui/LoadBar.svelte';
  import Logo from './ui/Logo.svelte';
  import { defaultViewSettings, type ViewSettings } from './core/structure/settings';

  type Check = { state: 'pending' | 'ok' | 'error'; detail: string };

  let kernel = $state<Check>({ state: 'pending', detail: 'starting worker…' });
  let cores = $state<number | null>(null);
  let loaded = $state.raw<Loaded>({ crystal: null, fileName: '', warnings: [] });
  // The Structure Viewer's settings, shared with the diffraction tab (colours, styles, bonds).
  let viewSettings = $state<ViewSettings>(defaultViewSettings(null));

  const TABS = [
    { id: 'structure', label: 'Structure Viewer' },
    { id: 'ed', label: 'Electron Diffraction' },
    { id: 'xrd', label: 'Powder XRD' },
  ] as const;
  type TabId = (typeof TABS)[number]['id'];
  let tab = $state<TabId>('structure');
  // A tab is mounted the first time it is opened and then kept, hidden, so its view survives.
  let opened = $state<Record<TabId, boolean>>({ structure: true, ed: false, xrd: false });

  function select(id: TabId) {
    tab = id;
    opened[id] = true;
  }

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    select(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  onMount(async () => {
    try {
      const compute = getCompute();
      const [version, total, n] = await Promise.all([
        compute.wasmVersion(),
        compute.sumF64(new Float64Array([1, 2, 3.5])),
        compute.cores(),
      ]);
      cores = n;
      kernel =
        total === 6.5
          ? { state: 'ok', detail: `v${version}` }
          : { state: 'error', detail: `unexpected sum ${total}` };
    } catch (err) {
      kernel = { state: 'error', detail: err instanceof Error ? err.message : String(err) };
    }
  });

  const statusText = $derived(
    kernel.state === 'pending' ? 'Starting…' : kernel.state === 'ok' ? 'Ready' : 'Engine error',
  );
</script>

<header class="top">
  <div></div>
  <div class="brand">
    <Logo size={44} />
    <div>
      <h1 aria-label={APP_NAME}>Crystal Viewer<sup>Lite</sup></h1>
      <p class="tagline">Crystal structures and diffraction in the browser</p>
    </div>
  </div>

  <!-- The pipeline check, folded into a status pill; click it for the details. -->
  <details class="status" aria-label="Build status">
    <summary data-state={kernel.state} title="Compute engine status">
      <span class="dot"></span>{statusText}
    </summary>
    <div class="pop card">
      <h2>Pipeline check</h2>
      <dl>
        <dt>Compute worker</dt>
        <dd data-testid="worker-status" data-state={kernel.state}>
          {kernel.state === 'pending' ? 'starting…' : kernel.state === 'ok' ? 'running' : 'failed'}
        </dd>
        <dt>WASM kernel</dt>
        <dd data-testid="kernel-status" data-state={kernel.state}>
          {kernel.state === 'ok' ? `kernel ${kernel.detail}` : kernel.detail}
        </dd>
        <!-- One compute worker exists so far; the heavy modules (M10, M11) add a pool sized from
             the CPU thread count. -->
        <dt>CPU threads</dt>
        <dd>{cores === null ? '…' : `${cores} (compute workers running: 1)`}</dd>
      </dl>
    </div>
  </details>
</header>

<main>
  <LoadBar onLoad={(l) => (loaded = l)} />

  <div class="tabs" role="tablist" aria-label="Views">
    {#each TABS as t (t.id)}
      <button
        type="button"
        role="tab"
        id={`tab-${t.id}`}
        aria-selected={tab === t.id}
        aria-controls={`panel-${t.id}`}
        tabindex={tab === t.id ? 0 : -1}
        onclick={() => select(t.id)}
        onkeydown={onTabKey}
        data-testid={`tab-${t.id}`}>{t.label}</button
      >
    {/each}
  </div>

  <div
    class="tabpanel"
    role="tabpanel"
    id="panel-structure"
    aria-labelledby="tab-structure"
    hidden={tab !== 'structure'}
  >
    {#await import('./ui/Viewer.svelte') then { default: Viewer }}
      <Viewer crystal={loaded.crystal} fileName={loaded.fileName} bind:settings={viewSettings} />
    {/await}

    <Inspector crystal={loaded.crystal} fileName={loaded.fileName} warnings={loaded.warnings} />
  </div>

  <div
    class="tabpanel"
    role="tabpanel"
    id="panel-ed"
    aria-labelledby="tab-ed"
    hidden={tab !== 'ed'}
  >
    {#if opened.ed}
      {#await import('./ui/DiffractionTab.svelte') then { default: DiffractionTab }}
        <DiffractionTab crystal={loaded.crystal} fileName={loaded.fileName} {viewSettings} />
      {/await}
    {/if}
  </div>

  <div
    class="tabpanel"
    role="tabpanel"
    id="panel-xrd"
    aria-labelledby="tab-xrd"
    hidden={tab !== 'xrd'}
  >
    {#if opened.xrd}
      {#await import('./ui/PowderTab.svelte') then { default: PowderTab }}
        <PowderTab crystal={loaded.crystal} fileName={loaded.fileName} />
      {/await}
    {/if}
  </div>
</main>

<style>
  .top {
    position: relative;
    z-index: 20;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0.9rem 1.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  h1 sup {
    margin-left: 0.15em;
    font-size: 0.5em;
    font-weight: 600;
    letter-spacing: 0;
    vertical-align: super;
    line-height: 0;
  }
  h1 {
    margin: 0;
    font-size: 1.6rem;
    line-height: 1.1;
    font-weight: 700;
    letter-spacing: -0.02em;
    background: linear-gradient(90deg, #4f46e5, #0d9488);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
  .tagline {
    margin: 0.1rem 0 0;
    font-size: 0.82rem;
    color: var(--muted);
  }
  .status {
    justify-self: end;
    position: relative;
  }
  .status summary {
    list-style: none;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.25rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 0.82rem;
    color: var(--text-h);
    user-select: none;
  }
  .status summary::-webkit-details-marker {
    display: none;
  }
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: #f59e0b;
  }
  summary[data-state='ok'] .dot {
    background: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
  }
  summary[data-state='error'] .dot {
    background: #ef4444;
  }
  .pop {
    position: absolute;
    right: 0;
    top: calc(100% + 0.4rem);
    min-width: 19rem;
    padding: 0.8rem 1rem;
  }
  .pop h2 {
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
    color: var(--text-h);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.3rem 1.2rem;
    margin: 0;
    font-size: 0.85rem;
  }
  dd {
    margin: 0;
    font-family: var(--mono);
    color: var(--text-h);
  }
  dd[data-state='ok'] {
    color: var(--ok);
  }
  dd[data-state='error'] {
    color: var(--err);
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1.5rem 3rem;
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: -0.4rem;
    border-bottom: 1px solid var(--border);
  }
  .tabs [role='tab'] {
    margin-bottom: -1px;
    padding: 0.45rem 1.1rem;
    border: 1px solid transparent;
    border-radius: 8px 8px 0 0;
    background: none;
    color: var(--muted);
    font-weight: 600;
  }
  .tabs [role='tab']:hover {
    color: var(--text-h);
  }
  .tabs [role='tab'][aria-selected='true'] {
    border-color: var(--border);
    border-bottom-color: var(--bg);
    background: var(--bg);
    color: var(--accent-ink);
  }
  .tabpanel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .tabpanel[hidden] {
    display: none;
  }
  @media (max-width: 40rem) {
    .top {
      grid-template-columns: 1fr auto;
      padding: 0.7rem 1rem;
    }
    .top > div:first-child {
      display: none;
    }
    main {
      padding: 0.75rem 1rem 2rem;
    }
  }
</style>
