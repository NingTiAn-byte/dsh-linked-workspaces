import { resolve } from 'node:path';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { RECORD, KEY, WorkspaceError, linkSchema, snapshotSchema, rootsOf } from './model.js';
import { directory, contains, availability } from './files.js';

const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

/** Owns project mutations and immutable per-session configuration snapshots. */
export class LinkedWorkspaces {
  constructor(ctx, table) { this.ctx = ctx; this.table = table; this.tail = Promise.resolve(); this.closed = false; }
  serialize(action) {
    const operation = this.tail.then(() => {
      if (this.closed) throw new WorkspaceError('unloaded', 'The plugin is unloading.', 503);
      return action();
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  async close() { this.closed = true; await this.tail; }
  project(id) {
    const workspace = this.ctx.workspaceRegistry.get(id);
    if (!workspace) throw new WorkspaceError('project-not-found', 'Select an existing DSH workspace.', 404);
    const saved = this.table.get(id);
    return { id, title: workspace.title, ...(saved ?? { version: 1, mainPath: workspace.path, revision: 0, links: [] }) };
  }
  async list() {
    return Promise.all(this.ctx.workspaceRegistry.list().map(async workspace => {
      const project = this.project(workspace.id);
      return { ...project, roots: await Promise.all(rootsOf(project).map(availability)) };
    }));
  }
  save(input) {
    return this.serialize(async () => {
      const before = this.project(input.projectId);
      if (!Number.isInteger(input.expectedRevision) || input.expectedRevision !== before.revision)
        throw new WorkspaceError('revision-conflict', 'Configuration changed in another window. Reload before saving.', 409);
      if (!Array.isArray(input.links) || input.links.length > 16) throw new WorkspaceError('invalid-links', 'Use at most 16 linked directories.');
      const mainPath = await directory(before.mainPath);
      const seenAliases = new Set(['main']), paths = [mainPath], links = [];
      for (const raw of input.links) {
        const parsed = linkSchema.safeParse(raw);
        if (!parsed.success) throw new WorkspaceError('invalid-link', 'Use a unique lowercase alias (1–32 letters, numbers, _ or -), an absolute path and a purpose up to 300 characters.');
        const link = parsed.data;
        if (seenAliases.has(link.alias)) throw new WorkspaceError('duplicate-alias', 'Each directory must have a unique alias.');
        const canonical = await directory(link.path);
        if (paths.some(path => contains(path, canonical) || contains(canonical, path)))
          throw new WorkspaceError('overlapping-root', 'Choose distinct directories without ancestor or descendant overlap.');
        paths.push(canonical); seenAliases.add(link.alias);
        links.push({ ...link, path: canonical });
      }
      const next = { version: 1, mainPath, revision: before.revision + 1, links };
      await this.table.put(input.projectId, next);
      return this.project(input.projectId);
    });
  }
  state(session) { return this.ctx.sessionProjections.stateOf(session, KEY); }
  ensure(agent) {
    return this.serialize(async () => {
      const old = this.state(agent.session);
      if (old) return old;
      const snapshot = await this.fromSession(agent.session);
      if (!snapshot) return null;
      appendPluginRecord(agent.session, RECORD, snapshot);
      return snapshot;
    });
  }
  async fromSession(session) {
    if (!session.header.cwd) return null;
    let mainPath = resolve(session.header.cwd);
    try { mainPath = await directory(mainPath); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const workspace = this.ctx.workspaceRegistry.list().find(w => samePath(w.path, mainPath));
    return snapshotSchema.parse(workspace
      ? { ...this.table.get(workspace.id) ?? { version: 1, mainPath, revision: 0, links: [] }, projectId: workspace.id }
      : { version: 1, mainPath, revision: 0, links: [], projectId: null });
  }
  sync(agent, expectedRevision, projectId) {
    return this.serialize(async () => {
      if (agent.status !== 'idle') throw new WorkspaceError('session-running', 'Wait until the session is idle before synchronizing.', 409);
      const next = await this.fromSession(agent.session);
      if (!next) throw new WorkspaceError('no-primary-directory', 'This session has no primary directory.');
      if (next.projectId !== projectId) throw new WorkspaceError('wrong-project', 'This session belongs to a different primary workspace.', 409);
      if (expectedRevision !== next.revision) throw new WorkspaceError('revision-conflict', 'Reload the project configuration before synchronizing.', 409);
      if (agent.status !== 'idle') throw new WorkspaceError('session-running', 'Wait until the session is idle before synchronizing.', 409);
      appendPluginRecord(agent.session, RECORD, next);
      await this.ctx.parallel('session/flush', agent.session);
      return next;
    });
  }
}
