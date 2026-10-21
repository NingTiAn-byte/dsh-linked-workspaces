/** Browser entry: uses the host's React, slots, locale and session services. */
window.__ModuleLoader__.load({
  id: '@local/dsh-linked-workspaces',
  factory(require) {
    const React = require('react'), h = React.createElement;
    const NS = 'local.linked-workspaces', PANEL = 'linked-workspaces';
    let panelProjectId = '';
    const zh = {
      title: '关联工作区', subtitle: '以一个主工作区组织项目，跨目录查找和复用代码。',
      primary: '主工作区', project: '选择项目', refresh: '刷新', empty: '先在 DSH 中添加一个工作区，再回来配置关联目录。',
      links: '关联目录', linksHint: '为组件库、接口或资源目录起一个稳定别名。', add: '添加目录', existing: '从已有工作区添加…',
      alias: '别名', path: '本机绝对路径', purpose: '用途说明', remove: '移除关联', save: '保存配置', saving: '处理中…', cancel: '撤销修改',
      policy: '关联工具仅提供读取和搜索。其他工具仍遵循 DSH 的权限设置；关联目录不会获得额外写入权限。',
      available: '可访问', missing: '目录不存在', denied: '无法访问', changed: '目录目标已变化', unavailable: '目录不可用', pending: '保存时检查',
      revision: '配置版本 {revision}', saved: '配置已保存。已有会话保留原配置，可在下面同步。', loading: '正在读取配置…',
      session: '会话配置', sessionHint: '新会话首次使用时继承项目配置。已有会话同步后，从下一次请求开始采用新配置。',
      chooseSession: '选择主工作区下的会话…', sync: '同步到所选会话', synced: '会话已同步。', open: '打开会话', noSessions: '此项目还没有会话。',
      search: '跨目录搜索', query: '输入文件名或文本', scope: '搜索范围', all: '全部目录', files: '文件路径', text: '文件内容', mode: '搜索方式',
      run: '搜索', searchHint: '搜索已保存配置。隐藏文件、密钥文件和常见生成目录会被排除。', none: '没有匹配结果。',
      incomplete: '搜索达到数量、大小或时间限制，结果可能不完整。', warnings: '{count} 项目录或文件提示', preview: '文件预览', close: '关闭预览',
      source: '来源', content: '内容', instructions: '适用的目录规则', readMore: '预览受文件大小和行数限制。',
      error: '操作失败，请重试。',
      'error.revision-conflict': '配置已被其他窗口修改。撤销本地修改并刷新后重试。',
      'error.duplicate-alias': '别名重复，请为每个目录使用不同别名。',
      'error.overlapping-root': '目录重复或存在父子关系，请选择独立目录。',
      'error.invalid-link': '别名须以小写字母开头，仅含小写字母、数字、_ 或 -，最多 32 字符；用途最多 300 字符。',
      'error.ENOENT': '目录或文件不存在，请检查路径。', 'error.ENOTDIR': '所选路径不是目录。',
      'error.EACCES': '系统拒绝访问该目录或文件。', 'error.EPERM': '系统拒绝访问该目录或文件。',
      'error.absolute-path-required': '请输入本机绝对目录路径。', 'error.session-running': '会话正在运行，请等它空闲后同步。',
      'error.wrong-project': '该会话不属于当前主工作区。', 'error.excluded-path': '此路径属于排除项，无法通过关联工具读取。',
      'error.root-changed': '目录目标已变化，请移除后重新关联。', 'error.binary-file': '暂不支持预览二进制文件。',
      'error.invalid-query': '请输入 1–200 个字符。', 'error.not-directory': '请选择目录。',
      badge: '主工作区 + {count} 个关联目录', badgeEmpty: '配置关联工作区', dirty: '有未保存的修改', enterProject: '在此主工作区开始会话',
      snapshot: '会话快照版本 {revision}', firstUse: '尚未创建会话快照', noLinks: '还没有关联目录。添加组件库或参考项目即可开始。',
    };
    const en = {
      title: 'Linked workspaces', subtitle: 'One primary project, with code and resources from multiple directories.',
      primary: 'Primary workspace', project: 'Project', refresh: 'Refresh', empty: 'Add a workspace in DSH first, then configure its linked directories here.',
      links: 'Linked directories', linksHint: 'Give component libraries, APIs and resources stable aliases.', add: 'Add directory', existing: 'Add an existing workspace…',
      alias: 'Alias', path: 'Absolute local path', purpose: 'Purpose', remove: 'Remove link', save: 'Save configuration', saving: 'Working…', cancel: 'Discard changes',
      policy: 'Linked tools only read and search. Other tools follow DSH permissions; linking grants no additional write permission.',
      available: 'Available', missing: 'Missing', denied: 'Access denied', changed: 'Target changed', unavailable: 'Unavailable', pending: 'Checked on save',
      revision: 'Revision {revision}', saved: 'Saved. Existing sessions keep their snapshots; synchronize them below when ready.', loading: 'Loading configuration…',
      session: 'Session configuration', sessionHint: 'New sessions inherit configuration on first use. Synchronizing an existing idle session takes effect on its next request.',
      chooseSession: 'Choose a session in this primary workspace…', sync: 'Synchronize session', synced: 'Session synchronized.', open: 'Open session', noSessions: 'This project has no sessions yet.',
      search: 'Search directories', query: 'File name or literal text', scope: 'Search scope', all: 'All directories', files: 'File paths', text: 'File contents', mode: 'Search mode',
      run: 'Search', searchHint: 'Search saved configuration. Hidden/private files and common generated directories are excluded.', none: 'No matches.',
      incomplete: 'Search reached a size, count or time limit. Results may be incomplete.', warnings: '{count} directory or file notices', preview: 'File preview', close: 'Close preview',
      source: 'Source', content: 'Content', instructions: 'Applicable directory instructions', readMore: 'Preview is bounded by file size and line count.',
      error: 'Operation failed. Please retry.',
      'error.revision-conflict': 'Another window changed this configuration. Discard local changes and refresh.',
      'error.duplicate-alias': 'Each directory needs a unique alias.', 'error.overlapping-root': 'Choose distinct directories without ancestor or descendant overlap.',
      'error.invalid-link': 'Aliases start with a lowercase letter and contain at most 32 lowercase letters, digits, _ or -. Purpose is limited to 300 characters.',
      'error.ENOENT': 'Directory or file not found.', 'error.ENOTDIR': 'The selected path is not a directory.',
      'error.EACCES': 'The system denied access.', 'error.EPERM': 'The system denied access.',
      'error.absolute-path-required': 'Enter an absolute local directory.', 'error.session-running': 'Wait until this session is idle before synchronizing.',
      'error.wrong-project': 'This session belongs to another primary workspace.', 'error.excluded-path': 'This path is excluded from reference reading.',
      'error.root-changed': 'The directory target changed. Remove and re-add its link.', 'error.binary-file': 'Binary preview is not supported.',
      'error.invalid-query': 'Enter 1–200 characters.', 'error.not-directory': 'Choose a directory.',
      badge: 'Primary + {count} linked directories', badgeEmpty: 'Configure linked workspaces', dirty: 'Unsaved changes', enterProject: 'Start a session in this workspace',
      snapshot: 'Session snapshot revision {revision}', firstUse: 'No session snapshot yet', noLinks: 'No linked directories yet. Add a component library or reference project.',
    };
    Object.assign(zh, { quickCancel: '取消', quickAdd: '添加关联工作区…', quickManage: '管理关联工作区', quickTitle: '添加关联工作区', quickFor: '添加到：{name}', quickExisting: '选择已有工作区', quickBrowse: '选择本机目录…', quickConfirm: '添加此工作区', quickChoose: '选择此目录', quickUp: '上一级', quickHome: '主目录', quickAdded: '已添加关联工作区。新会话会自动使用；已有会话可在管理中同步。', quickLinked: '已关联', quickPath: '目录路径', quickGo: '前往', quickHint: '自动生成别名，无需额外配置。', quickNoFolders: '此目录没有可选子文件夹。', quickUnavailable: '目录选择器不可用，请从已有工作区选择或使用管理入口。' });
    Object.assign(en, { quickCancel: 'Cancel', quickAdd: 'Add linked workspace…', quickManage: 'Manage linked workspaces', quickTitle: 'Add linked workspace', quickFor: 'Add to: {name}', quickExisting: 'Choose an existing workspace', quickBrowse: 'Choose local directory…', quickConfirm: 'Add this workspace', quickChoose: 'Choose this directory', quickUp: 'Parent directory', quickHome: 'Home directory', quickAdded: 'Linked workspace added. New sessions inherit it; synchronize existing sessions in Manage.', quickLinked: 'Already linked', quickPath: 'Directory path', quickGo: 'Go', quickHint: 'An alias is generated automatically. No extra configuration is required.', quickNoFolders: 'No subdirectories here.', quickUnavailable: 'Directory picker unavailable. Choose an existing workspace or use Manage.' });
    const css = `
      .dsh-lw{height:100%;width:100%;min-width:0;max-width:100%;overflow:auto;color:var(--dsw-alias-text-primary,#222);background:var(--dsw-alias-bg-base,#fafafa);font-family:var(--dsh-font-family-text,system-ui,sans-serif);font-size:14px;line-height:1.6;box-sizing:border-box}
      .dsh-lw *{box-sizing:border-box}.dsh-lw-wrap{width:100%;min-width:0;max-width:1080px;margin:auto;padding:36px 32px 60px}.dsh-lw-bar>*{min-width:0}
      .dsh-lw h1{font-size:27px;letter-spacing:-.5px;margin:0}.dsh-lw h2{font-size:17px;margin:0 0 6px}.dsh-lw p{margin:6px 0 16px}.dsh-lw-muted{opacity:.67}
      .dsh-lw-top,.dsh-lw-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.dsh-lw-top{justify-content:space-between;margin-bottom:28px}
      .dsh-lw-card{border:1px solid var(--dsw-alias-border-primary,#8884);border-radius:14px;padding:22px;margin-top:18px;background:var(--dsw-alias-bg-elevated,transparent)}
      .dsh-lw label{display:flex;flex-direction:column;gap:5px;font-size:12px}.dsh-lw input,.dsh-lw select,.dsh-lw button{font:inherit;color:inherit;min-height:36px;border:1px solid var(--dsw-alias-border-primary,#8886);border-radius:7px;background:var(--dsw-alias-bg-base,transparent);padding:6px 10px;max-width:100%}
      .dsh-lw input,.dsh-lw select{width:100%;min-width:0}.dsh-lw button{cursor:pointer;white-space:normal}.dsh-lw button:disabled,.dsh-lw select:disabled{opacity:.5;cursor:default}
      .dsh-lw button:focus-visible,.dsh-lw input:focus-visible,.dsh-lw select:focus-visible{outline:2px solid #4d6bfe;outline-offset:2px}
      .dsh-lw .dsh-lw-primary{background:#4d6bfe;color:white;border-color:#4d6bfe}.dsh-lw-path{font-family:ui-monospace,Consolas,monospace;font-size:12px;overflow-wrap:anywhere}
      .dsh-lw-main{border-left:3px solid #4d6bfe;padding-left:15px;margin-top:18px}.dsh-lw-pill{display:inline-block;border:1px solid #8885;padding:2px 8px;border-radius:20px;font-size:11px}
      .dsh-lw-link{border-top:1px solid #8883;padding-top:17px;margin-top:17px}.dsh-lw-fields{display:grid;grid-template-columns:140px minmax(0,1fr) auto;gap:12px;align-items:end}.dsh-lw-purpose{margin-top:10px}
      .dsh-lw-footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:20px}.dsh-lw-notice{border-left:3px solid #4d6bfe;padding:10px 14px;background:#4d6bfe0a;margin:16px 0;overflow-wrap:anywhere}
      .dsh-lw-error{border-left-color:#d64d4d;background:#d64d4d0a}.dsh-lw-session{flex:1 1 180px;min-width:0}.dsh-lw-results{margin-top:16px;max-height:360px;overflow:auto}.dsh-lw-result{display:block!important;text-align:left;width:100%;border:0!important;border-radius:0!important;border-bottom:1px solid #8883!important;padding:10px!important}
      .dsh-lw-result code{display:block;color:#6b83f5;overflow-wrap:anywhere}.dsh-lw-result span{display:block;font:12px/1.6 ui-monospace,Consolas,monospace;overflow-wrap:anywhere;white-space:pre-wrap}
      .dsh-lw pre{overflow:auto;max-height:420px;background:#8881;border-radius:8px;padding:14px;font:12px/1.7 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.dsh-lw details{margin-top:12px}.dsh-lw-badge{font:inherit;color:inherit;background:transparent;border:1px solid #8884;border-radius:8px;padding:4px 9px;cursor:pointer;font-size:12px}
      @media(max-width:620px){.dsh-lw-wrap{padding:22px 15px}.dsh-lw-card{padding:16px}.dsh-lw-fields{grid-template-columns:1fr}.dsh-lw h1{font-size:23px}.dsh-lw-bar>*{max-width:100%}}
    `;
    async function api(body, signal) {
      const response = await fetch('/api/linked-workspaces', body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal } : { signal });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.code || 'operation-failed'); error.code = data.code; throw error; }
      return data;
    }
    function QuickActions({ t, listDirectory, pickDirectory, openManager }) {
      const [menu, setMenu] = React.useState(null), [dialog, setDialog] = React.useState(null);
      const [projects, setProjects] = React.useState([]), [selected, setSelected] = React.useState('');
      const [listing, setListing] = React.useState(null), [location, setLocation] = React.useState('');
      const [busy, setBusy] = React.useState(false), [error, setError] = React.useState(''), [notice, setNotice] = React.useState('');
      const abort = React.useRef(null), previousFocus = React.useRef(null), surface = React.useRef(null);
      const sequence = React.useRef(0);
      const close = () => { sequence.current++; abort.current?.abort(); setMenu(null); setDialog(null); setError(''); setBusy(false); previousFocus.current?.focus?.(); };
      const describe = e => Object.hasOwn(zh, 'error.' + e.code) ? t('error.' + e.code) : t('error');
      React.useEffect(() => {
        const target = event => {
          let element = event.target instanceof Element ? event.target : null;
          if (event.type === 'keydown') { if (!(event.key === 'F10' && event.shiftKey) && event.key !== 'ContextMenu') return; }
          const row = element?.closest('[data-row-key^="workspace:"]');
          if (!row) return;
          const id = row.getAttribute('data-row-key').slice('workspace:'.length);
          if (!id || id === 'ungrouped') return;
          event.preventDefault(); close(); previousFocus.current = document.activeElement;
          const bounds = row.getBoundingClientRect();
          setMenu({ projectId: id, x: event.type === 'keydown' ? bounds.left + 15 : event.clientX, y: event.type === 'keydown' ? bounds.bottom : event.clientY });
        };
        document.addEventListener('contextmenu', target); document.addEventListener('keydown', target);
        return () => { sequence.current++; abort.current?.abort(); document.removeEventListener('contextmenu', target); document.removeEventListener('keydown', target); };
      }, []);
      React.useEffect(() => {
        if (!menu && !dialog) return;
        surface.current?.querySelector('button,select,input')?.focus();
        const keydown = event => {
          if (event.key === 'Escape') { event.preventDefault(); close(); return; }
          const controls = [...(surface.current?.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled)') ?? [])];
          const index = controls.indexOf(document.activeElement);
          if (menu && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length; controls[next]?.focus();
          } else if (event.key === 'Tab' && controls.length) {
            if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1).focus(); }
            else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0].focus(); }
          }
        };
        document.addEventListener('keydown', keydown); return () => document.removeEventListener('keydown', keydown);
      }, [menu, dialog]);
      React.useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 8000); return () => clearTimeout(timer); }, [notice]);
      async function work(action) {
        abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
        const generation = ++sequence.current; setBusy(true); setError('');
        try { await action(controller.signal, generation); }
        catch (e) { if (!controller.signal.aborted && generation === sequence.current) setError(describe(e)); }
        finally { if (generation === sequence.current) setBusy(false); }
      }
      function start() {
        const projectId = menu.projectId; setMenu(null); setListing(null); setSelected(''); setDialog({ projectId, title: '' });
        void work(async signal => {
          const data = await api(null, signal); signal.throwIfAborted();
          const project = data.projects.find(p => p.id === projectId); if (!project) throw { code: 'project-not-found' };
          setProjects(data.projects); setDialog(project);
        });
      }
      async function add(path, signal) {
        const data = await api(null, signal); signal.throwIfAborted();
        const project = data.projects.find(p => p.id === dialog.projectId || p.id === dialog.id);
        if (!project) throw { code: 'project-not-found' };
        const base = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 26);
        const stem = /^[a-z]/.test(base) ? base : 'workspace'; let alias = stem, n = 2;
        while (alias === 'main' || project.links.some(link => link.alias === alias)) alias = stem + '-' + n++;
        await api({ action: 'save', projectId: project.id, expectedRevision: project.revision, links: [...project.links, { alias, path, purpose: '' }] }, signal);
        signal.throwIfAborted(); close(); setNotice(t('quickAdded'));
        window.dispatchEvent(new CustomEvent('dsh-linked-workspaces:changed', { detail: { projectId: project.id } }));
      }
      async function browse(path) {
        void work(async signal => {
          const value = await listDirectory(path, signal); signal.throwIfAborted(); setListing(value); setLocation(value.path);
        });
      }
      function chooseDirectory() {
        const desktop = globalThis.__DSH_DIRECTORY_PICKER__;
        void work(async signal => {
          if (desktop?.pick) { const path = await desktop.pick(); signal.throwIfAborted(); if (path) await add(path, signal); return; }
          try { const value = await listDirectory(undefined, signal); signal.throwIfAborted(); setListing(value); setLocation(value.path); }
          catch (e) {
            if (signal.aborted) throw e;
            if ((e.rpcError?.code ?? e.code) !== 'directory-picker/unavailable') throw e;
            const path = await pickDirectory(); signal.throwIfAborted(); if (path) await add(path, signal);
          }
        });
      }
      const linked = p => p.id === dialog?.id || dialog?.links?.some(link => link.path === p.mainPath);
      const quickCss = `.dsh-lw-quick{font:14px/1.5 var(--dsh-font-family-text,system-ui);color:var(--dsw-alias-text-primary,#222)}.dsh-lw-quick *{box-sizing:border-box}.dsh-lw-quick-backdrop{position:fixed;inset:0;z-index:10000;background:#0005;display:flex;align-items:center;justify-content:center;padding:16px}.dsh-lw-quick-menu,.dsh-lw-quick-dialog,.dsh-lw-quick-toast{background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--dsw-alias-border-primary,#8885);border-radius:12px;box-shadow:0 10px 40px #0002}.dsh-lw-quick-menu{position:fixed;width:240px;max-width:calc(100vw - 16px);padding:5px;z-index:10001}.dsh-lw-quick button,.dsh-lw-quick input,.dsh-lw-quick select{font:inherit;color:inherit;border:1px solid var(--dsw-alias-border-primary,#8885);background:transparent;border-radius:7px;padding:9px 12px;max-width:100%;min-width:0}.dsh-lw-quick button{cursor:pointer}.dsh-lw-quick button:disabled{opacity:.45;cursor:default}.dsh-lw-quick button:focus-visible,.dsh-lw-quick input:focus-visible,.dsh-lw-quick select:focus-visible{outline:2px solid #4d6bfe;outline-offset:2px}.dsh-lw-quick-menu button{display:block;width:100%;border:0;text-align:left}.dsh-lw-quick-menu button:hover{background:#8882}.dsh-lw-quick-dialog{width:520px;max-height:85vh;overflow:auto;padding:24px}.dsh-lw-quick-dialog h2{font-size:19px;margin:0 0 8px}.dsh-lw-quick-dialog p{overflow-wrap:anywhere}.dsh-lw-quick-dialog select,.dsh-lw-quick-dialog input{width:100%;margin:8px 0}.dsh-lw-quick-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.dsh-lw-quick-folders{max-height:240px;overflow:auto;border-block:1px solid #8883;margin:12px 0}.dsh-lw-quick-folders button{display:block;width:100%;text-align:left;border:0;overflow-wrap:anywhere}.dsh-lw-quick .dsh-lw-quick-primary{background:#4d6bfe;color:white;border-color:#4d6bfe}.dsh-lw-quick-toast{position:fixed;bottom:24px;right:24px;max-width:min(440px,calc(100vw - 48px));z-index:10002;padding:16px}.dsh-lw-quick [role=alert]{color:var(--dsw-alias-text-error,#b42318)}`;
      return h('div', { className: 'dsh-lw-quick' }, h('style', null, quickCss),
        menu && h('div', { className: 'dsh-lw-quick-backdrop', style: { background: 'transparent' }, onPointerDown: e => { if (e.target === e.currentTarget) close(); } },
          h('div', { ref: surface, role: 'menu', 'aria-label': t('quickTitle'), className: 'dsh-lw-quick-menu', style: { left: Math.max(8, Math.min(menu.x, innerWidth - 248)), top: Math.max(8, Math.min(menu.y, innerHeight - 112)) } },
            h('button', { type: 'button', role: 'menuitem', onClick: start }, t('quickAdd')),
            h('button', { type: 'button', role: 'menuitem', onClick: () => { const id = menu.projectId; close(); openManager(id); } }, t('quickManage')))),
        dialog && h('div', { className: 'dsh-lw-quick-backdrop', onPointerDown: e => { if (e.target === e.currentTarget) close(); } },
          h('section', { ref: surface, role: 'dialog', 'aria-modal': true, 'aria-label': t('quickTitle'), className: 'dsh-lw-quick-dialog' },
            h('h2', null, t('quickTitle')), h('p', null, t('quickFor', { name: dialog.title })), h('p', { style: { opacity: .65 } }, t('quickHint')),
            error && h('p', { role: 'alert' }, error), busy && h('p', { role: 'status' }, t('saving')),
            !listing ? h(React.Fragment, null, h('label', null, t('quickExisting'), h('select', { 'aria-label': t('quickExisting'), value: selected, disabled: busy, onChange: e => setSelected(e.target.value) }, h('option', { value: '' }, t('existing')), projects.filter(p => p.id !== dialog.id).map(p => h('option', { key: p.id, value: p.id, disabled: linked(p) }, p.title + (linked(p) ? ' · ' + t('quickLinked') : ''))))),
              h('div', { className: 'dsh-lw-quick-row' }, h('button', { type: 'button', className: 'dsh-lw-quick-primary', disabled: busy || !selected, onClick: () => work(signal => add(projects.find(p => p.id === selected).mainPath, signal)) }, t('quickConfirm')), h('button', { type: 'button', disabled: busy, onClick: chooseDirectory }, t('quickBrowse'))))
              : h(React.Fragment, null, h('form', { onSubmit: e => { e.preventDefault(); browse(location); } }, h('label', null, t('quickPath'), h('input', { 'aria-label': t('quickPath'), value: location, disabled: busy, onChange: e => setLocation(e.target.value) })), h('div', { className: 'dsh-lw-quick-row' }, h('button', { type: 'submit', disabled: busy }, t('quickGo')), h('button', { type: 'button', disabled: busy || listing.crumbs.length < 2, onClick: () => browse(listing.crumbs.at(-2).path) }, t('quickUp')), h('button', { type: 'button', disabled: busy, onClick: () => browse(listing.home) }, t('quickHome')))),
                h('div', { className: 'dsh-lw-quick-folders' }, listing.entries.filter(e => !e.hidden).map(e => h('button', { type: 'button', key: e.path, disabled: busy, onClick: () => browse(e.path) }, '▸ ' + e.name)), !listing.entries.length && h('p', null, t('quickNoFolders'))),
                h('button', { type: 'button', className: 'dsh-lw-quick-primary', disabled: busy, onClick: () => work(signal => add(listing.path, signal)) }, t('quickChoose'))),
            h('div', { className: 'dsh-lw-quick-row' }, h('button', { type: 'button', onClick: close }, t('quickCancel'))))),
        notice && h('div', { className: 'dsh-lw-quick-toast', role: 'status' }, notice, h('button', { type: 'button', 'aria-label': t('quickCancel'), onClick: () => setNotice('') }, '×')));
    }
    function Icon({ size = 20 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true },
        h('path', { d: 'M3 7h6l2 2h10v11H3zM3 7V4h6l2 3h10v2M8 14h8M12 11v6' }));
    }
    function Badge(props) {
      const snapshot = props.useProjection('linkedWorkspaces');
      const value = snapshot?.value ?? snapshot;
      return h(React.Fragment, null, h('style', null, css), h('button', { className: 'dsh-lw-badge', type: 'button', onClick: props.openPanel, title: props.t('title') },
        value?.links ? props.t('badge', { count: value.links.length }) : props.t('badgeEmpty')));
    }
    function Panel({ t, useSessions, refreshSessions, openSession, openWorkspace }) {
      const sessions = useSessions(state => state);
      const [projects, setProjects] = React.useState([]), [projectId, setProjectId] = React.useState('');
      const [draft, setDraft] = React.useState([]), [dirty, setDirty] = React.useState(false);
      const [busy, setBusy] = React.useState(false), [loaded, setLoaded] = React.useState(false);
      const [notice, setNotice] = React.useState(''), [error, setError] = React.useState('');
      const [sessionId, setSessionId] = React.useState(''), [synced, setSynced] = React.useState(null);
      const [query, setQuery] = React.useState(''), [mode, setMode] = React.useState('files'), [scope, setScope] = React.useState('');
      const [results, setResults] = React.useState(null), [preview, setPreview] = React.useState(null);
      const controller = React.useRef(null), alive = React.useRef(true);
      const project = projects.find(p => p.id === projectId);
      const projectSessions = sessions.ids.map(id => sessions.byId[id]).filter(row => project && row?.cwd === project.mainPath);
      const row = projectSessions.find(s => s.id === sessionId);
      const snapshot = synced?.sessionId === sessionId ? synced.snapshot : row?.projectionValues?.linkedWorkspaces;
      function describe(error) { const key = 'error.' + error.code; return Object.hasOwn(zh, key) ? t(key) : t('error') + (error.code ? ' (' + error.code + ')' : ''); }
      async function operation(work) {
        controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
        setBusy(true); setError(''); setNotice('');
        try { await work(abort.signal); }
        catch (error) { if (!abort.signal.aborted && alive.current) setError(describe(error)); }
        finally { if (alive.current && !abort.signal.aborted) setBusy(false); }
      }
      async function reload(signal) {
        const data = await api(null, signal);
        if (!alive.current) return;
        setProjects(data.projects); setLoaded(true);
        const requested = panelProjectId; panelProjectId = '';
        setProjectId(old => data.projects.some(p => p.id === requested) ? requested : data.projects.some(p => p.id === old) ? old : data.projects[0]?.id ?? '');
      }
      React.useEffect(() => {
        alive.current = true; void operation(reload);
        return () => { alive.current = false; controller.current?.abort(); };
      }, []);
      React.useEffect(() => {
        setDraft(project?.links.map(link => ({ ...link })) ?? []); setDirty(false); setSessionId(''); setSynced(null);
        setResults(null); setPreview(null); setScope('');
      }, [project]);
      React.useEffect(() => {
        const changed = () => { if (dirty) setError(t('error.revision-conflict')); else void operation(reload); };
        window.addEventListener('dsh-linked-workspaces:changed', changed);
        return () => window.removeEventListener('dsh-linked-workspaces:changed', changed);
      }, [dirty]);
      const update = (index, key, value) => { setDraft(old => old.map((link, i) => i === index ? { ...link, [key]: value } : link)); setDirty(true); };
      function add(path = '') {
        let n = 1; while (draft.some(link => link.alias === 'workspace' + n)) n++;
        setDraft(old => [...old, { alias: 'workspace' + n, path, purpose: '' }]); setDirty(true);
      }
      const button = (key, onClick, options = {}) => h('button', { type: 'button', onClick, disabled: busy, ...options }, t(key));
      const input = (label, value, onChange, options = {}) => h('label', null, t(label), h('input', { 'aria-label': t(label), value, onChange: e => onChange(e.target.value), disabled: busy, ...options }));
      return h('div', { className: 'dsh-lw' }, h('style', null, css), h('div', { className: 'dsh-lw-wrap' },
        h('div', { className: 'dsh-lw-top' }, h('div', null, h('h1', null, t('title')), h('p', { className: 'dsh-lw-muted' }, t('subtitle'))), button('refresh', () => operation(reload), { disabled: busy || dirty })),
        error && h('div', { role: 'alert', className: 'dsh-lw-notice dsh-lw-error' }, error),
        notice && h('div', { role: 'status', className: 'dsh-lw-notice' }, t(notice)),
        !loaded ? h('p', { role: 'status' }, t('loading')) : !projects.length ? h('p', null, t('empty')) : h(React.Fragment, null,
          h('label', null, t('project'), h('select', { 'aria-label': t('project'), value: projectId, disabled: busy || dirty, onChange: e => setProjectId(e.target.value) }, projects.map(p => h('option', { key: p.id, value: p.id }, p.title)))),
          project && h(React.Fragment, null,
            h('div', { className: 'dsh-lw-main' }, h('strong', null, t('primary') + ' · ' + project.title), h('div', { className: 'dsh-lw-path' }, project.mainPath), h('div', { className: 'dsh-lw-footer' }, h('span', { className: 'dsh-lw-pill' }, t('revision', { revision: project.revision })), button('enterProject', () => operation(() => openWorkspace(projectId)), { disabled: busy || dirty }))),
            h('section', { className: 'dsh-lw-card', 'aria-label': t('links') }, h('h2', null, t('links')), h('p', { className: 'dsh-lw-muted' }, t('linksHint')),
              !draft.length && h('p', { className: 'dsh-lw-muted' }, t('noLinks')),
              draft.map((link, i) => h('div', { className: 'dsh-lw-link', key: i },
                h('div', { className: 'dsh-lw-fields' }, input('alias', link.alias, value => update(i, 'alias', value), { maxLength: 32, spellCheck: false }),
                  input('path', link.path, value => update(i, 'path', value), { maxLength: 4096, spellCheck: false }),
                  button('remove', () => { setDraft(old => old.filter((_, index) => index !== i)); setDirty(true); })),
                h('div', { className: 'dsh-lw-purpose' }, input('purpose', link.purpose, value => update(i, 'purpose', value), { maxLength: 300 })),
                h('span', { className: 'dsh-lw-pill' }, t(project.roots.find(r => r.alias === link.alias && r.path === link.path)?.status ?? 'pending')))),
              h('div', { className: 'dsh-lw-footer' }, button('add', () => add(), { disabled: busy || draft.length >= 16 }),
                h('select', { 'aria-label': t('existing'), value: '', disabled: busy || draft.length >= 16, style: { width: 'auto' }, onChange: e => { if (e.target.value) add(e.target.value); } }, h('option', { value: '' }, t('existing')), projects.filter(p => p.id !== projectId && !draft.some(r => r.path === p.mainPath)).map(p => h('option', { key: p.id, value: p.mainPath }, p.title))),
                button('save', () => operation(async signal => { await api({ action: 'save', projectId, expectedRevision: project.revision, links: draft }, signal); await reload(signal); setNotice('saved'); }), { className: 'dsh-lw-primary', disabled: busy || !dirty }),
                dirty && button('cancel', () => { setDraft(project.links.map(r => ({ ...r }))); setDirty(false); setError(''); }), dirty && h('span', { className: 'dsh-lw-muted' }, t('dirty'))),
              h('p', { className: 'dsh-lw-muted', style: { marginTop: 16, marginBottom: 0 } }, t('policy'))),
            h('section', { className: 'dsh-lw-card', 'aria-label': t('session') }, h('h2', null, t('session')), h('p', { className: 'dsh-lw-muted' }, t('sessionHint')),
              !projectSessions.length ? h('p', null, t('noSessions')) : h('div', { className: 'dsh-lw-bar' },
                h('label', { className: 'dsh-lw-session' }, t('session'), h('select', { 'aria-label': t('session'), value: sessionId, disabled: busy, onChange: e => { setSessionId(e.target.value); setSynced(null); } }, h('option', { value: '' }, t('chooseSession')), projectSessions.map(s => h('option', { key: s.id, value: s.id }, s.displayTitle)))),
                button('sync', () => operation(async signal => { const data = await api({ action: 'sync', projectId, sessionId, expectedRevision: project.revision }, signal); setSynced({ sessionId, snapshot: data.snapshot }); await refreshSessions(); setNotice('synced'); }), { disabled: busy || !sessionId || row?.running || dirty }),
                button('open', () => openSession(sessionId), { disabled: busy || !sessionId })),
              sessionId && h('p', { className: 'dsh-lw-muted' }, snapshot ? t('snapshot', { revision: snapshot.revision }) : t('firstUse'))),
            h('section', { className: 'dsh-lw-card', 'aria-label': t('search') }, h('h2', null, t('search')), h('p', { className: 'dsh-lw-muted' }, t('searchHint')),
              h('form', { className: 'dsh-lw-bar', onSubmit: e => { e.preventDefault(); if (query.trim() && !busy && !dirty) void operation(async signal => { const data = await api({ action: 'search', projectId, expectedRevision: project.revision, query, mode, workspace: scope || undefined }, signal); setResults(data.result); setPreview(null); }); } },
                h('div', { style: { flex: '1 1 150px', minWidth: 0 } }, input('query', query, setQuery, { maxLength: 200, type: 'search' })),
                h('label', null, t('mode'), h('select', { 'aria-label': t('mode'), value: mode, disabled: busy, onChange: e => setMode(e.target.value) }, ['files', 'text'].map(v => h('option', { key: v, value: v }, t(v))))),
                h('label', null, t('scope'), h('select', { 'aria-label': t('scope'), value: scope, disabled: busy, onChange: e => setScope(e.target.value) }, h('option', { value: '' }, t('all')), [{ alias: 'main' }, ...project.links].map(r => h('option', { key: r.alias, value: r.alias }, r.alias)))),
                h('button', { type: 'submit', className: 'dsh-lw-primary', disabled: busy || dirty || !query.trim() }, t('run'))),
              results && h('div', { 'aria-live': 'polite' }, results.truncated && h('p', { className: 'dsh-lw-notice' }, t('incomplete')),
                results.warnings.length > 0 && h('details', null, h('summary', null, t('warnings', { count: results.warningCount })), h('pre', null, JSON.stringify(results.warnings, null, 2))),
                !results.matches.length ? h('p', null, t('none')) : h('div', { className: 'dsh-lw-results' }, results.matches.map((match, i) => h('button', { type: 'button', key: i, className: 'dsh-lw-result', disabled: busy, onClick: () => operation(async signal => { const data = await api({ action: 'read', projectId, expectedRevision: project.revision, workspace: match.workspace, path: match.path, startLine: Math.max(1, (match.line ?? 1) - 5) }, signal); setPreview(data.result); }) }, h('code', null, match.file + (match.line ? ':' + match.line : '')), match.preview && h('span', null, match.preview))))),
              preview && h('div', { className: 'dsh-lw-link' }, h('div', { className: 'dsh-lw-bar' }, h('h2', null, t('preview')), button('close', () => setPreview(null))), h('div', { className: 'dsh-lw-path' }, preview.file), h('pre', null, preview.content), preview.truncated && h('p', null, t('readMore')),
                preview.instructions.length > 0 && h('details', null, h('summary', null, t('instructions')), preview.instructions.map(item => h('div', { key: item.file }, h('div', { className: 'dsh-lw-path' }, item.scope), h('pre', null, item.text))))))
          ))));
    }
    return {
      inject: ['slots', 'locale', 'sessions', 'layout', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }));
        const t = ctx.locale.bind(NS);
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: PANEL + '.quick-actions', locale: NS,
          inject: () => ({ listDirectory: (path, signal) => ctx.uiWorkspace.listDirectory(path, signal), pickDirectory: () => ctx.uiWorkspace.pickDirectory(), openManager: id => { panelProjectId = id; ctx.layout.selectPanel(PANEL); window.dispatchEvent(new CustomEvent('dsh-linked-workspaces:changed', { detail: { projectId: id } })); } }) }, QuickActions));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL, locale: NS,
          inject: () => ({ refreshSessions: () => ctx.sessions.refresh(), openSession: id => ctx.uiWorkspace.openSession(id), openWorkspace: id => ctx.uiWorkspace.openWorkspace(id) }) }, Panel));
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 13, locale: NS, label: () => t('title') }, Icon));
        ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({ name: 'conversation.session.header.actions', id: PANEL, order: 20, locale: NS,
          inject: () => ({ openPanel: () => ctx.layout.selectPanel(PANEL) }) }, Badge));
      },
    };
  },
});
