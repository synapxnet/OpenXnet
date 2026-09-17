'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Skins = require('../static/js/openxnet-skins.js');

function memoryStorage(initial = null) {
  return {
    raw: initial, writes: 0, failGet: false, failSet: false,
    getItem(key) { assert.equal(key, Skins.STORAGE_KEY); if (this.failGet) throw new Error('SecurityError'); return this.raw; },
    setItem(key, value) { assert.equal(key, Skins.STORAGE_KEY); if (this.failSet) throw new Error('QuotaExceededError'); this.raw = value; this.writes++; },
  };
}
const draft = overrides => ({ ...Skins.presets()[0], id: 'custom-test', name: '我的蓝青皮肤', ...overrides });
const state = (customSkins, selectedId = 'brand-light') => ({ version: 1, selectedId, customSkins });
const envelope = skin => JSON.stringify({ format: 'openxnet-skin', version: 1, skin });
const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKuoAAAAASUVORK5CYII=';
function expectFailure(result) { assert.equal(result.ok, false); assert.equal(typeof result.error, 'string'); assert.ok(result.error.length > 3); }

test('brand presets expose blue/cyan and readable colors across both modes', () => {
  const presets = Skins.presets();
  assert.equal(presets[0].primary, '#009fdf');
  assert.equal(presets[0].id, 'brand-light');
  assert.equal(presets[1].id, 'brand-dark');
  for (const preset of presets) {
    const result = Skins.preview(preset);
    assert.equal(result.ok, true, preset.name);
    const { tokens, contrast } = result.value;
    assert.equal(tokens['--ox-brand-secondary'], '#16dfe3');
    for (const value of Object.values(contrast)) assert.ok(value >= 4.5, preset.name + ': ' + value);
    for (const foreground of ['--ox-text-primary', '--ox-text-secondary', '--ox-text-muted', '--ox-accent']) {
      for (const background of ['--ox-bg-base', '--ox-bg-surface', '--ox-bg-surface-hover', '--ox-accent-soft']) {
        assert.ok(Skins.contrastRatio(tokens[foreground], tokens[background]) >= 4.5, preset.id + ' ' + foreground + ' on ' + background);
      }
    }
    assert.equal(tokens['--el-bg-color'], tokens['--ox-bg-surface']);
    assert.equal(tokens['--el-color-primary'], tokens['--ox-accent']);
    assert.equal(tokens['--ox-vite-text-primary'], tokens['--ox-text-primary']);
  }
});

test('unreadable user colors are corrected for preview without replacing saved choices', () => {
  const skin = draft({ text: '#fff', primary: '#fff', surface: '#fff', background: '#fff' });
  const result = Skins.preview(skin);
  assert.equal(result.ok, true);
  assert.equal(result.value.skin.text, '#ffffff');
  assert.notEqual(result.value.tokens['--ox-text-primary'], '#ffffff');
  assert.ok(result.warnings.length);
  assert.ok(result.value.contrast.textOnBackground >= 4.5);
  const divergent = Skins.preview(draft({ surface: '#bbbbbb', background: '#3e3e3e', text: '#999999' }));
  assert.equal(divergent.ok, true);
  assert.ok(divergent.value.contrast.textOnBackground >= 4.5);
  assert.ok(divergent.value.contrast.textOnSurface >= 4.5);
});

test('density, radius, wallpaper and panel strength compile only to bounded tokens', () => {
  const result = Skins.preview(draft({ radius: 0, density: 'compact', wallpaper: validPng, wallpaperOpacity: 0.25, surfaceOpacity: 0.9 }));
  assert.equal(result.ok, true);
  const tokens = result.value.tokens;
  assert.equal(tokens['--ox-skin-radius'], '0px');
  assert.equal(tokens['--ox-radius-card'], '0px');
  assert.equal(tokens['--ox-skin-spacing'], '0.85');
  assert.equal(tokens['--ox-space-4'], '14px');
  assert.equal(tokens['--ox-skin-wallpaper'], 'url("' + validPng + '")');
  assert.equal(tokens['--ox-skin-wallpaper-opacity'], '0.25');
  assert.equal(tokens['--ox-skin-surface-opacity'], '0.9');
});

