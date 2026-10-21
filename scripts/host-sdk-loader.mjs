// Test-only SDK redirection: use a real source checkout without modifying its links.
import { registerHooks } from 'node:module'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.env.DSH_TEST_HOST_SOURCE) throw new Error('Set DSH_TEST_HOST_SOURCE to the host source checkout')
const root = resolve(process.env.DSH_TEST_HOST_SOURCE)
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
if (!['0.2.1-alpha.4', '0.2.1-rc.2'].includes(version)) throw new Error(`Unsupported test host: ${version}`)
const packages = new Map()
for (const group of ['vendor', 'packages']) {
  function scan(dir, depth) {
    const manifest = join(dir, 'package.json')
    if (existsSync(manifest)) {
      const data = JSON.parse(readFileSync(manifest, 'utf8'))
      if (data.name?.startsWith('@deepseek-ai/')) packages.set(data.name, { dir, data })
    }
    if (depth) for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules','src','lib','tests'].includes(entry.name)) scan(join(dir, entry.name), depth - 1)
    }
  }
  scan(join(root, group), group === 'packages' ? 2 : 1)
}
const aliases = version === '0.2.1-alpha.4' ? { '@deepseek-ai/dsh-api-session-controller': '@deepseek-ai/dsh-session-controller' } : {}
registerHooks({ resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@deepseek-ai/')) return nextResolve(specifier, context)
  const name = specifier.split('/').slice(0, 2).join('/')
  const pkg = packages.get(aliases[name] ?? name)
  if (!pkg) throw new Error(`Host ${version} does not provide ${name}`)
  const sub = specifier.length === name.length ? '.' : '.' + specifier.slice(name.length)
  let target = pkg.data.exports?.[sub]
  if (!target && sub === '.') target = pkg.data.main
  if (typeof target === 'object') target = target.default ?? target.import
  if (typeof target !== 'string') return nextResolve(specifier, { ...context, parentURL: pathToFileURL(join(pkg.dir, 'package.json')).href })
  return { url: pathToFileURL(join(pkg.dir, target)).href, shortCircuit: true }
} })
process.env.DSH_TEST_HOST_VERSION = version
