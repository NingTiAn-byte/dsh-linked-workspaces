import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
test(`host services resolve consistently to ${process.env.DSH_TEST_HOST_VERSION ?? '0.2.1-rc.2'}`, () => {
  const expected = process.env.DSH_TEST_HOST_VERSION ?? '0.2.1-rc.2';
  for (const name of ['session', 'tools', 'session-projection', 'storage-domain']) {
    assert.equal(JSON.parse(readFileSync(require.resolve(`@deepseek-ai/dsh-${name}/package.json`), 'utf8')).version, expected, name);
  }
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.engines.dsh, '0.2.1-alpha.4 || 0.2.1-rc.2');
  for (const [name, range] of Object.entries(manifest.peerDependencies)) if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(range, manifest.engines.dsh, name);
});
