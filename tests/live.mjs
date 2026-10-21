import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.argv[2] ?? process.env.DSH_TEST_URL;
if (!url) throw new Error('Pass the authenticated URL of the isolated DSH test profile. See README.md.');
const artifactDir = resolve(process.env.DSH_TEST_ARTIFACT_DIR ?? 'artifacts');
const fixture = JSON.parse(await readFile(resolve(artifactDir, 'fixture.json'), 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.DSH_TEST_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const report = { checks: {}, pageErrors: [], consoleErrors: [], failedResponses: [] };
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', error => report.pageErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) report.failedResponses.push({ status: response.status(), path: new URL(response.url()).pathname }); });
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /^(关联工作区|Linked workspaces)$/ }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /^(继续|Continue)$/ }).waitFor({ timeout: 5000 }).catch(() => {});
  for (let i = 0; i < 8; i++) {
    const buttons = page.getByRole('button', { name: /^(继续|关闭|稍后|跳过|知道了|Continue|Close|Later|Skip)$/ }).and(page.locator('button:enabled'));
    if (!await buttons.count()) break;
    await buttons.last().click();
    await page.waitForTimeout(200);
  }
  await page.getByRole('button', { name: /^(关联工作区|Linked workspaces)$/ }).click();
  await page.locator('.dsh-lw h1').waitFor();
  await page.getByLabel(/^(选择项目|Project)$/).selectOption(fixture.projectId);
  if (process.argv.includes('--verify-restored')) {
    const previous = JSON.parse(await readFile(resolve(artifactDir, 'live-report.json'), 'utf8'));
    const stored = await page.evaluate(async id => (await (await fetch('/api/linked-workspaces')).json()).projects.find(p => p.id === id), fixture.projectId);
    assert.equal(stored.links[0].alias, 'components');
    await page.getByRole('combobox', { name: /^(会话配置|Session configuration)$/ }).selectOption(previous.checks.model.sessionId);
    await page.getByRole('button', { name: /^(打开会话|Open session)$/ }).click();
    await page.getByRole('button', { name: /主工作区 \+ 1 个关联目录|Primary \+ 1 linked directories/ }).waitFor();
    await page.getByRole('button', { name: /主工作区 \+ 1 个关联目录|Primary \+ 1 linked directories/ }).click();
    await page.getByLabel(/^(选择项目|Project)$/).selectOption(fixture.projectId);
    report.checks.restoredConfigurationAndSession = true;
  }
  const reset = await page.evaluate(async projectId => {
    const state = await (await fetch('/api/linked-workspaces')).json();
    const project = state.projects.find(p => p.id === projectId);
    if (project.links.length) return (await fetch('/api/linked-workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', projectId, expectedRevision: project.revision, links: [] }) })).ok;
    return true;
  }, fixture.projectId);
  assert.equal(reset, true);
  await page.getByRole('button', { name: /^(刷新|Refresh)$/ }).click();
  await page.getByLabel(/^(从已有工作区添加…|Add an existing workspace…)$/).selectOption(fixture.components);
  await page.getByLabel(/^(别名|Alias)$/).fill('components');
  await page.getByLabel(/^(用途说明|Purpose)$/).fill('Shared UI components');
  await page.getByRole('button', { name: /^(保存配置|Save configuration)$/ }).click();
  await page.getByRole('status').filter({ hasText: /配置已保存|Saved/ }).waitFor();
  report.checks.manageDirectories = true;

  await page.getByLabel(/^(输入文件名或文本|File name or literal text)$/).fill('Button');
  await page.getByRole('button', { name: /^(搜索|Search)$/ }).click();
  await page.locator('.dsh-lw-result').filter({ hasText: 'components/src/Button.tsx' }).click();
  await page.locator('.dsh-lw pre').filter({ hasText: 'Shared component' }).waitFor();
  await page.getByText(/^(适用的目录规则|Applicable directory instructions)$/).click();
  await page.locator('.dsh-lw pre').filter({ hasText: 'Use accessible controls' }).waitFor();
  report.checks.searchAndScopedRead = true;

  const model = await page.evaluate(async () => (await fetch('/api/linked-workspaces-fixture', { method: 'POST' })).json());
  report.checks.model = model;
  assert.equal(model.requests, 2); assert.equal(model.hasContext, true); assert.equal(model.readSucceeded, true);
  assert.equal(model.snapshotLogged, true); assert.equal(model.contextLogged, true);

  await page.getByRole('combobox', { name: /^(会话配置|Session configuration)$/ }).selectOption(fixture.sessionId);
  await page.getByRole('button', { name: /^(同步到所选会话|Synchronize session)$/ }).click();
  await page.getByRole('status').filter({ hasText: /会话已同步|Session synchronized/ }).waitFor();
  report.checks.explicitSessionSync = true;
  await page.locator('.dsh-lw').evaluate(node => { node.scrollTop = 0; });
  await page.screenshot({ path: resolve(artifactDir, 'linked-workspaces-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 430, height: 932 });
  report.checks.narrowDimensions = await page.locator('.dsh-lw').evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth, overflow: [...node.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > node.getBoundingClientRect().right + 1).map(child => ({ tag: child.tagName, class: child.className, width: child.getBoundingClientRect().width })).slice(0, 12) }));
  assert.equal(await page.locator('.dsh-lw').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
  await page.screenshot({ path: resolve(artifactDir, 'linked-workspaces-mobile.png'), fullPage: true });
  report.checks.narrowLayout = true;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('combobox', { name: /^(会话配置|Session configuration)$/ }).selectOption(model.sessionId);
  await page.getByRole('button', { name: /^(打开会话|Open session)$/ }).click();
  await page.locator('.dsh-lw').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /主工作区 \+ 1 个关联目录|Primary \+ 1 linked directories/ }).waitFor();
  report.checks.conversationBadge = true;
  await page.getByRole('button', { name: /主工作区 \+ 1 个关联目录|Primary \+ 1 linked directories/ }).click();
  await page.locator('.dsh-lw h1').waitFor();
  report.checks.navigation = true;
  assert.deepEqual(report.pageErrors, []);
} catch (error) {
  report.failure = error.stack;
  report.body = (await page.locator('body').innerText()).slice(-10000);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: resolve(artifactDir, 'live-failure.png'), fullPage: true });
  process.exitCode = 1;
} finally {
  await writeFile(resolve(resolve(artifactDir, 'live-report.json')), JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
