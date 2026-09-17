(function installSkinWorkbench(global) {
  'use strict';
  const engine = global.OpenXnetSkins;
  if (!engine) return;
  let storage;
  if (global.openxnetAppearance) {
    storage = {
      getItem() {
        const result = global.openxnetAppearance.read();
        if (!result.ok) throw new Error(result.error);
        return result.value;
      },
      setItem(_key, serialized) {
        const result = global.openxnetAppearance.write(serialized);
        if (!result.ok) throw new Error(result.error);
      },
    };
    // Recover a skin saved on the current origin before native persistence existed.
    try {
      if (storage.getItem() === null) {
        const legacy = global.localStorage.getItem('openxnet.skins.v1');
        if (legacy) storage.setItem('openxnet.skins.v1', legacy);
      }
    } catch (_) { /* The store reports unavailable storage without overwriting it. */ }
  } else {
    try { storage = global.localStorage; } catch (_) { storage = null; }
  }
  const store = engine.createStore({ storage });
  const copy = value => JSON.parse(JSON.stringify(value));
  const readState = () => store.read().value;
  const current = () => store.get(readState().selectedId).value;
  let previewSkin = null;
  let wallpaperRequest = 0;

  // Skin preferences belong to this device and are separate from account settings.
  try {
    if (!storage?.getItem('openxnet.skins.v1')) {
      const oldTheme = global.localStorage.getItem('openxnet-theme');
      if (['dark', 'midnight', 'neon', 'ink', 'rainbow'].includes(oldTheme)) store.select('brand-dark');
    }
  } catch (_) { /* A readable default remains available when storage is blocked. */ }

  global.restoreOpenXnetSkin = function restoreOpenXnetSkin() {
    const skin = previewSkin || current();
    if (!skin) return false;
    const result = engine.apply(skin);
    if (result.ok) {
      global.dispatchEvent(new CustomEvent('openxnet-skin-applied', { detail: { mode: skin.mode, background: skin.background, primary: skin.primary } }));
    }
    return result.ok;
  };
  global.restoreOpenXnetSkin();
  document.addEventListener('DOMContentLoaded', global.restoreOpenXnetSkin, { once: true });

  function newId() { return 'user-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function namedVariant(name, suffix) {
    const letters = Array.from(name.trim());
    while (letters.join('').length + suffix.length > 48) letters.pop();
    return letters.join('').trimEnd() + suffix;
  }
  function modeId(id, mode) {
    if (id.length + mode.length + 1 <= 64) return id + '-' + mode;
    let hash = 2166136261;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return id.slice(0, 44) + '-' + (hash >>> 0).toString(16).padStart(8, '0') + '-' + mode;
  }
  function downloadSkin(text, name) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = (name || 'OpenXnet').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 64) + '.openxnet-skin.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  global.OpenXnetSkinWorkbench = {
    data() {
      return {
        skinStudioOpen: false,
        skinActive: copy(current()),
        skinDraft: copy(current()),
        skinItems: store.list().value || [],
        skinPreviewing: false,
        skinError: '',
        skinNotice: '',
        skinWarnings: [],
        skinBusy: false,
        skinAdvancedOpen: false,
      };
    },
    computed: {
      skinDraftChanged() { return JSON.stringify(this.skinDraft) !== JSON.stringify(this.skinActive); },
      skinDraftIsCustom() { return !engine.presets().some(skin => skin.id === this.skinDraft.id); },
    },
    watch: {
      skinStudioOpen(open) { if (!open) this.cancelSkinPreview(); },
    },
    mounted() { global.restoreOpenXnetSkin(); },
    methods: {
      getSkinLibrary() { return this.skinItems.map(copy); },
      getSkinCurrentSummary() { return copy(this.skinActive); },
      refreshSkinLibrary() {
        wallpaperRequest++;
        this.skinBusy = false;
        this.skinItems = store.list().value || [];
        this.skinActive = copy(current());
        this.skinDraft = copy(this.skinActive);
        this.skinPreviewing = false;
        previewSkin = null;
        global.restoreOpenXnetSkin();
      },
      openSkinStudio() {
        this.refreshSkinLibrary();
        this.skinError = '';
        this.skinNotice = '';
        this.skinWarnings = [];
        this.skinStudioOpen = true;
      },
      skinCardStyle(skin) {
        return {
          '--skin-preview-primary': skin.primary,
          '--skin-preview-bg': skin.background,
          '--skin-preview-surface': skin.surface,
          '--skin-preview-text': skin.text,
          '--skin-preview-radius': Math.min(12, skin.radius) + 'px',
        };
      },
      activateSkin(id) {
        const result = store.select(id);
        if (!result.ok) { this.skinError = result.error; return false; }
        this.refreshSkinLibrary();
        this.skinWarnings = result.warnings || [];
        this.skinError = '';
        this.skinNotice = this.isCurrentLanguageZh() ? '已应用并保存到此设备' : 'Applied and saved on this device';
        return true;
      },
      previewSkinDraft() {
        this.skinNotice = '';
        const candidate = { ...copy(this.skinDraft), name: this.skinDraft.name.trim() || this.skinActive.name };
        const result = engine.apply(candidate);
        if (!result.ok) { this.skinError = result.error; return; }
        previewSkin = candidate;
        this.skinPreviewing = true;
        this.skinError = '';
        this.skinWarnings = result.warnings || [];
        global.dispatchEvent(new CustomEvent('openxnet-skin-applied', { detail: { mode: candidate.mode, background: candidate.background, primary: candidate.primary } }));
      },
      setSkinDraftMode(mode) {
        if (mode === this.skinDraft.mode) return;
        const palette = engine.presets().find(skin => skin.id === 'brand-' + mode);
        if (!palette) return;
        Object.assign(this.skinDraft, { mode, background: palette.background, surface: palette.surface, text: palette.text });
        this.previewSkinDraft();
      },
      cancelSkinPreview() {
        wallpaperRequest++;
        this.skinBusy = false;
        previewSkin = null;
        this.skinPreviewing = false;
        this.skinDraft = copy(this.skinActive);
        this.skinWarnings = [];
        this.skinError = '';
        global.restoreOpenXnetSkin();
      },
      saveSkinDraft(asCopy = false) {
        if (!this.skinDraft.name.trim()) {
          this.skinError = this.isCurrentLanguageZh() ? '请为皮肤起一个名字' : 'Give your skin a name';
          return;
        }
        const skin = copy(this.skinDraft);
        const builtIn = engine.presets().some(item => item.id === skin.id);
        if (builtIn || asCopy) {
          skin.id = newId();
          if (asCopy || skin.name === this.skinActive.name) skin.name = namedVariant(skin.name, this.isCurrentLanguageZh() ? ' · 我的版本' : ' · My version');
        }
        const result = store.save(skin);
        if (!result.ok) { this.skinError = result.error; return; }
        this.refreshSkinLibrary();
        this.skinError = '';
        this.skinWarnings = result.warnings || [];
        this.skinNotice = this.isCurrentLanguageZh() ? '皮肤已保存，重新打开也会保留' : 'Skin saved and restored on your next launch';
      },
      removeCurrentSkin() {
        if (!this.skinDraftIsCustom || this.skinDraftChanged) return;
        const result = store.remove(this.skinActive.id);
        if (!result.ok) { this.skinError = result.error; return; }
        this.refreshSkinLibrary();
        this.skinError = '';
        this.skinNotice = this.isCurrentLanguageZh() ? '已删除自定义皮肤，恢复品牌皮肤' : 'Custom skin removed; brand skin restored';
      },
      exportCurrentSkin() {
        const result = store.export(this.skinActive.id);
        if (!result.ok) { this.skinError = result.error; return; }
        downloadSkin(result.value, this.skinActive.name);
        this.skinNotice = this.isCurrentLanguageZh() ? '已导出当前保存的皮肤' : 'Exported the saved skin';
      },
      async importSkinFile(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        this.skinError = '';
        this.skinBusy = true;
        try {
          if (file.size > 2 * 1024 * 1024) throw new Error(this.isCurrentLanguageZh() ? '皮肤文件不能超过 2 MB' : 'Skin files must be 2 MB or smaller');
          const result = store.import(await file.text());
          if (!result.ok) throw new Error(result.error);
          this.refreshSkinLibrary();
          this.skinWarnings = result.warnings || [];
          this.skinNotice = this.isCurrentLanguageZh() ? '皮肤已导入并应用' : 'Skin imported and applied';
        } catch (error) { this.skinError = error.message; }
        finally { this.skinBusy = false; }
      },
      async uploadSkinWallpaper(event) {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        const request = ++wallpaperRequest;
        this.skinError = '';
        this.skinBusy = true;
        let url;
        try {
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 12 * 1024 * 1024) {
            throw new Error(this.isCurrentLanguageZh() ? '请选择 12 MB 以内的 PNG、JPG 或 WebP 图片' : 'Choose a PNG, JPG or WebP image under 12 MB');
          }
          url = URL.createObjectURL(file);
          const image = new Image();
          image.src = url;
          await image.decode();
          if (request !== wallpaperRequest || !this.skinStudioOpen) return;
          if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 60000000) throw new Error('图片尺寸过大，请选择较小的图片');
          const scale = Math.min(1, 1920 / image.naturalWidth, 1200 / image.naturalHeight);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const wallpaper = canvas.toDataURL('image/webp', 0.82);
          const candidate = { ...copy(this.skinDraft), wallpaper, wallpaperOpacity: this.skinDraft.wallpaperOpacity || 0.24 };
          const validation = engine.validate(candidate);
          if (!validation.ok) throw new Error(validation.error);
          Object.assign(this.skinDraft, { wallpaper, wallpaperOpacity: candidate.wallpaperOpacity });
          this.previewSkinDraft();
        } catch (error) { if (request === wallpaperRequest && this.skinStudioOpen) this.skinError = error.message || '无法读取图片，请重试'; }
        finally { if (url) URL.revokeObjectURL(url); if (request === wallpaperRequest) this.skinBusy = false; }
      },
      removeSkinWallpaper() { this.skinDraft.wallpaper = null; this.previewSkinDraft(); },
      getPrototypeThemeMode() { return (this.skinPreviewing ? this.skinDraft : this.skinActive)?.mode || 'light'; },
      async togglePrototypeThemeMode() {
        if (this.skinStudioOpen && this.skinDraftChanged) {
          this.setSkinDraftMode(this.getPrototypeThemeMode() === 'dark' ? 'light' : 'dark');
          return;
        }
        const mode = this.getPrototypeThemeMode() === 'dark' ? 'light' : 'dark';
        const preset = engine.presets().find(skin => skin.id === 'brand-' + mode);
        if (engine.presets().some(skin => skin.id === this.skinActive.id)) { this.activateSkin(preset.id); return; }
        const origin = this.skinItems.find(skin => skin.id !== this.skinActive.id && modeId(skin.id, this.skinActive.mode) === this.skinActive.id) || this.skinActive;
        const id = modeId(origin.id, mode);
        const existing = origin.mode === mode ? store.get(origin.id) : store.get(id);
        const result = existing.ok ? store.save({
          ...existing.value, primary: this.skinActive.primary, wallpaper: this.skinActive.wallpaper,
          radius: this.skinActive.radius, density: this.skinActive.density,
          wallpaperOpacity: this.skinActive.wallpaperOpacity, surfaceOpacity: this.skinActive.surfaceOpacity,
        }) : store.save({
          ...copy(this.skinActive), id, mode, background: preset.background, surface: preset.surface, text: preset.text,
          name: namedVariant(this.skinActive.name.replace(/ · (深色|浅色|Dark|Light)$/, ''), ' · ' + (mode === 'dark' ? '深色' : '浅色')),
        });
        if (!result.ok) { this.skinError = result.error; return; }
        this.refreshSkinLibrary();
      },
      async handleThemeChange(value) {
        const dark = ['dark', 'midnight', 'neon', 'ink', 'rainbow'].includes(value);
        const base = engine.presets().find(skin => skin.id === 'brand-' + (dark ? 'dark' : 'light'));
        if (['party', 'light', 'dark'].includes(value)) { this.activateSkin(base.id); return; }
        const colors = { midnight: '#4e9cfa', desert: '#bb763d', neon: '#e35ba0', marshmallow: '#b3659c', ink: '#819ab3', rainbow: '#9273db' };
        const result = store.save({ ...base, id: 'classic-' + value, primary: colors[value] || base.primary, name: this.getPrototypeThemeLabel(value) });
        if (!result.ok) { this.skinError = result.error; return; }
        this.refreshSkinLibrary();
      },
    },
  };
})(window);
