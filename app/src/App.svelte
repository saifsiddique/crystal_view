<script lang="ts">
  import { onMount } from 'svelte';
  import { APP_NAME } from './core/meta';
  import { getCompute } from './workers/client';

  type Check = { state: 'pending' | 'ok' | 'error'; detail: string };

  let kernel = $state<Check>({ state: 'pending', detail: 'starting worker…' });
  let cores = $state<number | null>(null);

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
</script>

<main>
  <h1>{APP_NAME}</h1>
  <p class="tagline">Crystal structures and diffraction in the browser.</p>

  <section aria-label="Build status">
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
      <dt>Worker pool size</dt>
      <dd>{cores === null ? '…' : Math.max(1, cores - 1)}</dd>
    </dl>
  </section>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: 3rem 1.5rem;
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-h);
  }
  .tagline {
    margin: 0.25rem 0 2rem;
  }
  h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-h);
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.4rem 1.5rem;
    margin: 0;
  }
  dt {
    color: var(--text);
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
</style>
