'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = name => fs.readFileSync(path.join(__dirname, '../static/js', name), 'utf8');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKuoAAAAASUVORK5CYII=';

function element() {
  const styles = new Map(), attributes = new Map();
  return {
    styles, attributes, children: [],
    style: { getPropertyValue: name => styles.get(name)?.value || '', getPropertyPriority: name => styles.get(name)?.priority || '', setProperty(name, value, priority = '') { styles.set(name, { value, priority }); }, removeProperty: name => styles.delete(name) },
    getAttribute: name => attributes.get(name) ?? null, setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name),
    appendChild(child) { this.children.push(child); }, remove() {}, click() {},
  };
}

function environment({ oldTheme, savedSkin, delayedImage = false } = {}) {
  const storage = new Map();
  if (oldTheme) storage.set('openxnet-theme', oldTheme);
  const downloads = [], events = [], urls = new Map();
  const appElement = element();
  const dom = { documentElement: element(), body: element(), getElementById: id => id === 'app' ? appElement : null, addEventListener() {},
    createElement(tag) {
      const node = element();
      if (tag === 'a') node.click = () => downloads.push({ name: node.download, blob: urls.get(node.href) });
      if (tag === 'canvas') { node.getContext = () => ({ drawImage() {} }); node.toDataURL = () => PNG; }
      return node;
    },
  };
  let resolveImage;
  const imageReady = delayedImage ? new Promise(resolve => { resolveImage = resolve; }) : Promise.resolve();
  const localStorage = { blocked: false, getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem(key, value) { if (this.blocked) throw new Error('QuotaExceededError'); storage.set(key, value); },
  };
  const context = vm.createContext({
    console, document: dom, localStorage, performance: { now: () => Date.now() },
    setTimeout: () => 1, clearTimeout() {}, addEventListener() {}, dispatchEvent: event => events.push(event),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    Blob: class { constructor(parts, options) { this.parts = parts; this.type = options.type; } },
    URL: { createObjectURL(value) { const url = 'blob:skin-test-' + urls.size; urls.set(url, value); return url; }, revokeObjectURL: url => urls.delete(url) },
    Image: class { constructor() { this.naturalWidth = 100; this.naturalHeight = 100; } decode() { return imageReady; } },
    atob: encoded => Buffer.from(encoded, 'base64').toString('binary'),
  });
  vm.runInContext('globalThis.window = globalThis;', context);
  // Evaluate both real modules in the same realm. Passing host objects directly
  // would intentionally fail the engine's plain-object validation.
  vm.runInContext(source('openxnet-skins.js'), context);
  if (savedSkin) {
    context.seedJSON = JSON.stringify(savedSkin);
    vm.runInContext('OpenXnetSkins.createStore().save({...OpenXnetSkins.presets()[0], ...JSON.parse(seedJSON)});', context);
  }
  vm.runInContext(source('openxnet-skin-workbench.js'), context);
  vm.runInContext(`
    globalThis.mixin = OpenXnetSkinWorkbench;
    globalThis.app = mixin.data();
    app.isCurrentLanguageZh = () => true;
    app.getPrototypeThemeLabel = value => value;
    for (const [key, method] of Object.entries(mixin.methods)) app[key] = method.bind(app);
    for (const [key, getter] of Object.entries(mixin.computed)) Object.defineProperty(app, key, {get: () => getter.call(app)});
    mixin.mounted.call(app);
  `, context);
  return { context, storage, dom, localStorage, downloads, events, resolveImage,
    run: text => vm.runInContext(text, context),
    json: expression => JSON.parse(vm.runInContext('JSON.stringify(' + expression + ')', context)),
  };
}

test('saving a draft persists the complete skin and a fresh store restores the selection', () => {
  const env = environment();
  env.run(`app.openSkinStudio(); Object.assign(app.skinDraft, { name:'我的测试皮肤', primary:'#247ed5', radius:19, density:'compact', background:'#e8f2fa', surface:'#f7fcff' }); app.previewSkinDraft(); app.saveSkinDraft();`);
  assert.equal(env.run('app.skinError'), '');
  const saved = env.json('app.skinActive');
  assert.equal(saved.name, '我的测试皮肤');
  assert.equal(saved.primary, '#247ed5');
  assert.equal(saved.radius, 19);
  assert.equal(saved.density, 'compact');
  assert.equal(env.run('app.skinPreviewing'), false);
  assert.deepEqual(env.json('OpenXnetSkins.createStore().get().value'), saved);
  assert.equal(env.run('OpenXnetSkins.createStore().read().value.selectedId'), saved.id);
});

