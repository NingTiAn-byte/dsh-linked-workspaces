import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { domainSpec, projection, contextText, rootsOf, WorkspaceError } from './src/model.js';
import { availability, readSource, searchSources } from './src/files.js';
import { LinkedWorkspaces } from './src/manager.js';

export const name = 'linked-workspaces';
export const inject = ['tools', 'systemPrompt', 'sessionProjections', 'storageDomain', 'workspaceRegistry', 'connection', 'sessionController'];
export const Config = z.object({
  readMaxBytes: z.number().min(1024).max(262144).default(65536),
  instructionMaxBytes: z.number().min(1024).max(65536).default(16384),
  searchFileMaxBytes: z.number().min(1024).max(262144).default(65536),
  searchMaxResults: z.number().min(1).max(100).default(40),
  searchMaxEntries: z.number().min(100).max(100000).default(10000),
  searchMaxWarnings: z.number().min(1).max(100).default(30),
  searchTimeoutMs: z.number().min(100).max(30000).default(5000),
  previewChars: z.number().min(80).max(1000).default(240),
});

/** Mount durable project state, scoped model context, reader tools and owner-only UI API. */
export async function apply(ctx, config) {
  for (const [key, value] of Object.entries(config)) if (!Number.isInteger(value)) throw new Error(`${key} must be an integer`);
  const domain = await ctx.storageDomain.open(domainSpec);
  const manager = new LinkedWorkspaces(ctx, domain.table('projects'));
  const lifetime = new AbortController();
  ctx.effect(() => async () => { lifetime.abort(); await manager.close(); await domain.close(); });
  ctx.sessionProjections.register(projection);
  ctx.on('agent/pre-step', async ({ agent }, next) => { await manager.ensure(agent); return next(); });
  ctx.systemPrompt.context({ name: 'linked-workspaces:directories', order: 4200, required: true, interpolate: false,
    text: context => context.agent ? contextText(manager.state(context.agent.session)) : '' });

  async function snapshot(exec) {
    exec.signal.throwIfAborted();
    if (!exec.agent) throw new WorkspaceError('session-required', 'Use these tools inside a project session.');
    const state = await manager.ensure(exec.agent);
    if (!state) throw new WorkspaceError('no-primary-directory', 'Start a session in a DSH workspace first.');
    return state;
  }
  const output = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] };
  const register = (name, description, parameters, execute) => ctx.tools.register(defineTool({
    name, description, parameters, output, isConcurrencySafe: () => true,
    async execute(args, exec) {
      const signal = AbortSignal.any([exec.signal, lifetime.signal]);
      const state = await snapshot(exec); signal.throwIfAborted();
      return JSON.stringify(await execute(state, args, signal));
    },
  }));
  register('linked_workspace_list', 'List the primary and linked local project directories in this session snapshot. Linking grants no extra write or execution permission.', {},
    async state => ({ revision: state.revision, projectId: state.projectId, roots: await Promise.all(rootsOf(state).map(availability)) }));
  register('linked_workspace_search', 'Search local project directories by literal case-insensitive file path or text. Returns source aliases and line numbers. Hidden/private files and generated directories are excluded; truncation and failures are explicit. Search results do not load file instructions; read a file before using its implementation.', {
    query: { type: 'string', required: true, description: 'Literal query, 1–200 characters.' },
    mode: { type: 'string', enum: ['files', 'text'], required: true, description: 'files: relative file names; text: file contents.' },
    workspace: { type: 'string', description: 'Directory alias, including main. Omit to search all configured roots.' },
  }, (state, args, signal) => searchSources(state, args, config, signal));
  register('linked_workspace_read', 'Read a text file from a selected directory with bounded line output and applicable AGENTS.md instructions, each scoped to its directory. Use this to inspect and reuse source; no files are written.', {
    workspace: { type: 'string', required: true, description: 'Directory alias from linked_workspace_list.' },
    path: { type: 'string', required: true, description: 'Forward-slash relative path within the selected directory. No traversal or private files.' },
    startLine: { type: 'integer', description: 'First line, starting at 1. Default 1.' },
    lines: { type: 'integer', description: '1–300 lines. Default 160. Files are read only up to the configured byte limit.' },
  }, (state, args, signal) => readSource(state, args, config, signal));

  const respond = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/linked-workspaces', methods: ['GET', 'POST'], requestBody: 'buffered',
    async fetch(request) {
      try {
        if (request.method === 'GET') return respond(200, { projects: await manager.list() });
        if (!request.headers.get('content-type')?.startsWith('application/json'))
          return respond(415, { code: 'json-required' });
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 100000) return respond(413, { code: 'request-too-large' });
        let body;
        try { body = JSON.parse(raw); } catch { return respond(400, { code: 'invalid-json' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return respond(400, { code: 'invalid-request' });
        if (body.action === 'save') return respond(200, { project: await manager.save(body) });
        if (body.action === 'sync') {
          if (typeof body.sessionId !== 'string' || body.sessionId.length > 200) return respond(400, { code: 'invalid-session' });
          const resolved = await ctx.sessionController.resolveAgent(body.sessionId);
          if (resolved.error) return respond(409, { code: resolved.error.code });
          return respond(200, { snapshot: await manager.sync(resolved.agent, body.expectedRevision, body.projectId) });
        }
        if (body.action === 'search' || body.action === 'read') {
          const project = manager.project(body.projectId);
          if (project.revision !== body.expectedRevision) throw new WorkspaceError('revision-conflict', 'Reload before searching.', 409);
          const result = body.action === 'search'
            ? await searchSources(project, body, config, AbortSignal.any([request.signal, lifetime.signal]))
            : await readSource(project, body, config, AbortSignal.any([request.signal, lifetime.signal]));
          return respond(200, { result });
        }
        return respond(400, { code: 'unknown-action' });
      } catch (error) {
        const status = error instanceof WorkspaceError ? error.status : ['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code) ? 400 : 500;
        if (status === 500) ctx.logger.warn('linked-workspaces request failed: %o', error);
        return respond(status, { code: status === 500 ? 'operation-failed' : error.code });
      }
    },
  }));
}
