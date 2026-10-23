import * as Comlink from 'comlink';
import type { ComputeApi } from './compute.worker';

let remote: Comlink.Remote<ComputeApi> | undefined;

/** Lazily starts the compute worker and returns a typed proxy to it. */
export function getCompute(): Comlink.Remote<ComputeApi> {
  if (!remote) {
    const worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' });
    remote = Comlink.wrap<ComputeApi>(worker);
  }
  return remote;
}
