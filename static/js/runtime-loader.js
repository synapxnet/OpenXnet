(function initializeOpenxnetRuntimeLoader(global) {
  'use strict';

  const scriptPromises = new Map();
  const modulePromises = new Map();
  const runtimePromises = new Map();

  const SURFACE_RUNTIMES = Object.freeze({
    chat: Object.freeze({ key: 'chat', source: 'chat-vite/openxnet-chat.js', event: 'openxnet-vite-chat-remount' }),
    role: Object.freeze({ key: 'role', source: 'role-vite/openxnet-role.js', event: 'openxnet-vite-role-remount' }),
    'model-config': Object.freeze({ key: 'model', source: 'model-vite/openxnet-model.js', event: 'openxnet-vite-model-remount' }),
    toolkit: Object.freeze({ key: 'toolkit', source: 'toolkit-vite/openxnet-toolkit.js', event: 'openxnet-vite-toolkit-remount' }),
    skills: Object.freeze({ key: 'skills', source: 'skills-vite/openxnet-skills.js', event: 'openxnet-vite-skills-remount' }),
    'ai-browser': Object.freeze({ key: 'browser', source: 'browser-vite/openxnet-browser.js', event: 'openxnet-vite-browser-remount' }),
    'task-center': Object.freeze({ key: 'ops', source: 'ops-vite/openxnet-ops.js', event: 'openxnet-vite-ops-remount' }),
    system: Object.freeze({ key: 'ops', source: 'ops-vite/openxnet-ops.js', event: 'openxnet-vite-ops-remount' }),
    storage: Object.freeze({ key: 'ops', source: 'ops-vite/openxnet-ops.js', event: 'openxnet-vite-ops-remount' }),
    vrm: Object.freeze({ key: 'ops', source: 'ops-vite/openxnet-ops.js', event: 'openxnet-vite-ops-remount' }),
  });

  /**
   * Load one browser script once and preserve dependency ordering through awaits.
   *
   * @param {string} key Stable script identifier.
   * @param {string} source Static script URL.
   * @returns {Promise<void>} Completion after the script executes.
   */
  function loadScript(key, source) {
    const existingPromise = scriptPromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = `openxnet-runtime-${key}`;
      script.src = new URL(source, document.baseURI).toString();
      script.async = true;
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => {
        script.remove();
        reject(new Error(`Failed to load optional runtime '${key}'.`));
      }, { once: true });
      document.head.appendChild(script);
    });
    scriptPromises.set(key, promise);
    promise.catch(() => scriptPromises.delete(key));
    return promise;
  }

  /**
   * Import one ES module once using a document-relative absolute URL.
   *
   * @param {string} key Stable module identifier.
   * @param {string} source Static module URL.
   * @returns {Promise<unknown>} Imported module namespace.
   */
  function loadModule(key, source) {
    const existingPromise = modulePromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }
    const moduleUrl = new URL(source, document.baseURI).toString();
    const promise = import(moduleUrl);
    modulePromises.set(key, promise);
    promise.catch(() => modulePromises.delete(key));
    return promise;
  }

  /**
   * Coalesce concurrent activation of a named optional runtime.
   *
   * @param {string} key Stable runtime identifier.
   * @param {() => Promise<unknown>} activate Runtime activation function.
   * @returns {Promise<unknown>} Shared runtime activation result.
   */
  function ensureRuntime(key, activate) {
    const existingPromise = runtimePromises.get(key);
    if (existingPromise) {
      return existingPromise;
    }
    const promise = Promise.resolve().then(activate);
    runtimePromises.set(key, promise);
    promise.catch(() => runtimePromises.delete(key));
    return promise;
  }

  /**
   * Load and remount the Vite surface associated with an active legacy menu.
   *
   * @param {string} activeMenu Current Renderer menu identifier.
   * @returns {Promise<boolean>} True when a surface runtime was selected.
   */
  async function ensureSurfaceRuntime(activeMenu) {
    const descriptor = SURFACE_RUNTIMES[String(activeMenu || '').trim()];
    if (!descriptor) {
      return false;
    }
    await loadModule(descriptor.key, descriptor.source);
    global.dispatchEvent(new CustomEvent(descriptor.event));
    return true;
  }

  /**
   * Load the enterprise scene class only when the 3D sandbox opens.
   *
   * @returns {Promise<unknown>} Loaded Enterprise3DScene constructor.
   */
  async function ensureEnterprise3DRuntime() {
    if (global.Enterprise3DScene) {
      return global.Enterprise3DScene;
    }
    await loadScript('enterprise-3d', 'js/enterprise3d.js');
    if (!global.Enterprise3DScene) {
      throw new Error('Enterprise 3D runtime loaded without its scene constructor.');
    }
    return global.Enterprise3DScene;
  }

  /**
   * Resolve the Mermaid theme from the active OpenXnet DOM theme.
   *
   * @returns {'dark'|'default'} Mermaid theme identifier.
   */
  function getMermaidTheme() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    return ['dark', 'midnight', 'neon'].includes(theme) ? 'dark' : 'default';
  }

  /**
   * Load ONNX Runtime and the VAD bundle when voice activation is requested.
   *
   * @returns {Promise<unknown>} Loaded VAD namespace.
   */
  function ensureVoiceRuntime() {
    return ensureRuntime('voice', async () => {
      await loadScript('onnx', 'libs/ort.js');
      await loadScript('vad', 'libs/bundle.min.js');
      if (!global.vad) {
        throw new Error('Voice runtime loaded without the VAD namespace.');
      }
      return global.vad;
    });
  }

  /**
   * Load ExcelJS only when document export is requested.
   *
   * @returns {Promise<unknown>} Loaded ExcelJS namespace.
   */
  function ensureDocumentRuntime() {
    return ensureRuntime('documents', async () => {
      await loadScript('exceljs', 'libs/exceljs.min.js');
      if (!global.ExcelJS) {
        throw new Error('Document runtime loaded without ExcelJS.');
      }
      return global.ExcelJS;
    });
  }

  /**
   * Load QR code generation only when a QR surface becomes visible.
   *
   * @returns {Promise<unknown>} Loaded QRCode namespace.
   */
  function ensureQrRuntime() {
    return ensureRuntime('qrcode', async () => {
      await loadScript('qrcode', 'libs/qrcode.min.js');
      if (!global.QRCode) {
        throw new Error('QR runtime loaded without QRCode.');
      }
      return global.QRCode;
    });
  }

  /**
   * Load the guided-tour library only when onboarding starts.
   *
   * @returns {Promise<unknown>} Loaded Driver.js namespace.
   */
  function ensureGuideRuntime() {
    return ensureRuntime('guide', async () => {
      await loadScript('driver', 'libs/driver.js');
      if (!global.driver?.js?.driver) {
        throw new Error('Guide runtime loaded without Driver.js.');
      }
      return global.driver;
    });
  }

  /**
   * Load and initialize Mermaid only when a diagram is rendered.
   *
   * @returns {Promise<unknown>} Loaded Mermaid namespace.
   */
  function ensureMermaidRuntime() {
    return ensureRuntime('mermaid', async () => {
      await loadScript('mermaid', 'libs/mermaid.min.js');
      if (!global.mermaid) {
        throw new Error('Diagram runtime loaded without Mermaid.');
      }
      global.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        theme: getMermaidTheme(),
      });
      return global.mermaid;
    });
  }

  /**
   * Load and initialize MathJax only when a message contains math notation.
   *
   * @returns {Promise<unknown>} Loaded MathJax namespace.
   */
  function ensureMathRuntime() {
    return ensureRuntime('mathjax', async () => {
      if (!global.MathJax?.typesetPromise) {
        global.MathJax = {
          options: { ignoreHtmlClass: 'user-message-content' },
          tex: {
            inlineMath: [['$', '$']],
            displayMath: [['$$', '$$']],
          },
          svg: { fontCache: 'global' },
        };
        await loadScript('mathjax', 'libs/tex-svg.js');
      }
      if (global.MathJax?.startup?.promise) {
        await global.MathJax.startup.promise;
      }
      if (!global.MathJax?.typesetPromise) {
        throw new Error('Math runtime loaded without MathJax typesetting APIs.');
      }
      return global.MathJax;
    });
  }

  global.openxnetRuntime = Object.freeze({
    ensureDocumentRuntime,
    ensureEnterprise3DRuntime,
    ensureGuideRuntime,
    ensureMathRuntime,
    ensureMermaidRuntime,
    ensureQrRuntime,
    ensureSurfaceRuntime,
    ensureVoiceRuntime,
  });
}(window));
