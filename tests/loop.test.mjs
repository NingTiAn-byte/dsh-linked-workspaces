import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import AgentRegistry from '@deepseek-ai/dsh-agent';
import AgentLoop from '@deepseek-ai/dsh-agent-loop';
import LlmRuntime, { LlmAdapter, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import * as plugin from '../index.js';
import { PtcRuntime } from '@deepseek-ai/dsh-ptc-runtime';

function finished() { return [{ type: 'block-start', index: 0, blockType: 'text' }, { type: 'text-delta', index: 0, text: 'Read complete.' }, { type: 'block-end', index: 0, block: { type: 'text', text: 'Read complete.' } }, { type: 'finish', reason: { kind: 'stop' } }]; }
function tool(name, args) {
  const id = ToolCallId('linked-call-1'), raw = JSON.stringify(args);
  return [{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: raw }, { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: raw } }, { type: 'finish', reason: { kind: 'tool-calls' } }];
}
class Model extends LlmAdapter {
  requests = []; script = [];
  resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model }); }
  async *stream(request) {
    this.requests.push(request); const chunks = this.script.shift(); assert.ok(chunks, 'Unexpected model request');
    for (const chunk of chunks) yield chunk;
  }
}
class FixturePtc extends PtcRuntime {
  language = 'typescript'; isolation = 'test';
  resolve(request) { return { ...request, cwd: request.cwd ?? process.cwd(), timeoutMs: 1000 }; }
  async run(spec) {
    return { logs: [], value: await spec.bindings[0].functions.linked_workspace_read({ workspace: 'library', path: 'component.ts' }) };
  }
}

for (const mode of ['native', 'ptc']) test(`${process.env.DSH_TEST_HOST_VERSION ?? '0.2.1-rc.2'} ${mode} loop logs context and reader results, isolates sessions and removes tools on unload`, { timeout: 15000 }, async t => {
  const temp = await mkdtemp(join(tmpdir(), 'dsh-linked-loop-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const main = join(temp, 'app'), library = join(temp, 'library'), other = join(temp, 'other');
  await Promise.all([main, library, other].map(path => mkdir(path)));
  await writeFile(join(library, 'component.ts'), 'export const component = "reference-source";');
  const ctx = new Context(), model = new Model();
  t.after(() => ctx.fiber.dispose());
  await ctx.plugin(LlmRuntime); await ctx.plugin(SessionStore); await ctx.plugin(SessionProjectionRegistry);
  await ctx.plugin(SystemPrompt); await ctx.plugin(ToolRuntime, { mode });
  if (mode === 'ptc') { await ctx.plugin(FixturePtc); ctx.provide('workingDirectory', { async ensure() { return main; } }); }
  await ctx.plugin(AgentRegistry); await ctx.plugin(AgentLoop, { agents: [] });
  await ctx.plugin(Storage); await ctx.plugin(StorageJson, { root: join(temp, 'storage') }); await ctx.plugin(StorageDomain, { backend: 'json' });
  const workspace = { id: 'app', title: 'App', path: await realpath(main) };
  ctx.provide('workspaceRegistry', { list: () => [workspace], get: id => id === 'app' ? workspace : undefined });
  const routes = new Map();
  ctx.provide('connection', { fetch: { register(route) { routes.set(route.path, route); return async () => routes.delete(route.path); } } });
  ctx.provide('sessionController', { async resolveAgent(id) { return { agent: ctx.agents.get(id) }; } });
  ctx.llm.registerAdapter(['linked-test'], model);
  const fiber = ctx.plugin(plugin, {}); await fiber;
  const route = routes.get('/api/linked-workspaces');
  const saved = await route.fetch(new Request('http://localhost/api/linked-workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', projectId: 'app', expectedRevision: 0, links: [{ alias: 'library', path: library, purpose: 'Reusable components' }] }) }));
  assert.equal(saved.status, 200);
  const bad = await route.fetch(new Request('http://localhost/api/linked-workspaces', { method: 'POST', body: '{}' }));
  assert.equal(bad.status, 415);
  const invalid = await route.fetch(new Request('http://localhost/api/linked-workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }));
  assert.equal(invalid.status, 400);
  const events = []; ctx.on('session/event', (session, event) => events.push({ id: session.id, event }));
  const a = await ctx.agentLoop.create(SessionId('linked-loop-a'), { provider: 'linked-test', model: 'scripted' }, { cwd: main });
  model.script.push(mode === 'native' ? tool('linked_workspace_read', { workspace: 'library', path: 'component.ts' })
    : tool('run_code', { code: 'return await tools.linked_workspace_read({workspace:"library",path:"component.ts"});', description: 'Inspect the library component' }), finished());
  a.followup(createUserMessage({ content: [{ type: 'text', text: 'Inspect the reusable component.' }], source: { kind: 'user' } }));
  await a.whenIdle();
  assert.equal(model.requests.length, 2);
  const systemText = JSON.stringify(model.requests[0].messages);
  assert.match(systemText, /Reusable components/);
  const result = events.find(r => r.event.type === 'tool/result');
  assert.ok(result); assert.notEqual(result.event.data.message.isError, true);
  assert.match(JSON.stringify(result.event), /reference-source/);
  assert.ok(events.some(r => r.event.type === 'user/message' && r.event.data.source.kind === 'runtime-context' && JSON.stringify(r.event).includes('Reusable components')));
  const b = await ctx.agentLoop.create(SessionId('linked-loop-b'), { provider: 'linked-test', model: 'scripted' }, { cwd: other });
  model.script.push(finished());
  b.followup(createUserMessage({ content: [{ type: 'text', text: 'Answer directly.' }], source: { kind: 'user' } }));
  await b.whenIdle();
  assert.doesNotMatch(JSON.stringify(model.requests.at(-1).messages), /Reusable components/);
  await fiber.dispose();
  assert.equal(ctx.tools.schemas(a).some(tool => tool.name.startsWith('linked_workspace_')), false);
  assert.equal(routes.size, 0);
});