test('cancelling a live draft restores saved fields and applied tokens without a storage write', () => {
  const env = environment({ savedSkin: { id: 'user-saved', name: '已保存', primary: '#167ac2' } });
  const before = env.storage.get('openxnet.skins.v1');
  const oldAccent = env.dom.body.style.getPropertyValue('--ox-accent');
  env.run(`app.openSkinStudio(); app.skinDraft.primary='#953bd0'; app.skinDraft.radius=23; app.previewSkinDraft();`);
  assert.notEqual(env.dom.body.style.getPropertyValue('--ox-accent'), oldAccent);
  env.run('app.skinStudioOpen=false; mixin.watch.skinStudioOpen.call(app,false);');
  assert.equal(env.run('app.skinPreviewing'), false);
  assert.equal(env.run('app.skinDraftChanged'), false);
  assert.equal(env.dom.body.style.getPropertyValue('--ox-accent'), oldAccent);
  assert.equal(env.storage.get('openxnet.skins.v1'), before);
});

test('unsupported JSON import reports an error and preserves current selection and stored data', async () => {
  const env = environment({ savedSkin: { id: 'user-saved', name: '已保存' } });
  const before = env.storage.get('openxnet.skins.v1');
  const active = env.json('app.skinActive');
  await env.run(`app.importSkinFile({target:{value:'chosen',files:[{size:30,text:async()=>JSON.stringify({format:'openxnet-skin',version:99,skin:{}})}]}})`);
  assert.ok(env.run('app.skinError.length') > 0);
  assert.equal(env.run('app.skinBusy'), false);
  assert.deepEqual(env.json('app.skinActive'), active);
  assert.equal(env.storage.get('openxnet.skins.v1'), before);
});

test('export downloads the saved version and successful reimport selects a distinct copy', async () => {
  const env = environment({ savedSkin: { id: 'user-saved', name: '导出皮肤', primary: '#1a7cad' } });
  env.run(`app.openSkinStudio(); app.skinDraft.primary='#a037b2'; app.previewSkinDraft(); app.exportCurrentSkin();`);
  assert.equal(env.downloads.length, 1);
  assert.match(env.downloads[0].name, /\.openxnet-skin\.json$/);
  const exported = env.downloads[0].blob.parts.join('');
  assert.equal(JSON.parse(exported).skin.primary, '#1a7cad');
  env.context.importText = exported;
  await env.run('app.importSkinFile({target:{value:"chosen",files:[{size:importText.length,text:async()=>importText}]}})');
  assert.notEqual(env.run('app.skinActive.id'), 'user-saved');
  assert.equal(env.run('app.skinActive.primary'), '#1a7cad');
  assert.equal(env.run('app.skinPreviewing'), false);
  assert.equal(env.run('OpenXnetSkins.createStore().read().value.customSkins.length'), 2);
});

test('a save quota failure preserves the active skin and editable preview for retry', () => {
  const env = environment({ savedSkin: { id: 'user-saved', name: '已保存' } });
  const before = env.storage.get('openxnet.skins.v1');
  env.run(`app.openSkinStudio(); app.skinDraft.primary='#973cc5'; app.previewSkinDraft();`);
  env.localStorage.blocked = true;
  env.run('app.saveSkinDraft();');
  assert.ok(env.run('app.skinError.length') > 0);
  assert.equal(env.run('app.skinActive.primary'), '#009fdf');
  assert.equal(env.run('app.skinDraft.primary'), '#973cc5');
  assert.equal(env.run('app.skinPreviewing'), true);
  assert.equal(env.storage.get('openxnet.skins.v1'), before);
});

test('legacy dark preference migrates only when a local skin selection is absent', () => {
  const first = environment({ oldTheme: 'midnight' });
  assert.equal(first.run('app.skinActive.id'), 'brand-dark');
  const saved = environment({ oldTheme: 'midnight', savedSkin: { id: 'user-saved', name: '浅色自定义', mode: 'light' } });
  assert.equal(saved.run('app.skinActive.id'), 'user-saved');
  assert.equal(saved.dom.documentElement.getAttribute('data-theme'), 'light');
});

