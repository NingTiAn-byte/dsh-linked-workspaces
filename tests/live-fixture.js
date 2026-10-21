/** Test-only plugin loaded by an isolated profile, never shipped in the package. */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LlmAdapter, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';

export const name = 'linked-workspaces-test-fixture';
export const inject = ['workspaceRegistry', 'sessionController', 'agentLoop', 'llm', 'connection', 'tools'];
const root = resolve(process.env.DSH_TEST_FIXTURE_ROOT ?? fileURLToPath(new URL('../artifacts/example', import.meta.url)));
const text = value => [{ type: 'block-start', index: 0, blockType: 'text' }, { type: 'text-delta', index: 0, text: value }, { type: 'block-end', index: 0, block: { type: 'text', text: value } }, { type: 'finish', reason: { kind: 'stop' } }];
class FixtureModel extends LlmAdapter {
  requests = []; step = 0;
  resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model }); }
  async *stream(request) {
    this.requests.push(request);
    if (this.step++ === 0) {
      const id = ToolCallId('fixture-reader'), args = JSON.stringify({ workspace: 'components', path: 'src/Button.tsx' });
      yield* [{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'tool-call-delta', index: 0, id, name: 'linked_workspace_read', argumentsDelta: args }, { type: 'block-end', index: 0, block: { type: 'tool-call', id, name: 'linked_workspace_read', arguments: args } }, { type: 'finish', reason: { kind: 'tool-calls' } }];
    } else yield* text('Verified the shared Button component.');
  }
}
class UiModel extends LlmAdapter {
  step = 0;
  resolveModel(provider, model) { return Promise.resolve({ provider, id: model, name: model }); }
  async *stream() {
    const calls = [
      ['select_intelligent_ui_presentation', { presentation: 'ui', reason: 'The user requests an interactive counter and a chart.' }],
      ['render_intelligent_ui', { title: 'Compatibility counter', description: 'Scripted local compatibility check.', html: '<button id="increment">Add one</button><output id="count">0</output>', css: 'button{padding:12px}output{margin:16px}', javascript: 'let count=0;document.getElementById("increment").onclick=()=>document.getElementById("count").textContent=String(++count);', height: 250 }],
      ['render_intelligent_chart', { title: 'Compatibility chart', kind: 'bar', labels: ['A', 'B'], values: [2, 3], unit: 'items', source: 'Synthetic compatibility fixture' }],
    ];
    const call = calls[this.step++];
    if (!call) { yield* text('Compatibility widgets ready.'); return; }
    const [name, value] = call, id = ToolCallId('compat-ui-' + this.step), args = JSON.stringify(value);
    yield* [{ type: 'block-start', index: 0, blockType: 'tool-call' }, { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: args }, { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: args } }, { type: 'finish', reason: { kind: 'tool-calls' } }];
  }
}
export async function apply(ctx) {
  for (const dir of ['app', 'components/src', 'server', 'assets']) await mkdir(join(root, dir), { recursive: true });
  await writeFile(join(root, 'app', 'README.md'), '# Customer portal\nPrimary project.\n');
  await writeFile(join(root, 'components', 'AGENTS.md'), 'Use accessible controls. These rules apply only to the components directory.\n');
  await writeFile(join(root, 'components', 'src', 'Button.tsx'), 'export function Button() {\n  return <button>Shared component</button>;\n}\n');
  await writeFile(join(root, 'server', 'routes.ts'), 'export const customerRoute = "/api/customers";\n');
  const projects = [];
  for (const dir of ['app', 'components', 'server']) projects.push(await ctx.workspaceRegistry.create(join(root, dir)));
  const session = await ctx.sessionController.create({ workspaceId: projects[0].id, sessionId: 'linked-example-app-' + Date.now() }, new AbortController().signal);
  await writeFile(resolve(root, '..', 'fixture.json'), JSON.stringify({ root, projectId: projects[0].id, sessionId: session.sessionId, components: projects[1].path, server: projects[2].path }));
  const model = new FixtureModel();
  ctx.llm.registerAdapter(['linked-live-fixture'], model);
  if (ctx.tools.schemas().some(tool => tool.name === 'render_intelligent_ui')) {
    const uiModel = new UiModel();
    ctx.llm.registerAdapter(['ui-live-fixture'], uiModel);
    ctx.effect(() => ctx.connection.fetch.register({ path: '/api/linked-workspaces-ui-fixture', methods: ['POST'], requestBody: 'buffered', async fetch() {
      uiModel.step = 0;
      const id = SessionId('ui-live-' + Date.now());
      const agent = await ctx.agentLoop.create(id, { provider: 'ui-live-fixture', model: 'scripted' }, { cwd: projects[0].path });
      await projects[0].attachSession(id);
      agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Create an interactive counter and a chart.' }], source: { kind: 'user' } }));
      await agent.whenIdle();
      return Response.json({ sessionId: id });
    } }));
  }
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/linked-workspaces-fixture', methods: ['POST'], requestBody: 'buffered', async fetch() {
    model.requests = []; model.step = 0;
    const events = [];
    const id = SessionId('linked-live-' + Date.now());
    const off = ctx.on('session/event', (session, event) => { if (session.id === id) events.push(event); });
    try {
      const agent = await ctx.agentLoop.create(id, { provider: 'linked-live-fixture', model: 'scripted' }, { cwd: projects[0].path });
      await projects[0].attachSession(id);
      agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Read the shared Button component.' }], source: { kind: 'user' } }));
      await agent.whenIdle();
      const report = { sessionId: id, requests: model.requests.length, hasContext: JSON.stringify(model.requests).includes('Shared UI components'),
        readSucceeded: events.some(e => e.type === 'tool/result' && !e.data.message.isError && JSON.stringify(e).includes('Shared component')),
        snapshotLogged: events.some(e => e.type === 'plugin:linked-workspaces/snapshot'),
        contextLogged: events.some(e => e.type === 'user/message' && e.data.source.kind === 'runtime-context' && JSON.stringify(e).includes('Shared UI components')) };
      return Response.json(report);
    } finally { off(); }
  } }));
}
