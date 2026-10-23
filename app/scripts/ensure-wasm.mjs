// Fails fast with an actionable message when the generated WASM package is missing.
// `src/wasm/` is build output (gitignored); create it with `npm run build:wasm`.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const entry = fileURLToPath(new URL('../src/wasm/kernels.js', import.meta.url));

if (!existsSync(entry)) {
  console.error(
    '\nThe Rust/WASM kernel has not been built yet (src/wasm/kernels.js is missing).\n' +
      'Run `npm run build:wasm` first. It needs Rust, the wasm32-unknown-unknown target and\n' +
      'wasm-pack (see context.md section 10, "Dev environment").\n',
  );
  process.exit(1);
}
