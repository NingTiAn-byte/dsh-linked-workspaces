import { z } from 'zod';
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain';

export const RECORD = 'plugin:linked-workspaces/snapshot';
export const KEY = 'linkedWorkspaces';
export const linkSchema = z.object({
  alias: z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/).refine(v => v !== 'main'),
  path: z.string().min(1).max(4096),
  purpose: z.string().max(300),
}).strict();
export const projectSchema = z.object({
  version: z.literal(1), mainPath: z.string().min(1).max(4096), revision: z.number().int().nonnegative(),
  links: z.array(linkSchema).max(16),
}).strict();
export const snapshotSchema = projectSchema.extend({ projectId: z.string().nullable() }).strict();
export const domainSpec = defineDomain({ name: 'local_linked_workspaces', version: 1,
  tables: { projects: domainTable(projectSchema) } });
export const projection = {
  key: KEY, stateVersion: 1, stateSchema: snapshotSchema.nullable(), init: () => null,
  apply(state, event) {
    if (event.type !== RECORD || event.ignorable !== true) return state;
    return snapshotSchema.parse(event.data);
  },
  wire: { viewSchema: snapshotSchema.nullable(), view: state => state },
};

export class WorkspaceError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
export function rootsOf(snapshot) {
  return [{ alias: 'main', path: snapshot.mainPath, purpose: 'Primary project' }, ...snapshot.links];
}
export function contextText(snapshot) {
  if (!snapshot) return '';
  return 'Project directories (session configuration revision ' + snapshot.revision + '):\n'
    + rootsOf(snapshot).map(r => JSON.stringify(r)).join('\n')
    + '\nThe session belongs to main. Linked directories are reference sources. Use linked_workspace_search and linked_workspace_read to inspect them; cite alias/relative/path. '
    + 'These tools only read. Linking a directory grants no additional write or execution permission. Follow the host sandbox policy for every other tool. '
    + 'Read returns directory-scoped AGENTS.md instructions; apply each only to its stated directory. Reusing source does not install dependencies or create runtime imports.';
}
