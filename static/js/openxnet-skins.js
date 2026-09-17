/* Local, data-only OpenXnet skins. No network, backend, eval, or arbitrary CSS. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(root);
  else root.OpenXnetSkins = factory(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const VERSION = 1;
  const STORAGE_KEY = 'openxnet.skins.v1';
  const LIMITS = Object.freeze({ customSkins: 20, wallpaperBytes: 1024 * 1024, imageDimension: 4096, libraryCharacters: 2 * 1024 * 1024, importCharacters: 1500000 });
  const FIELDS = new Set(['id', 'name', 'mode', 'primary', 'background', 'surface', 'text', 'radius', 'density', 'wallpaper', 'wallpaperOpacity', 'surfaceOpacity']);
  const PALETTE = [
    { id: 'brand-light', name: 'OpenXnet · 澄空', mode: 'light', primary: '#009fdf', background: '#f2f7fb', surface: '#ffffff', text: '#163047' },
    { id: 'brand-dark', name: 'OpenXnet · 深海', mode: 'dark', primary: '#24c7df', background: '#0e1925', surface: '#152536', text: '#e6f2fa' },
    { id: 'mist', name: '晨雾', mode: 'light', primary: '#008bbd', background: '#edf6f8', surface: '#f8fcfd', text: '#183940' },
    { id: 'ocean', name: '海湾', mode: 'light', primary: '#1578d0', background: '#edf3fc', surface: '#fafcff', text: '#203550' },
    { id: 'ink', name: '夜航', mode: 'dark', primary: '#699df5', background: '#141b2b', surface: '#1e293e', text: '#e7efff' },
  ].map(skin => Object.freeze({ ...skin, radius: 14, density: 'comfortable', wallpaper: null, wallpaperOpacity: 0.18, surfaceOpacity: 0.96 }));
  const clone = value => JSON.parse(JSON.stringify(value));
  const ok = (value, warnings = []) => ({ ok: true, value: clone(value), warnings: [...new Set(warnings)] });
  const fail = error => ({ ok: false, error });
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const presetById = id => PALETTE.find(skin => skin.id === id);
  const defaultState = () => ({ version: VERSION, selectedId: 'brand-light', customSkins: [] });
  const error = message => { throw new Error(message); };

  function color(value, label) {
    if (typeof value !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) error(label + '必须是 #RGB 或 #RRGGBB 颜色。');
    const hex = value.slice(1).toLowerCase();
    return '#' + (hex.length === 3 ? [...hex].map(letter => letter + letter).join('') : hex);
  }
  const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const hex = values => '#' + values.map(value => Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, '0')).join('');
  const mix = (first, second, fraction) => hex(rgb(first).map((value, index) => value * (1 - fraction) + rgb(second)[index] * fraction));
  const rgba = (value, opacity) => 'rgba(' + rgb(value).join(', ') + ', ' + opacity + ')';
  function luminance(value) {
    return rgb(value).map(channel => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  }
  function ratio(first, second) {
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }
  function readable(preferred, backgrounds, minimum = 4.5) {
    const meets = candidate => backgrounds.every(background => ratio(candidate, background) >= minimum);
    if (meets(preferred)) return preferred;
    let best = null, distance = Infinity;
    const origin = rgb(preferred);
    const consider = candidate => {
      if (!meets(candidate)) return;
      const delta = rgb(candidate).reduce((sum, value, index) => sum + Math.pow(value - origin[index], 2), 0);
      if (delta < distance) { best = candidate; distance = delta; }
    };
    for (let step = 0; step <= 255; step++) {
      consider(mix(preferred, '#000000', step / 255));
      consider(mix(preferred, '#ffffff', step / 255));
      consider(hex([step, step, step]));
    }
    return best;
  }

  function decodeBase64(encoded) {
    if (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function') return Uint8Array.from(Buffer.from(encoded, 'base64'));
    if (typeof root.atob !== 'function') error('当前环境无法读取本地壁纸。');
    try { return Uint8Array.from(root.atob(encoded), character => character.charCodeAt(0)); }
    catch (_) { error('壁纸的 Base64 内容无效。'); }
  }
  function wallpaper(value) {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') error('壁纸必须是本地 PNG、JPEG 或 WebP 图片。');
    if (value.length > Math.ceil(LIMITS.wallpaperBytes / 3) * 4 + 40) error('壁纸不能超过 1 MiB，请缩小图片后重试。');
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match || match[2].length % 4 !== 0) error('只支持本地 PNG、JPEG 或 WebP 壁纸，不支持外部地址或 SVG。');
    const bytes = decodeBase64(match[2]);
    if (bytes.length > LIMITS.wallpaperBytes) error('壁纸不能超过 1 MiB，请缩小图片后重试。');
    const be32 = offset => (bytes[offset] * 16777216 + bytes[offset + 1] * 65536 + bytes[offset + 2] * 256 + bytes[offset + 3]);
    const le32 = offset => (bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536 + bytes[offset + 3] * 16777216);
    const ascii = (offset, text) => [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
    let width = 0, height = 0;
    if (match[1] === 'png') {
      if (bytes.length < 45 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) || be32(8) !== 13 || !ascii(12, 'IHDR') || !ascii(bytes.length - 8, 'IEND')) error('PNG 壁纸文件不完整或格式不正确。');
      width = be32(16); height = be32(20);
      let cursor = 8, hasPixels = false, ended = false;
      while (cursor + 12 <= bytes.length) {
        const size = be32(cursor);
        if (cursor + size + 12 > bytes.length) error('PNG 壁纸数据不完整。');
        if (ascii(cursor + 4, 'IDAT') && size > 0) hasPixels = true;
        if (ascii(cursor + 4, 'IEND')) { ended = size === 0 && cursor + 12 === bytes.length; break; }
        cursor += size + 12;
      }
      if (!hasPixels || !ended) error('PNG 壁纸缺少完整图像数据。');
    } else if (match[1] === 'jpeg') {
      if (bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) error('JPEG 壁纸文件不完整或格式不正确。');
      let cursor = 2, hasScan = false;
      while (cursor < bytes.length - 1) {
        if (bytes[cursor++] !== 255) error('JPEG 壁纸数据无效。');
        while (bytes[cursor] === 255) cursor++;
        const marker = bytes[cursor++];
        if (marker === 218) { hasScan = cursor + 4 < bytes.length; break; }
        if (marker === 217) break;
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        const size = bytes[cursor] * 256 + bytes[cursor + 1];
        if (!Number.isFinite(size) || size < 2 || cursor + size > bytes.length) error('JPEG 壁纸数据无效。');
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
          if (size < 7) error('JPEG 壁纸尺寸无效。');
          height = bytes[cursor + 3] * 256 + bytes[cursor + 4];
          width = bytes[cursor + 5] * 256 + bytes[cursor + 6];
        }
        cursor += size;
      }
      if (!hasScan) error('JPEG 壁纸缺少图像扫描数据。');
    } else {
      if (bytes.length < 25 || !ascii(0, 'RIFF') || !ascii(8, 'WEBP') || le32(4) + 8 !== bytes.length) error('WebP 壁纸文件不完整或格式不正确。');
      if (ascii(12, 'VP8X') && bytes.length >= 30) {
        width = 1 + bytes[24] + bytes[25] * 256 + bytes[26] * 65536;
        height = 1 + bytes[27] + bytes[28] * 256 + bytes[29] * 65536;
      } else if (ascii(12, 'VP8L') && bytes[20] === 47) {
        width = 1 + bytes[21] + ((bytes[22] & 63) << 8);
        height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10);
      } else if (ascii(12, 'VP8 ') && bytes.length >= 30 && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
        width = (bytes[26] + bytes[27] * 256) & 16383;
        height = (bytes[28] + bytes[29] * 256) & 16383;
      }
      let cursor = 12, hasPixels = false;
      while (cursor + 8 <= bytes.length) {
        const size = le32(cursor + 4);
        if (cursor + size + 8 > bytes.length) error('WebP 壁纸数据不完整。');
        if ((ascii(cursor, 'VP8 ') || ascii(cursor, 'VP8L')) && size > 5) hasPixels = true;
        cursor += size + 8 + (size % 2);
      }
      if (!hasPixels || cursor !== bytes.length) error('WebP 壁纸缺少完整的静态图像数据。');
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > LIMITS.imageDimension || height > LIMITS.imageDimension) error('壁纸尺寸无效，最长边不能超过 4096 像素。');
    return value;
  }

  function normalize(input) {
    if (!plain(input)) error('皮肤必须是一个有效的数据对象。');
    if (Object.keys(input).some(key => !FIELDS.has(key))) error('皮肤包含不支持的字段；不允许 CSS、脚本或外部资源配置。');
    if (input.id !== undefined && (typeof input.id !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(input.id))) error('皮肤标识无效。');
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 48 || /[\u0000-\u001f\u007f<>]/.test(input.name)) error('皮肤名称需为 1–48 个字符，不能包含控制字符或尖括号。');
    if (!['light', 'dark'].includes(input.mode)) error('皮肤明暗模式必须是 light 或 dark。');
    if (!Number.isInteger(input.radius) || input.radius < 0 || input.radius > 24) error('圆角必须是 0–24 之间的整数。');
    if (!['compact', 'comfortable'].includes(input.density)) error('界面密度必须为 compact 或 comfortable。');
    const imageOpacity = input.wallpaperOpacity === undefined ? 0.18 : input.wallpaperOpacity;
    const panelOpacity = input.surfaceOpacity === undefined ? 0.96 : input.surfaceOpacity;
    if (typeof imageOpacity !== 'number' || !Number.isFinite(imageOpacity) || imageOpacity < 0 || imageOpacity > 0.45) error('壁纸强度必须在 0–0.45 之间。');
    if (typeof panelOpacity !== 'number' || !Number.isFinite(panelOpacity) || panelOpacity < 0.82 || panelOpacity > 1) error('面板不透明度必须在 0.82–1 之间。');
    return {
      ...(input.id === undefined ? {} : { id: input.id }), name: input.name.trim(), mode: input.mode,
      primary: color(input.primary, '主色'), background: color(input.background, '背景色'), surface: color(input.surface, '面板色'), text: color(input.text, '文字色'),
      radius: input.radius, density: input.density, wallpaper: wallpaper(input.wallpaper === undefined ? null : input.wallpaper), wallpaperOpacity: imageOpacity, surfaceOpacity: panelOpacity,
    };
  }
  function validate(input) {
    try { return ok(normalize(input)); } catch (cause) { return fail(cause.message); }
  }

  function compile(skin) {
    const warnings = [];
    const dark = skin.mode === 'dark';
    const base = skin.background;
    let surface = skin.surface;
    let foreground = readable(skin.text, [base, surface]);
    // Incompatible custom backgrounds need a small surface correction before a
    // single inherited foreground can stay readable on both surfaces.
    if (!foreground) {
      foreground = readable(skin.text, [base]);
      for (let step = 1; step <= 100; step++) {
        surface = mix(skin.surface, base, step / 100);
        if (ratio(foreground, surface) >= 4.8) break;
      }
      warnings.push('背景与面板明暗差异较大，预览已微调面板色以保证文字可读。');
    }
    let hover = mix(surface, foreground, 0.035);
    let soft = mix(surface, skin.primary, 0.055);
    let surfaces = [base, surface, hover, soft];
    let text = readable(skin.text, surfaces);
    if (!text) {
      hover = surface; soft = surface; surfaces = [base, surface];
      text = readable(foreground, surfaces);
    }
    if (!text) error('背景色与面板色无法生成可读的文字，请缩小两者的明暗差异。');
    let imageOpacity = skin.wallpaper ? skin.wallpaperOpacity : 0;
    let panelOpacity = skin.surfaceOpacity;
    const solidSurfaces = [...surfaces];
    const compositedSurfaces = () => {
      const canvas = [mix(base, '#000000', imageOpacity), mix(base, '#ffffff', imageOpacity)];
      const panels = canvas.map(behind => mix(behind, surface, panelOpacity));
      return { canvas, panels, all: [...solidSurfaces, ...canvas, ...panels] };
    };
    let composited = compositedSurfaces();
    let decoratedText = readable(skin.text, composited.all);
    while (!decoratedText && imageOpacity > 0) {
      imageOpacity = Math.max(0, Math.round((imageOpacity - 0.01) * 1000) / 1000);
      composited = compositedSurfaces(); decoratedText = readable(skin.text, composited.all);
    }
    while (!decoratedText && panelOpacity < 1) {
      panelOpacity = Math.min(1, Math.round((panelOpacity + 0.01) * 1000) / 1000);
      composited = compositedSurfaces(); decoratedText = readable(skin.text, composited.all);
    }
    if (!decoratedText) error('当前透明效果无法保证文字可读，请调整背景与面板色。');
    text = decoratedText; surfaces = composited.all;
    if (skin.wallpaper && imageOpacity !== skin.wallpaperOpacity) warnings.push('壁纸显示强度已适当降低，以保证不同图片区域的文字清晰。');
    if (panelOpacity !== skin.surfaceOpacity) warnings.push('面板透明度已适当降低，以保证正文清晰。');
    const secondary = readable(mix(text, surface, 0.25), surfaces) || text;
    const muted = readable(mix(text, surface, 0.4), surfaces) || secondary;
    const accent = readable(skin.primary, surfaces) || text;
    const onAccent = ratio('#ffffff', accent) >= ratio('#000000', accent) ? '#ffffff' : '#000000';
    const accentHover = mix(accent, onAccent === '#ffffff' ? '#000000' : '#ffffff', 0.1);
    if (text !== skin.text) warnings.push('文字色已自动调整，以确保正文对比度达到 4.5:1。');
    if (accent !== skin.primary) warnings.push('交互主色已调整为更易辨认的同色系，品牌原色仍保留。');
    const border = mix(surface, text, 0.15), borderHover = mix(surface, text, 0.28);
    const shadowColor = dark ? '0, 8, 20' : '25, 66, 99';
    const radius = skin.radius, spacing = skin.density === 'compact' ? 0.85 : 1;
    const tokens = {
      '--ox-brand-primary': skin.primary, '--ox-brand-secondary': '#16dfe3',
      '--ox-accent': accent, '--ox-accent-rgb': rgb(accent).join(', '), '--ox-accent-hover': accentHover, '--ox-accent-active': accentHover,
      '--ox-accent-soft': soft, '--ox-accent-softer': mix(surface, skin.primary, 0.03), '--ox-accent-light': soft,
      '--ox-accent-gradient': 'linear-gradient(135deg, ' + accent + ', ' + accentHover + ')', '--ox-accent-gradient-hover': 'linear-gradient(135deg, ' + accentHover + ', ' + accent + ')',
      '--ox-on-accent': onAccent, '--ox-bg-base': base, '--ox-bg-surface': surface, '--ox-bg-surface-hover': hover, '--ox-bg-surface-active': soft,
      '--ox-bg-sidebar': surface, '--ox-bg-sidebar-hover': hover, '--ox-bg-sidebar-active': soft, '--ox-bg-header-soft': soft,
      '--ox-bg-input': surface, '--ox-bg-input-hover': hover, '--ox-bg-topbar': surface, '--ox-bg-overlay': dark ? 'rgba(0, 5, 14, 0.65)' : 'rgba(16, 40, 60, 0.36)', '--ox-bg-tooltip': text,
      '--ox-text-primary': text, '--ox-text-secondary': secondary, '--ox-text-muted': muted, '--ox-text-disabled': mix(text, surface, 0.55), '--ox-text-inverse': surface,
      '--ox-text-accent': accent, '--ox-text-link': accent, '--ox-border': border, '--ox-border-hover': borderHover, '--ox-border-strong': borderHover, '--ox-border-accent': accent,
      '--ox-bg-1': surface, '--ox-bg-2': hover, '--ox-bg-3': soft, '--ox-text-1': text, '--ox-text-2': secondary, '--ox-text-3': muted,
      '--ox-skin-radius': radius + 'px', '--ox-skin-spacing': String(spacing), '--ox-density': String(spacing),
      '--ox-skin-wallpaper': skin.wallpaper ? 'url("' + skin.wallpaper + '")' : 'none', '--ox-skin-wallpaper-opacity': String(imageOpacity), '--ox-skin-surface-opacity': String(panelOpacity),
      '--ox-radius-xs': Math.round(radius * 0.35) + 'px', '--ox-radius-sm': Math.round(radius * 0.6) + 'px', '--ox-radius-md': Math.round(radius * 0.8) + 'px', '--ox-radius-lg': radius + 'px', '--ox-radius-card': radius + 'px', '--ox-radius-xl': Math.round(radius * 1.25) + 'px', '--ox-radius-2xl': Math.round(radius * 1.5) + 'px', '--ox-radius-full': '9999px',
      '--ox-shadow-xs': '0 1px 2px rgba(' + shadowColor + ', 0.025)', '--ox-shadow-sm': '0 2px 8px rgba(' + shadowColor + ', 0.04)', '--ox-shadow-md': '0 8px 24px rgba(' + shadowColor + ', 0.065)',
      '--ox-shadow-lg': '0 12px 36px rgba(' + shadowColor + ', 0.10)', '--ox-shadow-xl': '0 20px 56px rgba(' + shadowColor + ', 0.14)', '--ox-shadow-card': '0 4px 16px rgba(' + shadowColor + ', 0.045)', '--ox-shadow-card-hover': '0 6px 20px rgba(' + shadowColor + ', 0.075)',
      '--ox-shadow-glow': '0 0 0 3px ' + rgba(accent, 0.16), '--ox-shadow-glow-lg': '0 0 0 4px ' + rgba(accent, 0.18), '--ox-shadow-inner': 'inset 0 1px 2px rgba(' + shadowColor + ', 0.05)',
      '--ox-runtime-panel-gradient': surface, '--ox-runtime-hero-gradient': surface,
      '--el-color-primary': accent, '--el-color-primary-rgb': rgb(accent).join(', '), '--el-color-primary-dark-2': accentHover,
      '--el-bg-color': surface, '--el-bg-color-page': base, '--el-bg-color-overlay': surface, '--el-text-color-primary': text, '--el-text-color-regular': text,
      '--el-text-color-secondary': secondary, '--el-text-color-placeholder': muted, '--el-text-color-disabled': mix(text, surface, 0.55),
      '--el-border-color': border, '--el-border-color-light': border, '--el-border-color-lighter': mix(surface, text, 0.1), '--el-border-color-extra-light': mix(surface, text, 0.07), '--el-border-color-dark': borderHover, '--el-border-color-darker': borderHover,
      '--el-fill-color': hover, '--el-fill-color-light': hover, '--el-fill-color-lighter': hover, '--el-fill-color-extra-light': surface, '--el-fill-color-dark': soft, '--el-fill-color-darker': soft, '--el-fill-color-blank': surface,
      '--el-mask-color': rgba(base, 0.85), '--el-mask-color-extra-light': rgba(base, 0.6), '--el-overlay-color': dark ? 'rgba(0,0,0,0.8)' : 'rgba(16,40,60,0.6)', '--el-overlay-color-light': 'rgba(0,0,0,0.5)', '--el-overlay-color-lighter': 'rgba(0,0,0,0.35)',
      '--el-border-radius-base': Math.round(radius * 0.6) + 'px', '--el-border-radius-small': Math.round(radius * 0.35) + 'px', '--el-box-shadow': '0 8px 24px rgba(' + shadowColor + ', 0.1)', '--el-box-shadow-light': '0 4px 16px rgba(' + shadowColor + ', 0.065)', '--el-box-shadow-lighter': '0 2px 8px rgba(' + shadowColor + ', 0.04)', '--el-box-shadow-dark': '0 16px 48px rgba(' + shadowColor + ', 0.18)',
    };
    for (const level of [3, 5, 7, 8, 9]) tokens['--el-color-primary-light-' + level] = mix(accent, surface, level / 10);
    for (const [kind, preferred] of Object.entries({ success: '#19875c', warning: '#b67910', danger: '#c44555', info: '#3579ae' })) {
      const semantic = readable(preferred, surfaces) || text;
      tokens['--ox-' + kind] = semantic; tokens['--ox-' + kind + '-soft'] = mix(surface, preferred, 0.08);
      tokens['--el-color-' + kind] = semantic; tokens['--el-color-' + kind + '-rgb'] = rgb(semantic).join(', ');
      for (const level of [3, 5, 7, 8, 9]) tokens['--el-color-' + kind + '-light-' + level] = mix(semantic, surface, level / 10);
      tokens['--el-color-' + kind + '-dark-2'] = mix(semantic, dark ? '#ffffff' : '#000000', 0.1);
    }
    tokens['--ox-error'] = tokens['--ox-danger']; tokens['--ox-error-soft'] = tokens['--ox-danger-soft'];
    for (const step of [1, 2, 3, 4, 5, 6, 8, 10, 12, 16]) tokens['--ox-space-' + step] = Math.round(step * 4 * spacing) + 'px';
    const aliases = {
      '--ox-vite-shell-bg': base, '--ox-vite-surface': surface, '--ox-vite-surface-subtle': hover, '--ox-vite-input-bg': surface, '--ox-vite-input-bg-hover': hover,
      '--ox-vite-border': border, '--ox-vite-border-strong': borderHover, '--ox-vite-text-primary': text, '--ox-vite-text-secondary': secondary, '--ox-vite-text-muted': muted, '--ox-vite-accent-soft': soft,
      '--ox-vite-shadow-card': tokens['--ox-shadow-card'], '--ox-vite-shadow-panel': tokens['--ox-shadow-sm'],
      '--bg-color': base, '--background-color': base, '--card-bg': surface, '--text-color': text, '--text-primary': text, '--text-secondary': secondary, '--border-color': border, '--primary-color': accent,
    };
    return ok({ skin, tokens: { ...tokens, ...aliases }, contrast: {
      textOnBackground: ratio(text, base), textOnSurface: ratio(text, surface), secondaryOnSurface: ratio(secondary, surface), mutedOnSurface: ratio(muted, surface),
      accentOnSurface: ratio(accent, surface), onAccent: ratio(onAccent, accent), onAccentHover: ratio(onAccent, accentHover),
      textOnWallpaper: Math.min(...composited.canvas.map(background => ratio(text, background))), textOnTranslucentSurface: Math.min(...composited.panels.map(background => ratio(text, background))),
    } }, warnings);
  }
  function preview(input) {
    try { return compile(normalize(input)); } catch (cause) { return fail(cause.message); }
  }

  function apply(input, options = {}) {
    const result = preview(input);
    if (!result.ok) return result;
    const document = options.document || root.document;
    if (!document || !document.documentElement) return fail('当前环境没有可应用皮肤的界面。');
    const elements = [...new Set([document.documentElement, document.body, document.getElementById('app')].filter(Boolean))];
    const changes = [];
    try {
      for (const element of elements) {
        for (const [name, value] of Object.entries(result.value.tokens)) {
          changes.push({ element, name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) });
          element.style.setProperty(name, value, 'important');
        }
        changes.push({ element, name: 'color-scheme', value: element.style.getPropertyValue('color-scheme'), priority: element.style.getPropertyPriority('color-scheme') });
        element.style.setProperty('color-scheme', result.value.skin.mode);
        for (const [name, value] of Object.entries({ 'data-openxnet-skin': result.value.skin.id || 'preview', 'data-skin-mode': result.value.skin.mode })) {
          changes.push({ element, attribute: name, value: element.getAttribute(name) });
          element.setAttribute(name, value);
        }
      }
      if (options.setTheme !== false) {
        changes.push({ element: document.documentElement, attribute: 'data-theme', value: document.documentElement.getAttribute('data-theme') });
        document.documentElement.setAttribute('data-theme', result.value.skin.mode);
      }
      return result;
    } catch (_) {
      for (const change of changes.reverse()) {
        try {
          if (change.attribute) {
            if (change.value === null) change.element.removeAttribute(change.attribute);
            else change.element.setAttribute(change.attribute, change.value);
          } else if (change.value) change.element.style.setProperty(change.name, change.value, change.priority);
          else change.element.style.removeProperty(change.name);
        } catch (_) { /* Best effort if the host DOM itself is unavailable. */ }
      }
      return fail('无法应用皮肤，已恢复之前的界面设置。');
    }
  }

  function validateState(input, recover = false) {
    if (!plain(input) || input.version !== VERSION || !Array.isArray(input.customSkins) || Object.keys(input).some(key => !['version', 'selectedId', 'customSkins'].includes(key))) error('本地皮肤库格式或版本不受支持。');
    if (input.customSkins.length > LIMITS.customSkins) error('最多可保存 20 个自定义皮肤。');
    const warnings = [], skins = [], ids = new Set();
    for (const candidate of input.customSkins) {
      try {
        const skin = normalize(candidate);
        if (!skin.id || presetById(skin.id) || ids.has(skin.id)) error('自定义皮肤标识缺失或重复。');
        ids.add(skin.id); skins.push(skin);
      } catch (cause) {
        if (!recover) throw cause;
        warnings.push('已跳过损坏的自定义皮肤；原始保存内容未被改写。');
      }
    }
    let selectedId = input.selectedId;
    if (!presetById(selectedId) && !ids.has(selectedId)) {
      if (!recover) error('所选皮肤不存在，请重新选择。');
      selectedId = 'brand-light'; warnings.push('原先选择的皮肤不可用，已恢复 OpenXnet 默认皮肤。');
    }
    return { state: { version: VERSION, selectedId, customSkins: skins }, warnings };
  }

  function createStore(options = {}) {
    let storage = null, state = defaultState(), accessFailed = false;
    try { storage = options.storage === undefined ? root.localStorage : options.storage; } catch (_) { /* Getter can throw in blocked contexts. */ }
    function read() {
      accessFailed = false;
      try {
        if (!storage || typeof storage.getItem !== 'function') error('storage unavailable');
        const raw = storage.getItem(STORAGE_KEY);
        if (raw === null || raw === '') { state = defaultState(); return ok(state); }
        if (typeof raw !== 'string' || raw.length > LIMITS.libraryCharacters) return ok(state, ['本地皮肤库过大或无效，已保留上次可用状态。']);
        try {
          const recovered = validateState(JSON.parse(raw), true);
          state = recovered.state;
          return ok(state, recovered.warnings);
        } catch (_) { return ok(state, ['无法读取本地皮肤库，已保留上次可用状态；原始内容未被改写。']); }
      } catch (_) { accessFailed = true; return ok(state, ['本地存储不可用，当前皮肤仍可预览，但暂时无法保存。']); }
    }
    function write(candidate) {
      try {
        const next = validateState(candidate).state;
        const serialized = JSON.stringify(next);
        if (serialized.length > LIMITS.libraryCharacters) return fail('皮肤库空间不足，请删除不用的皮肤或缩小壁纸。');
        if (!storage || typeof storage.setItem !== 'function') return fail('本地存储不可用，无法保存皮肤。');
        storage.setItem(STORAGE_KEY, serialized);
        state = next;
        return ok(state);
      } catch (cause) {
        if (cause && /皮肤|圆角|壁纸|面板|背景|主色|文字|密度|不透明|CSS/.test(cause.message)) return fail(cause.message);
        return fail('皮肤保存失败，可能是存储空间不足或浏览器限制；之前的皮肤未被更改。');
      }
    }
    function current() { const snapshot = read(); return accessFailed ? fail('无法读取本地皮肤库，请恢复存储访问后重试；已有内容未被覆盖。') : snapshot; }
    function newId() {
      const seed = root.crypto && typeof root.crypto.randomUUID === 'function' ? root.crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      return 'custom-' + seed.toLowerCase();
    }
    function save(input, forceNew = false) {
      const snapshot = current(); if (!snapshot.ok) return snapshot;
      const checked = preview(input); if (!checked.ok) return checked;
      const skin = checked.value.skin;
      if (!skin.id || presetById(skin.id) || forceNew) skin.id = newId();
      const next = snapshot.value, index = next.customSkins.findIndex(item => item.id === skin.id);
      if (index >= 0) next.customSkins[index] = skin;
      else next.customSkins.push(skin);
      next.selectedId = skin.id;
      const result = write(next);
      if (result.ok) result.warnings = [...new Set([...snapshot.warnings, ...checked.warnings])];
      return result;
    }
    function select(id) {
      const snapshot = current(); if (!snapshot.ok) return snapshot;
      if (!presetById(id) && !snapshot.value.customSkins.some(skin => skin.id === id)) return fail('所选皮肤不存在。');
      return write({ ...snapshot.value, selectedId: id });
    }
    function remove(id) {
      const snapshot = current(); if (!snapshot.ok) return snapshot;
      if (presetById(id)) return fail('内置皮肤不能删除，可以另存为自定义皮肤。');
      const found = snapshot.value.customSkins.find(skin => skin.id === id);
      if (!found) return fail('要删除的皮肤不存在。');
      const next = snapshot.value;
      next.customSkins = next.customSkins.filter(skin => skin.id !== id);
      if (next.selectedId === id) next.selectedId = found.mode === 'dark' ? 'brand-dark' : 'brand-light';
      return write(next);
    }
    function get(id) {
      const snapshot = read();
      const found = presetById(id || snapshot.value.selectedId) || snapshot.value.customSkins.find(skin => skin.id === (id || snapshot.value.selectedId));
      return found ? ok(found, snapshot.warnings) : fail('所选皮肤不存在。');
    }
    function importSkin(json) {
      if (typeof json !== 'string' || json.length > LIMITS.importCharacters) return fail('导入文件过大或不是有效的 JSON 文本。');
      let envelope;
      try { envelope = JSON.parse(json); } catch (_) { return fail('导入文件不是有效的 JSON，请检查文件是否完整。'); }
      if (!plain(envelope) || envelope.format !== 'openxnet-skin' || envelope.version !== VERSION || Object.keys(envelope).some(key => !['format', 'version', 'skin'].includes(key))) return fail('此文件不是受支持的 OpenXnet 皮肤，或版本不兼容。');
      const checked = validate(envelope.skin); if (!checked.ok) return checked;
      const snapshot = current(); if (!snapshot.ok) return snapshot;
      const collision = !!presetById(checked.value.id) || snapshot.value.customSkins.some(skin => skin.id === checked.value.id);
      return save(checked.value, collision);
    }
    function exportSkin(id) {
      const selected = get(id); if (!selected.ok) return selected;
      return ok(JSON.stringify({ format: 'openxnet-skin', version: VERSION, skin: selected.value }, null, 2));
    }
    return Object.freeze({ read, write, save: input => save(input), select, remove, get,
      list: () => { const snapshot = read(); return ok([...PALETTE, ...snapshot.value.customSkins], snapshot.warnings); },
      import: importSkin, export: exportSkin,
    });
  }

  return Object.freeze({ version: VERSION, STORAGE_KEY, LIMITS, presets: () => clone(PALETTE), validate, preview, apply, createStore,
    contrastRatio: (first, second) => { try { return ratio(color(first, '颜色'), color(second, '颜色')); } catch (_) { return null; } },
  });
}));