test('wallpaper extremes and translucent panels keep text readable without changing stored intensity', () => {
  const result = Skins.preview({ ...Skins.presets()[1], wallpaper: validPng, wallpaperOpacity: 0.45, surfaceOpacity: 0.82 });
  assert.equal(result.ok, true);
  assert.equal(result.value.skin.wallpaperOpacity, 0.45);
  assert.equal(result.value.skin.surfaceOpacity, 0.82);
  assert.ok(result.value.contrast.textOnWallpaper >= 4.5);
  assert.ok(result.value.contrast.textOnTranslucentSurface >= 4.5);
  assert.ok(Number(result.value.tokens['--ox-skin-wallpaper-opacity']) <= 0.45);
  assert.ok(Number(result.value.tokens['--ox-skin-surface-opacity']) >= 0.82);
});

test('malformed imports and unsupported fields never write or disturb selection', () => {
  const storage = memoryStorage();
  const store = Skins.createStore({ storage });
  assert.equal(store.save(draft()).ok, true);
  const before = storage.raw, writes = storage.writes;
  const invalid = [
    '{broken', 'null', '[]', JSON.stringify({ format: 'openxnet-skin', version: 2, skin: draft() }),
    envelope(draft({ css: 'body{display:none}' })), envelope(draft({ primary: 'red; background:url(https://example.com)' })),
    envelope(draft({ wallpaper: 'https://example.com/picture.png' })), envelope(draft({ wallpaper: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' })),
    envelope(draft({ name: '<script>alert(1)</script>' })), envelope(draft({ radius: '14px' })), envelope(draft({ density: 'calc(1 + 1)' })),
    '{"format":"openxnet-skin","version":1,"skin":' + JSON.stringify(draft()).replace(/}$/, ',"__proto__":{"polluted":true}}') + '}',
  ];
  for (const candidate of invalid) expectFailure(store.import(candidate));
  assert.equal(storage.raw, before);
  assert.equal(storage.writes, writes);
  assert.equal(store.read().value.selectedId, 'custom-test');
  assert.equal({}.polluted, undefined);
});

test('all numeric and naming bounds reject invalid data without coercion', () => {
  const overrides = [
    { radius: -1 }, { radius: 25 }, { radius: 1.5 }, { radius: NaN }, { mode: 'auto' },
    { wallpaperOpacity: 0.46 }, { wallpaperOpacity: -0.1 }, { wallpaperOpacity: '0.3' },
    { surfaceOpacity: 0.8 }, { surfaceOpacity: 1.01 }, { surfaceOpacity: Infinity },
    { name: '' }, { name: 'x'.repeat(49) }, { name: 'name\nscript' }, { id: '../../config' }, { text: '#1234' },
  ];
  for (const override of overrides) expectFailure(Skins.validate(draft(override)));
});

test('wallpaper validation rejects MIME spoofing, truncated data, oversized bytes and dimensions', () => {
  assert.equal(Skins.validate(draft({ wallpaper: validPng })).ok, true);
  const invalid = [
    validPng.replace('image/png', 'image/jpeg'), 'data:image/png;base64,YWJjZA==',
    'data:image/webp;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=',
    'data:image/png;base64,' + Buffer.alloc(Skins.LIMITS.wallpaperBytes + 1).toString('base64'),
    validPng.replace('base64,', 'base64,\n'), validPng + '");color:red;/*',
  ];
  const largeDimension = Buffer.from(validPng.split(',')[1], 'base64');
  largeDimension.writeUInt32BE(5000, 16);
  invalid.push('data:image/png;base64,' + largeDimension.toString('base64'));
  const missingPixels = Buffer.from(validPng.split(',')[1], 'base64');
  const idatOffset = missingPixels.indexOf(Buffer.from('IDAT'));
  missingPixels.write('JUNK', idatOffset, 'ascii');
  invalid.push('data:image/png;base64,' + missingPixels.toString('base64'));
  for (const image of invalid) expectFailure(Skins.validate(draft({ wallpaper: image })));
});

test('real repository JPEG and WebP assets pass their respective wallpaper decoders', () => {
  for (const [file, mime] of [['openai.jpeg', 'jpeg'], ['ttswebui.jpeg', 'jpeg'], ['perplexity.webp', 'webp']]) {
    const bytes = fs.readFileSync(path.join(__dirname, '../static/source/providers', file));
    const result = Skins.validate(draft({ wallpaper: 'data:image/' + mime + ';base64,' + bytes.toString('base64') }));
    assert.equal(result.ok, true, file + ': ' + result.error);
  }
});

test('saving a preset makes a selected custom copy and returned data cannot mutate the store', () => {
  const storage = memoryStorage();
  const store = Skins.createStore({ storage });
  const saved = store.save({ ...Skins.presets()[1], name: '自定义深海' });
  assert.equal(saved.ok, true);
  assert.match(saved.value.selectedId, /^custom-/);
  assert.equal(saved.value.customSkins.length, 1);
  const id = saved.value.selectedId;
  saved.value.customSkins[0].name = 'mutated';
  assert.equal(store.get(id).value.name, '自定义深海');
  assert.equal(store.list().value.length, Skins.presets().length + 1);
  assert.equal(Skins.presets()[1].name, 'OpenXnet · 深海');
});

test('quota failures leave persisted library and selected skin unchanged', () => {
  const storage = memoryStorage();
  const store = Skins.createStore({ storage });
  store.save(draft());
  const before = storage.raw;
  storage.failSet = true;
  expectFailure(store.save(draft({ id: 'another', name: '另一套' })));
  expectFailure(store.select('brand-dark'));
  expectFailure(store.remove('custom-test'));
  expectFailure(store.import(envelope(draft({ id: 'imported' }))));
  assert.equal(storage.raw, before);
  assert.equal(store.read().value.selectedId, 'custom-test');
  assert.equal(store.get().value.name, '我的蓝青皮肤');
  storage.failSet = false;
  assert.equal(store.select('brand-dark').ok, true);
});

test('blocked reads cannot overwrite an existing library and readable state remains available', () => {
  const storage = memoryStorage();
  const store = Skins.createStore({ storage });
  store.save(draft());
  const before = storage.raw;
  storage.failGet = true;
  const snapshot = store.read();
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.value.selectedId, 'custom-test');
  assert.ok(snapshot.warnings.length);
  expectFailure(store.save(draft({ name: 'not written' })));
  expectFailure(store.select('brand-dark'));
  assert.equal(storage.raw, before);
});

test('corrupted JSON and unavailable storage recover without destructive writes', () => {
  const storage = memoryStorage('{truncated');
  const store = Skins.createStore({ storage });
  assert.equal(store.read().value.selectedId, 'brand-light');
  assert.ok(store.read().warnings.length);
  assert.equal(storage.raw, '{truncated');
  assert.equal(storage.writes, 0);
  const unavailable = Skins.createStore({ storage: null });
  assert.equal(unavailable.read().value.version, 1);
  expectFailure(unavailable.save(draft()));
  assert.equal(store.save(draft()).ok, true);
  assert.equal(store.read().value.customSkins.length, 1);
});

test('missing selection and individually corrupt entries recover without overwriting source data', () => {
  const raw = JSON.stringify(state([draft(), { ...draft({ id: 'corrupt' }), primary: 'url(bad)' }], 'missing'));
  const storage = memoryStorage(raw);
  const result = Skins.createStore({ storage }).read();
  assert.equal(result.ok, true);
  assert.equal(result.value.customSkins.length, 1);
  assert.equal(result.value.customSkins[0].id, 'custom-test');
  assert.equal(result.value.selectedId, 'brand-light');
  assert.equal(result.warnings.length, 2);
  assert.equal(storage.raw, raw);
});

test('deleting selected custom skin restores the matching brand mode', () => {
  const store = Skins.createStore({ storage: memoryStorage() });
  store.save(draft({ id: 'custom-dark', mode: 'dark' }));
  store.save(draft({ id: 'custom-light' }));
  store.select('custom-dark');
  assert.equal(store.remove('custom-light').value.selectedId, 'custom-dark');
  assert.equal(store.remove('custom-dark').value.selectedId, 'brand-dark');
  expectFailure(store.remove('brand-dark'));
  expectFailure(store.select('missing'));
});

test('versioned export/import roundtrip retains all preferences and collisions make copies', () => {
  const source = Skins.createStore({ storage: memoryStorage() });
  source.save(draft({ wallpaper: validPng, radius: 18, density: 'compact', surfaceOpacity: 0.92 }));
  const exported = source.export();
  assert.equal(exported.ok, true);
  const target = Skins.createStore({ storage: memoryStorage() });
  const imported = target.import(exported.value);
  assert.equal(imported.ok, true);
  assert.deepEqual(target.get().value, source.get().value);
  assert.deepEqual(JSON.parse(target.export().value), JSON.parse(exported.value));
  const duplicate = target.import(exported.value);
  assert.equal(duplicate.value.customSkins.length, 2);
  assert.notEqual(duplicate.value.selectedId, 'custom-test');
  assert.equal(target.get('custom-test').value.name, '我的蓝青皮肤');
});

test('library limits permit existing edits but reject over-capacity writes atomically', () => {
  const storage = memoryStorage();
  const store = Skins.createStore({ storage });
  const full = Array.from({ length: 20 }, (_, index) => draft({ id: 'custom-' + index }));
  assert.equal(store.write(state(full, 'custom-0')).ok, true);
  const before = storage.raw;
  expectFailure(store.save(draft({ id: 'overflow' })));
  assert.equal(storage.raw, before);
  assert.equal(store.save(draft({ id: 'custom-0', name: '已编辑' })).ok, true);
  const selected = store.read().value;
  selected.customSkins.push(draft({ id: 'extra' }));
  expectFailure(store.write(selected));
  assert.equal(store.get('custom-0').value.name, '已编辑');
});

function element() {
  const styles = new Map(), attributes = new Map();
  return {
    styles, attributes,
    style: { getPropertyValue: name => styles.get(name)?.value || '', getPropertyPriority: name => styles.get(name)?.priority || '', setProperty(name, value, priority = '') { styles.set(name, { value, priority }); }, removeProperty: name => styles.delete(name) },
    getAttribute: name => attributes.get(name) ?? null, setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name),
  };
}
function documentFixture() {
  const app = element();
  return { documentElement: element(), body: element(), app, getElementById: id => id === 'app' ? app : null };
}

