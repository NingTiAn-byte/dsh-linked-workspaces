import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const files = ['index.js', 'client.js', ...(await readdir('src')).filter(f => f.endsWith('.js')).map(f => 'src/' + f)];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
await import('../index.js');
console.log('Syntax and rc.2 SDK imports passed.');
