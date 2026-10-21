import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { LinkedWorkspaces } from '../src/manager.js';
import { domainSpec, projection, contextText } from '../src/model.js';
import { searchSources, readSource } from '../src/files.js';

export const config = { readMaxBytes: 65536, instructionMaxBytes: 16384, searchFileMaxBytes: 65536,
  searchMaxResults: 40, searchMaxEntries: 10000, searchMaxWarnings: 30, searchTimeoutMs: 5000, previewChars: 240 };

async function fixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'dsh-linked-test-'));
  t.after(async () => { assert.ok(temp.includes('dsh-linked-test-')); await rm(temp, { recursive: true, force: true }); });
  const main = join(temp, 'app'), components = join(temp, 'components'), api = join(temp, 'api');
  await Promise.all([main, components, api].map(path => mkdir(path)));
  await mkdir(join(components, 'src'));
  await writeFile(join(components, 'AGENTS.md'), 'Use accessible components.');
  await writeFile(join(components, 'src', 'AGENTS.md'), 'Use named exports.');
  await writeFile(join(components, 'src', 'Button.tsx'), 'export const Button = () => "hello component";\n');
  await writeFile(join(main, 'Button.tsx'), 'primary Button\n');
  await writeFile(join(api, 'routes.ts'), 'export const endpoint = "/hello";\n');
  const canonical = await Promise.all([main, components, api].map(path => realpath(path)));
  const snapshot = { version: 1, projectId: 'app', mainPath: canonical[0], revision: 1, links: [
    { alias: 'components', path: canonical[1], purpose: 'Shared UI' }, { alias: 'api', path: canonical[2], purpose: 'API definitions' },
  ] };
  return { temp, main, components, api, snapshot };
}

test('search distinguishes same-named files, searches text across roots, and read includes scoped instructions', async t => {
  const f = await fixture(t);
  const files = await searchSources(f.snapshot, { query: 'button', mode: 'files' }, config);
  assert.deepEqual(files.matches.map(m => m.file), ['main/Button.tsx', 'components/src/Button.tsx']);
  const text = await searchSources(f.snapshot, { query: 'HELLO', mode: 'text' }, config);
  assert.equal(text.matches.length, 2); assert.equal(text.matches[0].line, 1);
  const read = await readSource(f.snapshot, { workspace: 'components', path: 'src/Button.tsx' }, config);
  assert.match(read.content, /hello component/); assert.equal(read.instructions.length, 2);
  assert.match(read.instructions[1].text, /named exports/);
  assert.equal(await readFile(join(f.main, 'Button.tsx'), 'utf8'), 'primary Button\n');
});