test('apply overrides html/body/app inheritance while invalid previews leave the DOM unchanged', () => {
  const document = documentFixture();
  document.body.style.setProperty('--ox-accent', '#287d6b');
  const result = Skins.apply(Skins.presets()[1], { document });
  assert.equal(result.ok, true);
  for (const element of [document.documentElement, document.body, document.app]) {
    assert.equal(element.style.getPropertyValue('--ox-accent'), result.value.tokens['--ox-accent']);
    assert.equal(element.style.getPropertyPriority('--el-color-primary'), 'important');
    assert.equal(element.style.getPropertyValue('--ox-skin-radius'), '14px');
    assert.equal(element.getAttribute('data-openxnet-skin'), 'brand-dark');
  }
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  expectFailure(Skins.apply(draft({ primary: 'var(--evil)' }), { document }));
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(document.body.style.getPropertyValue('--ox-accent'), result.value.tokens['--ox-accent']);
  Skins.apply(Skins.presets()[0], { document, setTheme: false });
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('DOM application failure rolls back already-applied tokens', () => {
  const document = documentFixture();
  document.documentElement.style.setProperty('--ox-accent', '#123456', 'important');
  document.documentElement.setAttribute('data-theme', 'old');
  let thrown = false;
  const original = document.body.style.setProperty;
  document.body.style.setProperty = function (name, value, priority) {
    if (!thrown) { thrown = true; throw new Error('DOM unavailable'); }
    return original.call(this, name, value, priority);
  };
  expectFailure(Skins.apply(draft(), { document }));
  assert.equal(document.documentElement.style.getPropertyValue('--ox-accent'), '#123456');
  assert.equal(document.documentElement.style.getPropertyPriority('--ox-accent'), 'important');
  assert.equal(document.documentElement.style.getPropertyValue('--ox-bg-base'), '');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'old');
});

test('browser UMD exposes the same API without accessing localStorage at script load', () => {
  const sandbox = { console };
  Object.defineProperty(sandbox, 'localStorage', { get() { throw new Error('blocked storage'); } });
  vm.runInNewContext(fs.readFileSync(require.resolve('../static/js/openxnet-skins.js'), 'utf8'), sandbox);
  assert.equal(typeof sandbox.OpenXnetSkins.createStore, 'function');
  assert.equal(sandbox.OpenXnetSkins.version, 1);
  assert.equal(sandbox.OpenXnetSkins.createStore().read().value.selectedId, 'brand-light');
});
