// Keep machine-specific overlay paths out of the source repository.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const artifact = resolve(root, 'artifacts');
await mkdir(artifact, { recursive: true });
await writeFile(resolve(artifact, 'live.overlay.yml'), `- insert:\n    - id: linked-workspaces-test-fixture\n      name: ${JSON.stringify(resolve(root, 'tests/live-fixture.js').replaceAll('\\', '/'))}\n- id: tools\n  config:\n    mode: native\n- id: session-title-llm\n  disabled: true\n- id: session-telemetry-otel\n  disabled: true\n- id: desktop-product-telemetry\n  disabled: true\n`);
console.log('Prepared artifacts/live.overlay.yml');