test('real late bootstrap theme application restores the selected skin and active draft', async () => {
  const env = environment({ savedSkin: { id: 'user-saved', name: '浅色自定义', mode: 'light', primary: '#257fa8' } });
  const before = env.storage.get('openxnet.skins.v1');
  env.run(`globalThis.openxnetDesktop={getBootstrapSnapshot:async()=>({systemSettings:{settings:{theme:'dark'}}})};`);
  env.run(source('startup-bootstrap.js'));
  await env.run('openxnetBootstrapPromise');
  assert.equal(env.dom.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(env.storage.get('openxnet.skins.v1'), before);
  env.run(`app.openSkinStudio(); app.skinDraft.primary='#943dbb'; app.previewSkinDraft(); document.documentElement.setAttribute('data-theme','midnight'); restoreOpenXnetSkin();`);
  assert.equal(env.dom.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(env.dom.documentElement.style.getPropertyValue('--ox-brand-primary'), '#943dbb');
  assert.equal(env.storage.get('openxnet.skins.v1'), before);
});

test('topbar light/dark roundtrip preserves custom fields and returns to the original custom palette', async () => {
  const env = environment({ savedSkin: { id: 'user-saved', name: '我的配色', mode: 'light', primary: '#2387bb', background: '#e4f0f9', surface: '#f2faff', text: '#233d50', radius: 21, density: 'compact', wallpaper: PNG, wallpaperOpacity: 0.2, surfaceOpacity: 0.91 } });
  const initial = env.json('app.skinActive');
  await env.run('app.togglePrototypeThemeMode()');
  assert.equal(env.run('app.skinActive.mode'), 'dark');
  for (const field of ['primary', 'radius', 'density', 'wallpaper', 'wallpaperOpacity', 'surfaceOpacity']) assert.deepEqual(env.json('app.skinActive.' + field), initial[field], field);
  await env.run('app.togglePrototypeThemeMode()');
  assert.equal(env.run('app.skinActive.mode'), 'light');
  for (const field of ['primary', 'background', 'surface', 'text', 'radius', 'density', 'wallpaper', 'wallpaperOpacity', 'surfaceOpacity']) assert.deepEqual(env.json('app.skinActive.' + field), initial[field], field);
});

test('closing the studio during wallpaper decoding prevents a cancelled preview from reappearing', async () => {
  const env = environment({ delayedImage: true, savedSkin: { id: 'user-saved', name: '已保存' } });
  const before = env.storage.get('openxnet.skins.v1');
  env.run('app.openSkinStudio();');
  const pending = env.run(`app.uploadSkinWallpaper({target:{value:'chosen',files:[{type:'image/png',size:40}]}})`);
  assert.equal(env.run('app.skinBusy'), true);
  env.run('app.skinStudioOpen=false; mixin.watch.skinStudioOpen.call(app,false);');
  env.resolveImage();
  await pending;
  assert.equal(env.run('app.skinPreviewing'), false);
  assert.equal(env.run('app.skinDraft.wallpaper'), null);
  assert.equal(env.dom.body.style.getPropertyValue('--ox-skin-wallpaper'), 'none');
  assert.equal(env.storage.get('openxnet.skins.v1'), before);
});

test('a valid maximum-length name can be copied and switched to dark mode', async () => {
  const env = environment({ savedSkin: { id: 'user-saved', name: '界'.repeat(48) } });
  env.run('app.openSkinStudio(); app.saveSkinDraft(true);');
  assert.equal(env.run('app.skinError'), '');
  assert.notEqual(env.run('app.skinActive.id'), 'user-saved');
  assert.ok(env.run('app.skinActive.name.length') <= 48);
  await env.run('app.togglePrototypeThemeMode()');
  assert.equal(env.run('app.skinError'), '');
  assert.equal(env.run('app.skinActive.mode'), 'dark');
});

test('maximum-length imported identifiers support dark/light roundtrip without losing their palette', async () => {
  const id = 'u'.repeat(64);
  const env = environment({ savedSkin: { id, name: '合法长标识', background: '#e6f0f8', surface: '#f1f9ff', text: '#244157' } });
  assert.equal(env.run('app.skinActive.id'), id);
  const original = env.json('app.skinActive');
  await env.run('app.togglePrototypeThemeMode()');
  assert.equal(env.run('app.skinError'), '');
  assert.equal(env.run('app.skinActive.mode'), 'dark');
  assert.ok(env.run('app.skinActive.id.length') <= 64);
  await env.run('app.togglePrototypeThemeMode()');
  assert.equal(env.run('app.skinError'), '');
  assert.equal(env.run('app.skinActive.mode'), 'light');
  for (const field of ['background', 'surface', 'text']) assert.equal(env.run('app.skinActive.' + field), original[field]);
});
