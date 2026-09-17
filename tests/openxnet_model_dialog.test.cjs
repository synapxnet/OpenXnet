const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bridgeModule = import('../frontend/model-vite/src/modelBridge.js');

async function withHost(host, run) {
  const previousWindow = global.window;
  global.window = { openxnetApp: host };
  try { await run((await bridgeModule).createModelBridge()); }
  finally { global.window = previousWindow; }
}

test('provider confirmation waits for persistence and only reports a completed addition', async () => {
  let complete;
  const saved = new Promise(resolve => { complete = resolve; });
  const host = {
    showAddDialog: true, newProviderTemp: { vendor: 'OpenAI' },
    async confirmAddProvider() { await saved; this.showAddDialog = false; },
  };
  await withHost(host, async bridge => {
    let settled = false;
    const pending = bridge.confirmAddDialog().then(result => { settled = true; return result; });
    await Promise.resolve();
    assert.equal(settled, false);
    complete();
    assert.equal(await pending, true);
  });
});

test('provider validation refusal does not report success', async () => {
  let calls = 0;
  const host = {
    showAddDialog: true, newProviderTemp: { vendor: '' },
    async confirmAddProvider() { calls++; },
  };
  await withHost(host, async bridge => {
    assert.equal(await bridge.confirmAddDialog(), false);
    assert.equal(calls, 0);
    host.newProviderTemp.vendor = 'OpenAI';
    assert.equal(await bridge.confirmAddDialog(), false);
    assert.equal(calls, 1);
  });
});

test('provider save failure restores the draft for retry', async () => {
  const draft = { vendor: 'OpenAI', url: 'http://localhost:1234/v1', apiKey: '', modelId: 'local-test' };
  const host = {
    showAddDialog: true, newProviderTemp: { ...draft },
    async confirmAddProvider() {
      this.newProviderTemp = { vendor: '', url: '', apiKey: '', modelId: '' };
      this.showAddDialog = false;
      throw new Error('Local storage unavailable');
    },
  };
  await withHost(host, async bridge => {
    await assert.rejects(bridge.confirmAddDialog(), /Local storage unavailable/);
    assert.deepEqual(host.newProviderTemp, draft);
    assert.equal(host.showAddDialog, true);
  });
});

test('every configured vendor icon resolves to a bundled image', () => {
  const root = path.resolve(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'static/js/vue_data.js'), 'utf8');
  const logoMap = source.match(/vendorLogoList:\s*\{([\s\S]*?)\n\s*\},/)[1];
  const files = [...logoMap.matchAll(/:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert(files.length >= 40);
  for (const file of files) assert(fs.existsSync(path.join(root, 'static', file)), `Missing vendor icon: ${file}`);
});
