import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const artifacts = resolve(process.env.DSH_TEST_ARTIFACT_DIR ?? 'artifacts');
const fixture = JSON.parse(await readFile(resolve(artifacts, 'fixture.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
const report = { checks: {}, pageErrors: [] };
page.on('pageerror', e => report.pageErrors.push(e.message));
const dialog = () => page.getByRole('dialog', { name: /^(添加关联工作区|Add linked workspace)$/ });
const row = () => page.locator(`[data-row-key=${JSON.stringify('workspace:' + fixture.projectId)}]`);
const readProject = () => page.evaluate(async id => (await (await fetch('/api/linked-workspaces')).json()).projects.find(p => p.id === id), fixture.projectId);
async function open() {
  await row().click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(添加关联工作区…|Add linked workspace…)$/ }).click();
  await dialog().getByRole('combobox').waitFor();
  await dialog().getByText('添加到：app', { exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[role=dialog] select')?.disabled === false);
}
try {
  await page.goto(process.env.DSH_TEST_URL);
  await row().waitFor({ timeout: 30000 });
  await row().click({ button: 'right' });
  await page.getByRole('menuitem', { name: /^(添加关联工作区…|Add linked workspace…)$/ }).waitFor();
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('menu').count(), 0);
  await row().dispatchEvent('keydown', { key: 'F10', shiftKey: true });
  await page.getByRole('menuitem', { name: /^(添加关联工作区…|Add linked workspace…)$/ }).waitFor();
  assert.equal(await page.locator(':focus').getAttribute('role'), 'menuitem');
  await page.keyboard.press('ArrowDown');
  assert.match(await page.locator(':focus').textContent(), /管理关联|Manage linked/);
  await page.keyboard.press('Escape'); report.checks.contextMenuAndKeyboard = true;
  const before = await readProject();
  await open();
  await dialog().getByRole('button', { name: /^(取消|Cancel)$/ }).click();
  assert.equal((await readProject()).revision, before.revision); report.checks.cancelDoesNotWrite = true;
  await open();
  const server = await page.evaluate(async path => (await (await fetch('/api/linked-workspaces')).json()).projects.find(p => p.mainPath === path), fixture.server);
  await dialog().getByRole('combobox').selectOption(server.id);
  await dialog().getByRole('button', { name: /^(添加此工作区|Add this workspace)$/ }).click();
  await dialog().waitFor({ state: 'detached' });
  const linked = await readProject();
  assert.ok(linked.links.some(link => link.alias === 'server' && link.path === fixture.server));
  assert.deepEqual(linked.links.find(link => link.alias === 'components'), before.links.find(link => link.alias === 'components'));
  report.checks.addExistingAndKeepPrevious = true;
  await open(); assert.equal(await dialog().locator(`option[value=${JSON.stringify(server.id)}]`).evaluate(option => option.disabled), true);
  await page.keyboard.press('Escape'); report.checks.duplicatesDisabled = true;
  await open(); await dialog().getByRole('button', { name: /^(选择本机目录…|Choose local directory…)$/ }).click();
  const path = dialog().getByLabel(/^(目录路径|Directory path)$/); await path.waitFor();
  await path.fill(fixture.root);
  await dialog().getByRole('button', { name: /^(前往|Go)$/ }).click();
  await dialog().getByRole('button', { name: '▸ assets', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[role=dialog] input')?.value.endsWith('assets'));
  let raced = false;
  await page.route('**/api/linked-workspaces', async route => {
    const request = route.request();
    if (request.method() === 'POST' && request.postDataJSON()?.action === 'save' && !raced) {
      raced = true;
      const project = await readProject();
      const links = project.links.map((link, i) => i ? link : { ...link, purpose: 'Concurrent edit retained' });
      const result = await page.request.post(request.url(), { data: { action: 'save', projectId: project.id, expectedRevision: project.revision, links } });
      assert.equal(result.status(), 200);
    }
    await route.continue();
  });
  await dialog().getByRole('button', { name: /^(选择此目录|Choose this directory)$/ }).click();
  await dialog().getByRole('alert').waitFor(); assert.equal(raced, true);
  assert.equal((await readProject()).links[0].purpose, 'Concurrent edit retained');
  await page.unroute('**/api/linked-workspaces');
  await dialog().getByRole('button', { name: /^(选择此目录|Choose this directory)$/ }).click();
  await dialog().waitFor({ state: 'detached' });
  assert.ok((await readProject()).links.some(link => link.alias === 'assets'));
  assert.equal((await readProject()).links[0].purpose, 'Concurrent edit retained');
  report.checks.browseLocalDirectory = true; report.checks.concurrentEditAndRetry = true;
  await page.evaluate(() => { window.__DSH_DIRECTORY_PICKER__ = { pick: () => new Promise(resolve => { window.finishDirectoryPick = resolve; }) }; });
  const revision = (await readProject()).revision;
  await open(); await dialog().getByRole('button', { name: /^(选择本机目录…|Choose local directory…)$/ }).click();
  await page.waitForFunction(() => typeof window.finishDirectoryPick === 'function');
  await page.keyboard.press('Escape');
  await page.evaluate(path => { window.finishDirectoryPick(path); delete window.__DSH_DIRECTORY_PICKER__; }, fixture.root);
  await page.waitForTimeout(100); assert.equal((await readProject()).revision, revision); report.checks.lateNativePickerDoesNotWrite = true;
  await row().click({ button: 'right' }); await page.getByRole('menuitem', { name: /^(管理关联工作区|Manage linked workspaces)$/ }).click();
  await page.getByLabel(/^(选择项目|Project)$/).waitFor();
  assert.equal(await page.getByLabel(/^(选择项目|Project)$/).inputValue(), fixture.projectId);
  report.checks.manageTargetsClickedProject = true;
  await page.reload(); assert.equal((await readProject()).links.length, 3); report.checks.durableReload = true;
  assert.deepEqual(report.pageErrors, []); report.ok = true;
  await row().click({ button: 'right' }); await page.screenshot({ path: resolve(artifacts, 'project-context-menu.png'), fullPage: true });
} catch (error) {
  report.failure = error.stack; report.body = (await page.locator('body').innerText()).slice(-10000);
  await page.screenshot({ path: resolve(artifacts, 'quick-failure.png'), fullPage: true }); process.exitCode = 1;
} finally {
  await writeFile(resolve(artifacts, 'quick-report.json'), JSON.stringify(report, null, 2)); await browser.close();
  console.log(JSON.stringify(report));
}
