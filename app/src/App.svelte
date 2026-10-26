<script lang="ts">
  import { onMount } from 'svelte';
  import { APP_NAME } from './core/meta';
  import { getCompute } from './workers/client';
  import Inspector from './Inspector.svelte';
  import LoadBar, { type Loaded } from './ui/LoadBar.svelte';
  import Logo from './ui/Logo.svelte';

  type Check = { state: 'pending' | 'ok' | 'error'; detail: string };

  let kernel = $state<Check>({ state: 'pending', detail: 'starting worker…' });
  let cores = $state<number | null>(null);
  let loaded = $state.raw<Loaded>({ crystal: null, fileName: '', warnings: [] });

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
      <h1>{APP_NAME}</h1>
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

  {#await import('./ui/Viewer.svelte') then { default: Viewer }}
    <Viewer crystal={loaded.crystal} />
  {/await}

  <Inspector crystal={loaded.crystal} fileName={loaded.fileName} warnings={loaded.warnings} />
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
