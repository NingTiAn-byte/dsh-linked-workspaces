import { open, readdir, realpath, stat, lstat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, join, dirname, sep } from 'node:path';
import { WorkspaceError, rootsOf } from './model.js';

const ignoredDirectories = new Set(['.git', '.hg', '.svn', 'node_modules', 'dist', 'build', 'coverage', '__pycache__', '.next', 'vendor']);
const privateFile = name => /^\.env(?:\.|$)/i.test(name) || /^(?:id_rsa|id_ed25519|credentials)(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name);
const slash = path => path.split(sep).join('/');
export function contains(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep));
}
/** Resolve real directory identities, including Windows junction aliases. */
export async function directory(path) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new WorkspaceError('absolute-path-required', 'Choose an absolute local directory.');
  const canonical = await realpath(path);
  if (!(await stat(canonical)).isDirectory()) throw new WorkspaceError('not-directory', 'The selected path is not a directory.');
  return canonical;
}
export async function availability(root) {
  try {
    const actual = await directory(root.path);
    return { ...root, status: actual === root.path ? 'available' : 'changed' };
  } catch (error) {
    if (error.code === 'ENOENT') return { ...root, status: 'missing' };
    if (error.code === 'EACCES' || error.code === 'EPERM') return { ...root, status: 'denied' };
    return { ...root, status: 'unavailable' };
  }
}
async function checkedRoot(root) {
  const actual = await directory(root.path);
  if (actual !== root.path) throw new WorkspaceError('root-changed', 'The directory target changed. Remove and re-add its link.');
  return actual;
}
/** Read a bounded, ordinary file; canonical checks precede and follow opening it. */
async function readFile(root, path, maxBytes, signal) {
  signal?.throwIfAborted();
  const actual = await realpath(path);
  if (!contains(root, actual)) throw new WorkspaceError('outside-root', 'The file resolves outside its selected directory.');
  if (!(await lstat(path)).isFile()) throw new WorkspaceError('regular-file-required', 'Only ordinary files can be read.');
  const handle = await open(path, 'r');
  try {
    const info = await handle.stat();
    const now = await stat(actual);
    if (!info.isFile() || info.dev !== now.dev || info.ino !== now.ino || await realpath(path) !== actual)
      throw new WorkspaceError('file-changed', 'The file changed during opening. Retry.');
    const buffer = Buffer.alloc(Math.min(info.size, maxBytes) + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    signal?.throwIfAborted();
    const bytes = buffer.subarray(0, Math.min(bytesRead, maxBytes));
    if (bytes.includes(0)) throw new WorkspaceError('binary-file', 'Binary files are not supported.');
    return { text: bytes.toString('utf8'), truncated: bytesRead > maxBytes || info.size > maxBytes };
  } finally { await handle.close(); }
}
async function instructions(root, file, config, signal) {
  const results = [];
  let current = root, remaining = config.instructionMaxBytes;
  const parts = relative(root, dirname(file)).split(sep).filter(Boolean);
  for (const part of ['', ...parts]) {
    if (part) current = join(current, part);
    try {
      const result = await readFile(root, join(current, 'AGENTS.md'), remaining, signal);
      results.push({ scope: current, file: join(current, 'AGENTS.md'), ...result });
      remaining -= Buffer.byteLength(result.text);
      if (remaining <= 0) break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return results;
}
export async function readSource(snapshot, input, config, signal) {
  const root = rootsOf(snapshot).find(r => r.alias === input.workspace);
  if (!root) throw new WorkspaceError('unknown-workspace', 'Select a directory alias from linked_workspace_list.');
  await checkedRoot(root);
  if (!input.path || isAbsolute(input.path) || input.path.includes('\\') || input.path.includes(':'))
    throw new WorkspaceError('relative-path-required', 'Use a forward-slash relative file path.');
  const parts = input.path.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || (p.startsWith('.') && p !== '.github') || privateFile(p)))
    throw new WorkspaceError('excluded-path', 'This path is excluded from reference reading.');
  const file = resolve(root.path, ...parts);
  const data = await readFile(root.path, file, config.readMaxBytes, signal);
  const lines = data.text.split(/\r?\n/);
  const start = input.startLine ?? 1, limit = input.lines ?? 160;
  if (!Number.isInteger(start) || start < 1 || !Number.isInteger(limit) || limit < 1 || limit > 300)
    throw new WorkspaceError('invalid-range', 'startLine must be positive; lines must be 1–300.');
  const selected = lines.slice(start - 1, start - 1 + limit);
  return { workspace: root.alias, file: root.alias + '/' + slash(relative(root.path, file)), absolutePath: file,
    startLine: start, content: selected.map((text, i) => `${start + i}: ${text}`).join('\n'),
    truncated: data.truncated || start - 1 + selected.length < lines.length,
    instructions: await instructions(root.path, file, config, signal) };
}
/** Bounded literal search; never follows symbolic links or junctions. */
export async function searchSources(snapshot, input, config, signal) {
  if (typeof input.query !== 'string' || !input.query.trim() || input.query.length > 200)
    throw new WorkspaceError('invalid-query', 'Enter 1–200 characters. Search is literal.');
  if (!['files', 'text'].includes(input.mode)) throw new WorkspaceError('invalid-mode', 'Use files or text.');
  const roots = rootsOf(snapshot).filter(r => !input.workspace || r.alias === input.workspace);
  if (!roots.length) throw new WorkspaceError('unknown-workspace', 'Select a known directory alias.');
  const result = { matches: [], warnings: [], warningCount: 0, truncated: false, scannedEntries: 0, scannedFiles: 0 };
  const warn = warning => { result.warningCount++; if (result.warnings.length < config.searchMaxWarnings) result.warnings.push(warning); };
  const needle = input.query.toLocaleLowerCase();
  const deadline = Date.now() + config.searchTimeoutMs;
  const full = () => result.matches.length >= config.searchMaxResults || result.scannedEntries >= config.searchMaxEntries || Date.now() >= deadline;
  for (const root of roots) {
    signal?.throwIfAborted();
    if (full()) { result.truncated = true; break; }
    try { await checkedRoot(root); }
    catch (error) { warn({ workspace: root.alias, code: error.code ?? 'unavailable' }); continue; }
    const queue = [root.path];
    while (queue.length && !full()) {
      signal?.throwIfAborted();
      const dir = queue.shift();
      let entries;
      try {
        if (await realpath(dir) !== dir) throw new WorkspaceError('directory-changed', 'The directory target changed.');
        entries = await readdir(dir, { withFileTypes: true });
      }
      catch (error) { warn({ workspace: root.alias, path: slash(relative(root.path, dir)), code: error.code ?? 'read-failed' }); continue; }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        if (full()) { result.truncated = true; break; }
        result.scannedEntries++;
        if ((entry.name.startsWith('.') && entry.name !== '.github') || privateFile(entry.name)) continue;
        const file = join(dir, entry.name), path = slash(relative(root.path, file));
        if (entry.isDirectory()) { if (!ignoredDirectories.has(entry.name)) queue.push(file); continue; }
        if (!entry.isFile()) continue;
        if (input.mode === 'files') {
          if (path.toLocaleLowerCase().includes(needle)) result.matches.push({ workspace: root.alias, path, file: root.alias + '/' + path });
          continue;
        }
        result.scannedFiles++;
        try {
          const data = await readFile(root.path, file, config.searchFileMaxBytes, signal);
          if (data.truncated) warn({ workspace: root.alias, path, code: 'file-truncated' });
          for (const [index, text] of data.text.split(/\r?\n/).entries()) {
            if (text.toLocaleLowerCase().includes(needle)) result.matches.push({ workspace: root.alias, path, file: root.alias + '/' + path, line: index + 1, preview: text.slice(0, config.previewChars) });
            if (full()) { result.truncated = true; break; }
          }
        } catch (error) {
          signal?.throwIfAborted();
          if (error.code !== 'binary-file') warn({ workspace: root.alias, path, code: error.code ?? 'read-failed' });
        }
      }
    }
    if (queue.length || full()) result.truncated = true;
  }
  return result;
}