test('excluded paths, traversal, binary files and symbolic links cannot expose outside contents', async t => {
  const f = await fixture(t);
  await writeFile(join(f.components, '.env'), 'secret hello');
  await writeFile(join(f.components, 'token.key'), 'secret hello');
  await mkdir(join(f.components, 'node_modules'));
  await writeFile(join(f.components, 'node_modules', 'hidden.ts'), 'secret hello');
  await writeFile(join(f.components, 'binary.dat'), Buffer.from([0, 1, 2]));
  await symlink(f.api, join(f.components, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const path of ['../api/routes.ts', '.env', 'token.key', '/etc/passwd', 'C:/Windows/win.ini'])
    await assert.rejects(readSource(f.snapshot, { workspace: 'components', path }, config));
  await assert.rejects(readSource(f.snapshot, { workspace: 'components', path: 'outside/routes.ts' }, config), { code: 'outside-root' });
  await assert.rejects(readSource(f.snapshot, { workspace: 'components', path: 'binary.dat' }, config), { code: 'binary-file' });
  const result = await searchSources(f.snapshot, { workspace: 'components', query: 'secret', mode: 'text' }, config);
  assert.equal(result.matches.length, 0);
});

test('missing roots, truncation and cancellation are explicit', async t => {
  const f = await fixture(t);
  await rm(f.api, { recursive: true });
  const result = await searchSources(f.snapshot, { query: 'Button', mode: 'files' }, config);
  assert.equal(result.matches.length, 2); assert.equal(result.warnings[0].workspace, 'api');
  const limited = await searchSources(f.snapshot, { query: 'Button', mode: 'files' }, { ...config, searchMaxResults: 1 });
  assert.equal(limited.matches.length, 1); assert.equal(limited.truncated, true);
  const abort = AbortSignal.abort();
  await assert.rejects(searchSources(f.snapshot, { query: 'Button', mode: 'files' }, config, abort));
  const truncated = await readSource(f.snapshot, { workspace: 'components', path: 'src/Button.tsx' }, { ...config, readMaxBytes: 10 });
  assert.equal(truncated.truncated, true);
});

async function managerFixture(t, f) {
  const ctx = new Context();
  await ctx.plugin(SessionStore); await ctx.plugin(SessionProjectionRegistry);
  await ctx.plugin(Storage); await ctx.plugin(StorageJson, { root: join(f.temp, 'storage') });
  await ctx.plugin(StorageDomain, { backend: 'json' });
  ctx.sessionProjections.register(projection);
  const workspace = { id: 'app', title: 'App', path: f.snapshot.mainPath };
  ctx.provide('workspaceRegistry', { get: id => id === 'app' ? workspace : undefined, list: () => [workspace] });
  const domain = await ctx.storageDomain.open(domainSpec);
  const manager = new LinkedWorkspaces(ctx, domain.table('projects'));
  t.after(async () => { await manager.close(); await domain.close(); await ctx.fiber.dispose(); });
  return { ctx, manager, domain };
}

test('durable project saves reject overlapping paths and stale simultaneous writes', async t => {
  const f = await fixture(t), h = await managerFixture(t, f);
  await assert.rejects(h.manager.save({ projectId: 'app', expectedRevision: 0, links: [{ alias: 'child', path: f.main, purpose: '' }] }), { code: 'overlapping-root' });
  const input = { projectId: 'app', expectedRevision: 0, links: f.snapshot.links };
  const both = await Promise.allSettled([h.manager.save(input), h.manager.save(input)]);
  assert.equal(both.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(both.find(r => r.status === 'rejected').reason.code, 'revision-conflict');
  assert.equal((await h.manager.list())[0].revision, 1);
  const disk = await readFile(join(f.temp, 'storage', 'local_linked_workspaces.json'), 'utf8');
  assert.match(disk, /components/);
});

test('session snapshots remain stable after project edits, replay and fork; explicit idle sync updates them', async t => {
  const f = await fixture(t), h = await managerFixture(t, f);
  await h.manager.save({ projectId: 'app', expectedRevision: 0, links: f.snapshot.links });
  const session = h.ctx.sessions.create(SessionId('test-session'), { meta: { cwd: f.main } });
  const agent = { session, status: 'idle' };
  const events = []; h.ctx.on('session/event', (_session, event) => events.push(event));
  const original = await h.manager.ensure(agent);
  assert.equal(original.links.length, 2);
  await h.manager.save({ projectId: 'app', expectedRevision: 1, links: [] });
  assert.equal((await h.manager.ensure(agent)).revision, 1);
  const restored = Session.create(session.id, JSON.parse(JSON.stringify(events)), session.header);
  assert.equal(h.manager.state(restored).links.length, 2);
  const forked = h.ctx.sessions.fork(session, undefined, SessionId('forked-session'));
  assert.equal(h.manager.state(forked).links.length, 2);
  assert.match(contextText(h.manager.state(restored)), /components/);
  agent.status = 'running';
  await assert.rejects(h.manager.sync(agent, 2, 'app'), { code: 'session-running' });
  agent.status = 'idle';
  await assert.rejects(h.manager.sync(agent, 2, 'other'), { code: 'wrong-project' });
  const updated = await h.manager.sync(agent, 2, 'app');
  assert.equal(updated.links.length, 0); assert.equal(updated.revision, 2);
  assert.equal(original.links.length, 2);
});
