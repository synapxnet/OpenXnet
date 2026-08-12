/**
 * Enterprise 3D Sandbox v3 - Hierarchical Navigation
 * Level 0: City View  (workspaces = buildings)
 * Level 1: Building Interior (projects = floors)
 * Level 2: Floor View (agents = employees)
 */

class Enterprise3DScene {
  constructor(container, options = {}) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    if (!this.container) throw new Error('Enterprise3D: container not found');
    this.THREE = (typeof globalThis !== 'undefined' && globalThis.THREE)
      || (typeof window !== 'undefined' && window.THREE)
      || null;
    if (!this.THREE) throw new Error('Enterprise3D: THREE not loaded');
    const THREE = this.THREE;

    this.workspaces = options.workspaces || [];
    this.projects = options.projects || [];
    this.agents = options.agents || [];

    this.level = 0;           // 0=city, 1=building, 2=floor
    this.currentWsId = null;
    this.currentProjectId = null;
    this.selectedAgent = null;

    // Callbacks
    this._onBuildingClick = null;
    this._onFloorClick = null;
    this._onAgentClick = null;
    this._onAgentDblClick = null;
    this._onSelectedAgentPos = null;
    this._onGhostClick = null; // ghost at any level
    this._onBackClick = null;

    this._meshMap = new Map();     // id -> THREE.Object3D
    this._labelEls = [];
    this._animId = null;
    this._clock = new THREE.Clock();
    this._tweens = [];
    this._particles = [];
    this._decorations = [];
    this._isFullscreen = false;
    this._fullscreenRoot = null;
    this._fullscreenHost = null;
    this._fullscreenButton = null;
    this._disposed = false;
    this._zoomFrame = null;

    // Label overlay
    this.labelOverlay = document.createElement('div');
    this.labelOverlay.className = 'enterprise-3d-label-overlay';
    this.labelOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:10;';
    this.container.appendChild(this.labelOverlay);

    this._init();
  }

  // ============== PUBLIC API ==============

  onBuildingClick(cb) { this._onBuildingClick = cb; }
  onFloorClick(cb) { this._onFloorClick = cb; }
  onAgentClick(cb) { this._onAgentClick = cb; }
  onAgentDblClick(cb) { this._onAgentDblClick = cb; }
  onAgentMove(cb) { this._onAgentMove = cb; }
  onSelectedAgentPositionUpdate(cb) { this._onSelectedAgentPos = cb; }
  onGhostClick(cb) { this._onGhostClick = cb; }

  updateData(workspaces, projects, agents) {
    this.workspaces = workspaces || [];
    this.projects = projects || [];
    this.agents = agents || [];
    this._rebuildCurrentLevel();
  }

  showCityView() {
    this.level = 0;
    this.currentWsId = null;
    this.currentProjectId = null;
    this.selectedAgent = null;
    this._clearScene();
    this._buildCityView();
    const view = this._getDefaultCameraView();
    this._zoomCamera(view.distance, view.target);
  }

  showBuildingView(wsId) {
    this.level = 1;
    this.currentWsId = wsId;
    this.currentProjectId = null;
    this.selectedAgent = null;
    this._clearScene();
    this._buildBuildingView(wsId);
    const view = this._getDefaultCameraView();
    this._zoomCamera(view.distance, view.target);
  }

  showFloorView(projectId) {
    this.level = 2;
    this.currentProjectId = projectId;
    this.selectedAgent = null;
    this._clearScene();
    this._buildFloorView(projectId);
    const view = this._getDefaultCameraView();
    this._zoomCamera(view.distance, view.target);
  }

  goBack() {
    if (this.level === 2) {
      this.showBuildingView(this.currentWsId);
    } else if (this.level === 1) {
      this.showCityView();
    }
  }

  toggleFullscreen() {
    this._setFullscreenState(!this._isFullscreen);
  }

  /** 放大当前沙盘视图；无输入，在有界正交相机范围内缩小视锥。 */
  zoomIn() {
    this._scaleCameraFrustum(0.82);
  }

  /** 缩小当前沙盘视图；无输入，在有界正交相机范围内扩大视锥。 */
  zoomOut() {
    this._scaleCameraFrustum(1.22);
  }

  /** 重置当前沙盘取景；无输入，根据园区、工作空间或项目层恢复推荐镜头。 */
  resetView() {
    const view = this._getDefaultCameraView();
    this._zoomCamera(view.distance, view.target);
  }

  resize() {
    if (this._disposed) return;
    const { width: w, height: h } = this._getContainerSize();
    if (!w || !h) return;
    const fallbackD = this.level === 0 ? 12 : this.level === 1 ? 8 : 8;
    this._applyCameraFrustum(this.camera.top || fallbackD, w, h);
    this.renderer.setSize(w, h, false); // false: 不写 inline width/height，让 CSS 100% 接管，避免 1px 取整白缝
  }

  dispose() {
    this._disposed = true;
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._zoomFrame) cancelAnimationFrame(this._zoomFrame);
    this._setFullscreenState(false);
    window.removeEventListener('resize', this._resizeHandler);
    document.removeEventListener('fullscreenchange', this._fullscreenHandler);
    document.removeEventListener('webkitfullscreenchange', this._fullscreenHandler);
    document.removeEventListener('keydown', this._fullscreenKeyHandler);
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    if (this.labelOverlay) this.labelOverlay.remove();
    this._meshMap.clear();
  }

  // ============== INITIALIZATION ==============

  _init() {
    const THREE = this.THREE;
    const { width: w, height: h } = this._getContainerSize();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d141a);
    this.scene.fog = new THREE.FogExp2(0x0d141a, 0.01);

    const aspect = w / h;
    const d = 10;
    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
    this.camera.position.set(14, 16, 14);
    this.camera.lookAt(2, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h, false); // false: 不写 inline width/height，让 CSS 100% 接管，避免 1px 取整白缝
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0d141a, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0;';
    this.container.insertBefore(this.renderer.domElement, this.labelOverlay);

    // Lighting
    this.scene.add(new THREE.AmbientLight(0xa9bdd0, 0.72));
    const mainLight = new THREE.DirectionalLight(0xfff3dc, 0.95);
    mainLight.position.set(8, 15, 8);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.left = -25; mainLight.shadow.camera.right = 25;
    mainLight.shadow.camera.top = 25; mainLight.shadow.camera.bottom = -25;
    this.scene.add(mainLight);

    const blueLight = new THREE.PointLight(0x4ecdc4, 0.5, 40);
    blueLight.position.set(-5, 5, -3);
    this.scene.add(blueLight);
    const warmLight = new THREE.PointLight(0xfdcb6e, 0.24, 40);
    warmLight.position.set(5, 5, 5);
    this.scene.add(warmLight);

    this._createGround();
    this._createParticles();
    this._setupControls();
    this._setupInteraction();
    this._createUI();
    this.showCityView();
    this._animate();

    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);

    this._fullscreenHandler = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement && this._isFullscreen) {
        this._setFullscreenState(false);
      }
      setTimeout(() => this.resize(), 100);
    };
    document.addEventListener('fullscreenchange', this._fullscreenHandler);
    document.addEventListener('webkitfullscreenchange', this._fullscreenHandler);

    this._fullscreenKeyHandler = (event) => {
      if (event.key === 'Escape' && this._isFullscreen) {
        this._setFullscreenState(false);
      }
    };
    document.addEventListener('keydown', this._fullscreenKeyHandler);

    // Delayed resize to handle layout settling
    setTimeout(() => this.resize(), 200);
  }

  /** 读取当前可见 3D 视口尺寸；聊天分屏时优先采用画布实际宽度。 */
  _getContainerSize() {
    const viewportElement = this.renderer?.domElement || this.container;
    const rect = viewportElement.getBoundingClientRect ? viewportElement.getBoundingClientRect() : null;
    const width = Math.max(1, Math.round((rect && rect.width) || viewportElement.clientWidth || this.container.clientWidth || 960));
    const height = Math.max(1, Math.round((rect && rect.height) || this.container.clientHeight || 540));
    return { width, height };
  }

  _setFullscreenState(active) {
    const root = this._fullscreenRoot || this.container.closest('.enterprise-sandbox-shell') || this.container;
    const host = this._fullscreenHost || root.closest('.page') || null;
    this._fullscreenRoot = root;
    this._fullscreenHost = host;
    this._isFullscreen = Boolean(active);
    root.classList.toggle('is-enterprise-3d-fullscreen', this._isFullscreen);
    if (host) {
      host.classList.toggle('is-enterprise-3d-fullscreen-host', this._isFullscreen);
    }
    this.container.classList.toggle('is-enterprise-3d-stage-fullscreen', this._isFullscreen);
    document.documentElement.classList.toggle('enterprise-3d-fullscreen-active', this._isFullscreen);
    document.body.classList.toggle('enterprise-3d-fullscreen-active', this._isFullscreen);

    this._toggleFullscreenViewportStyles(this._isFullscreen);

    // ─── 兜底：直接给周边导航塞 inline style display:none，
    //    避开所有 CSS 优先级/缓存问题。inline 优先级最高（除 !important+specificity）。
    this._toggleAdjacentChrome(this._isFullscreen);

    if (window.electronAPI && typeof window.electronAPI.windowAction === 'function') {
      const fullscreenRequest = window.electronAPI.windowAction(this._isFullscreen ? 'enter-fullscreen' : 'exit-fullscreen');
      if (fullscreenRequest && typeof fullscreenRequest.catch === 'function') {
        fullscreenRequest.catch((error) => console.warn('Enterprise3D fullscreen window action failed:', error));
      }
    }

    if (this._fullscreenButton) {
      this._fullscreenButton.innerHTML = this._isFullscreen
        ? '<i class="fa-solid fa-compress"></i>'
        : '<i class="fa-solid fa-expand"></i>';
      this._fullscreenButton.title = this._isFullscreen ? '退出全屏' : '全屏显示';
      this._fullscreenButton.setAttribute('aria-label', this._fullscreenButton.title);
    }

    setTimeout(() => this.resize(), 40);
    setTimeout(() => this.resize(), 180);
  }

  _rememberInlineStyles(el, props) {
    if (!el) return;
    if (!this._fullscreenInlineStyles) this._fullscreenInlineStyles = new WeakMap();
    if (this._fullscreenInlineStyles.has(el)) return;
    const saved = {};
    props.forEach((prop) => { saved[prop] = el.style.getPropertyValue(prop) || ''; });
    this._fullscreenInlineStyles.set(el, saved);
  }

  _restoreInlineStyles(el) {
    if (!el || !this._fullscreenInlineStyles || !this._fullscreenInlineStyles.has(el)) return;
    const saved = this._fullscreenInlineStyles.get(el) || {};
    Object.keys(saved).forEach((prop) => {
      if (saved[prop]) el.style.setProperty(prop, saved[prop]);
      else el.style.removeProperty(prop);
    });
    this._fullscreenInlineStyles.delete(el);
  }

  _toggleFullscreenViewportStyles(active) {
    const root = this._fullscreenRoot || this.container.closest('.enterprise-sandbox-shell') || this.container;
    const stage = this.container;
    const canvas = this.renderer && this.renderer.domElement;
    const rootProps = [
      'position', 'inset', 'top', 'left', 'right', 'bottom', 'z-index', 'width', 'height',
      'min-height', 'max-width', 'margin', 'padding', 'border', 'outline', 'border-radius',
      'background', 'box-shadow', 'overflow', 'transform', 'box-sizing',
    ];
    const shellProps = [
      'width', 'height', 'min-height', 'max-width', 'max-height', 'margin', 'padding',
      'border', 'outline', 'background', 'background-image', 'box-shadow', 'overflow',
      'transform', 'perspective', 'contain', 'will-change', 'box-sizing',
    ];
    const documentProps = [
      'width', 'height', 'min-height', 'max-width', 'max-height', 'margin', 'padding',
      'background', 'background-image', 'overflow', 'overscroll-behavior', 'box-sizing',
    ];
    const stageProps = [
      'position', 'inset', 'width', 'height', 'min-height', 'margin', 'padding',
      'border', 'border-radius', 'background', 'overflow', 'box-sizing',
    ];
    const canvasProps = ['position', 'inset', 'width', 'height', 'display', 'background'];
    const shells = Array.from(new Set([
      document.documentElement,
      document.body,
      document.getElementById('app'),
      document.querySelector('.openxnet-redesign-app'),
      document.querySelector('.main-container.el-container'),
      document.querySelector('.content.ox-content-surface'),
      this._fullscreenHost,
      root.closest('.oxe-shell'),
      root.closest('.ent-page-content'),
      root.closest('.oxe-content'),
    ].filter(Boolean)));

    if (!active) {
      this._restoreInlineStyles(canvas);
      this._restoreInlineStyles(stage);
      this._restoreInlineStyles(root);
      shells.forEach((el) => this._restoreInlineStyles(el));
      return;
    }

    shells.forEach((el) => this._rememberInlineStyles(el, el === document.documentElement || el === document.body ? documentProps : shellProps));
    this._rememberInlineStyles(root, rootProps);
    this._rememberInlineStyles(stage, stageProps);
    this._rememberInlineStyles(canvas, canvasProps);

    const set = (el, prop, value) => el && el.style.setProperty(prop, value, 'important');
    shells.forEach((el) => {
      set(el, 'margin', '0');
      set(el, 'padding', '0');
      set(el, 'background', '#0a121c');
      set(el, 'background-image', 'none');
      set(el, 'overflow', 'hidden');
      set(el, 'box-sizing', 'border-box');
      if (el !== document.documentElement && el !== document.body) {
        set(el, 'border', '0');
        set(el, 'outline', '0');
        set(el, 'box-shadow', 'none');
        set(el, 'transform', 'none');
        set(el, 'perspective', 'none');
        set(el, 'contain', 'none');
        set(el, 'will-change', 'auto');
      }
      set(el, 'width', '100vw');
      set(el, 'height', '100dvh');
      set(el, 'min-height', '100dvh');
      set(el, 'max-width', 'none');
      set(el, 'max-height', 'none');
    });

    set(root, 'position', 'fixed');
    set(root, 'inset', '-6px');
    set(root, 'top', '-6px');
    set(root, 'left', '-6px');
    set(root, 'right', '-6px');
    set(root, 'bottom', '-6px');
    set(root, 'z-index', '2147483000');
    set(root, 'width', 'calc(100vw + 12px)');
    set(root, 'height', 'calc(100dvh + 12px)');
    set(root, 'min-height', 'calc(100dvh + 12px)');
    set(root, 'max-width', 'none');
    set(root, 'margin', '0');
    set(root, 'padding', '0');
    set(root, 'border', '0');
    set(root, 'outline', '0');
    set(root, 'border-radius', '0');
    set(root, 'background', '#0a121c');
    set(root, 'box-shadow', 'none');
    set(root, 'overflow', 'hidden');
    set(root, 'transform', 'none');
    set(root, 'box-sizing', 'border-box');

    set(stage, 'position', 'absolute');
    set(stage, 'inset', '0');
    set(stage, 'width', 'auto');
    set(stage, 'height', 'auto');
    set(stage, 'min-height', '0');
    set(stage, 'margin', '0');
    set(stage, 'padding', '0');
    set(stage, 'border', '0');
    set(stage, 'border-radius', '0');
    set(stage, 'background', '#0a121c');
    set(stage, 'overflow', 'hidden');
    set(stage, 'box-sizing', 'border-box');

    set(canvas, 'position', 'absolute');
    set(canvas, 'inset', '-2px');
    set(canvas, 'width', 'calc(100% + 4px)');
    set(canvas, 'height', 'calc(100% + 4px)');
    set(canvas, 'display', 'block');
    set(canvas, 'background', '#0a121c');
  }

  /**
   * 全屏时直接对周边 chrome 设 inline `display: none`（兜底，跳过 CSS 优先级）。
   * 退出全屏时恢复原 display。
   */
  _toggleAdjacentChrome(hide) {
    // 主左侧栏 / 企业子菜单 / 主顶栏 / 状态栏 / 子导航
    const selectors = [
      'aside.sidebar.el-aside',
      '.oxe-sidenav',
      '.top-bar',
      '.ox-prototype-statusbar',
      '.ox-prototype-subnav',
      '.ox-prototype-page-breadcrumb',
    ];
    if (!this._chromeOriginalDisplay) this._chromeOriginalDisplay = new WeakMap();
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (hide) {
          if (!this._chromeOriginalDisplay.has(el)) {
            this._chromeOriginalDisplay.set(el, el.style.display || '');
          }
          el.style.setProperty('display', 'none', 'important');
        } else {
          const original = this._chromeOriginalDisplay.has(el) ? this._chromeOriginalDisplay.get(el) : '';
          if (original) el.style.display = original;
          else el.style.removeProperty('display');
          this._chromeOriginalDisplay.delete(el);
        }
      });
    });

    // 兜底白边消除：给 html / body / shell 直接塞 inline 深色背景；
    // 退出时恢复。inline style 优先级最高，绕过任何 CSS。
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (hide) {
      if (!this._chromeOriginalDisplay.has(htmlEl)) {
        this._chromeOriginalDisplay.set(htmlEl, {
          bg: htmlEl.style.background || '',
          margin: htmlEl.style.margin || '',
          padding: htmlEl.style.padding || '',
        });
      }
      if (!this._chromeOriginalDisplay.has(bodyEl)) {
        this._chromeOriginalDisplay.set(bodyEl, {
          bg: bodyEl.style.background || '',
          margin: bodyEl.style.margin || '',
          padding: bodyEl.style.padding || '',
        });
      }
      htmlEl.style.setProperty('background', '#0a121c', 'important');
      htmlEl.style.setProperty('margin', '0', 'important');
      htmlEl.style.setProperty('padding', '0', 'important');
      bodyEl.style.setProperty('background', '#0a121c', 'important');
      bodyEl.style.setProperty('margin', '0', 'important');
      bodyEl.style.setProperty('padding', '0', 'important');
    } else {
      const restoreNode = (el) => {
        const saved = this._chromeOriginalDisplay.get(el);
        if (!saved) {
          el.style.removeProperty('background');
          el.style.removeProperty('margin');
          el.style.removeProperty('padding');
          return;
        }
        if (saved.bg) el.style.background = saved.bg; else el.style.removeProperty('background');
        if (saved.margin) el.style.margin = saved.margin; else el.style.removeProperty('margin');
        if (saved.padding) el.style.padding = saved.padding; else el.style.removeProperty('padding');
        this._chromeOriginalDisplay.delete(el);
      };
      restoreNode(htmlEl);
      restoreNode(bodyEl);
    }
  }

  _applyCameraFrustum(distance, width, height) {
    const safeWidth = Math.max(width || 0, 1);
    const safeHeight = Math.max(height || 0, 1);
    const aspect = safeWidth / safeHeight;
    this.camera.left = -distance * aspect;
    this.camera.right = distance * aspect;
    this.camera.top = distance;
    this.camera.bottom = -distance;
    this.camera.updateProjectionMatrix();
  }

  // ============== GROUND ==============

  _createGround() {
    const THREE = this.THREE;
    this._ground = new THREE.Group();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshLambertMaterial({ color: 0x17232c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this._ground.add(ground);
    this.scene.add(this._ground);
  }

  // ============== LEVEL 0: CITY VIEW ==============

  _buildCityView() {
    this._createRoads();
    this._createDecorations();

    const wsTypeStyles = {
      local:  { color: 0x4ecdc4, accent: '#4ecdc4', icon: '💻' },
      docker: { color: 0x6c5ce7, accent: '#6c5ce7', icon: '🐳' },
      cloud:  { color: 0x3b82f6, accent: '#60a5fa', icon: '☁️' },
      server: { color: 0xfdcb6e, accent: '#fdcb6e', icon: '🖥️' },
      vm:     { color: 0xe17055, accent: '#e17055', icon: '📦' },
    };

    const cols = Math.max(2, Math.ceil(Math.sqrt(this.workspaces.length)));
    const spacing = 8;

    // Calculate all positions centered around origin
    const allPositions = [];
    for (let i = 0; i < this.workspaces.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const totalRows = Math.ceil(this.workspaces.length / cols);
      const x = (col - (cols - 1) / 2) * spacing;
      const z = (row - (totalRows - 1) / 2) * spacing;
      allPositions.push({ x, z });
    }

    this.workspaces.forEach((ws, i) => {
      const { x, z } = allPositions[i];

      const floors = this.projects.filter(p => p.workspaceId === ws.id).length;
      const style = wsTypeStyles[ws.type] || wsTypeStyles.local;
      const buildingHeight = Math.max(2, floors * 1.2 + 1);

      const building = this._createBuilding(x, z, buildingHeight, style.color, ws.name, style.accent, floors);
      building.userData = { type: 'building', wsId: ws.id, wsName: ws.name };
      this._meshMap.set('ws-' + ws.id, building);

      // Agent count badge
      const agentCount = this.agents.filter(a => a.assignedWorkspace === ws.id).length;
      this._addLabel(x, buildingHeight + 1.2, z, ws.name, style.accent, `${floors}F · ${agentCount}👷`);
    });
  }

  _createBuilding(x, z, height, color, name, accent, floors) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Main body
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, height, 3),
      new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85 })
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Floor lines
    for (let f = 1; f <= floors; f++) {
      const lineY = f * 1.2;
      if (lineY < height) {
        const line = new THREE.Mesh(
          new THREE.BoxGeometry(3.6, 0.04, 3.1),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })
        );
        line.position.y = lineY;
        group.add(line);
      }
    }

    // Roof accent
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.2, 3.3),
      new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
    );
    roof.position.y = height + 0.1;
    group.add(roof);

    // Windows
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.6 });
    for (let f = 0; f < Math.min(floors, 6); f++) {
      for (let w = -1; w <= 1; w++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), windowMat);
        win.position.set(1.76, f * 1.2 + 0.8, w * 0.8);
        win.rotation.y = Math.PI / 2;
        group.add(win);
        const win2 = win.clone();
        win2.position.x = -1.76;
        win2.rotation.y = -Math.PI / 2;
        group.add(win2);
      }
    }

    // Entrance
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.05),
      new THREE.MeshPhongMaterial({ color: 0x2d3436 })
    );
    door.position.set(0, 0.6, 1.53);
    group.add(door);

    // Glow base
    const glowBase = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.05, 3.5),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 })
    );
    glowBase.position.y = 0.02;
    group.add(glowBase);

    this.scene.add(group);
    return group;
  }

  // ============== LEVEL 1: BUILDING INTERIOR ==============

  _buildBuildingView(wsId) {
    const THREE = this.THREE;
    const ws = this.workspaces.find(w => w.id === wsId);
    if (!ws) return;

    const wsProjects = this.projects.filter(p => p.workspaceId === wsId);
    const wsTypeColors = { local: 0x4ecdc4, docker: 0x6c5ce7, cloud: 0x3b82f6, server: 0xfdcb6e, vm: 0xe17055 };
    const baseColor = wsTypeColors[ws.type] || 0x4ecdc4;

    // Building shell (transparent cross-section)
    const totalFloors = Math.max(wsProjects.length, 1);
    const shellHeight = totalFloors * 2.5 + 1;

    // Left wall
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x263846, transparent: true, opacity: 0.72 });
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.15, shellHeight, 8), wallMat);
    leftWall.position.set(-4, shellHeight / 2, 0);
    this.scene.add(leftWall);

    // Right wall
    const rightWall = leftWall.clone();
    rightWall.position.x = 4;
    this.scene.add(rightWall);

    // Back wall
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(8.15, shellHeight, 0.15), wallMat);
    backWall.position.set(0, shellHeight / 2, -4);
    this.scene.add(backWall);

    // Floor slabs + project content
    wsProjects.forEach((proj, i) => {
      const y = i * 2.5;
      const projColor = new THREE.Color(proj.color || '#4ecdc4');

      // Floor slab
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.15, 8),
        new THREE.MeshPhongMaterial({ color: 0x253746 })
      );
      slab.position.set(0, y, 0);
      slab.receiveShadow = true;
      this.scene.add(slab);

      // Color accent strip
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.08, 0.3),
        new THREE.MeshBasicMaterial({ color: projColor })
      );
      strip.position.set(0, y + 0.12, 3.85);
      this.scene.add(strip);

      // Floor number indicator
      const floorNum = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.2, 0.05),
        new THREE.MeshPhongMaterial({ color: projColor, emissive: projColor, emissiveIntensity: 0.5 })
      );
      floorNum.position.set(-3.6, y + 0.8, 3.9);
      this.scene.add(floorNum);

      // Desks on each floor
      const agentsOnFloor = this.agents.filter(a => a.projectId === proj.id);
      const maxDesks = Math.min(agentsOnFloor.length + 1, 6);
      for (let d = 0; d < maxDesks && d < agentsOnFloor.length; d++) {
        const dx = -2.5 + (d % 3) * 2.5;
        const dz = d < 3 ? -1.5 : 1.5;
        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.5, 0.8),
          new THREE.MeshPhongMaterial({ color: 0x2d3a4a })
        );
        desk.position.set(dx, y + 0.4, dz);
        desk.castShadow = true;
        this.scene.add(desk);

        // Agent figure on desk
        const agent = agentsOnFloor[d];
        if (agent) {
          const bodyType = String(agent.bodyType || '').trim() || 'default';
          const figure = this._createCharacterFigure({ bodyType, accent: null, scale: 0.85 });
          figure.position.set(dx, y + 0.75, dz - 0.5);
          Object.assign(figure.userData, { type: 'agent', agent });
          if (figure.userData.__idle) figure.userData.__idle.baseY = y + 0.75;
          this.scene.add(figure);
          this._meshMap.set('agent-' + agent.id, figure);
        }
      }

      // Make the floor clickable
      const clickZone = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 2.2, 7.5),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      clickZone.position.set(0, y + 1.2, 0);
      clickZone.userData = { type: 'floor', projectId: proj.id, projectName: proj.name };
      this.scene.add(clickZone);
      this._meshMap.set('floor-' + proj.id, clickZone);

      // 楼层名称与员工数量由固定导航承载，3D 场景仅保留可辨识的楼层色带与编号。
    });

    // Ghost floor for "add project"
    const ghostY = wsProjects.length * 2.5;
    const ghostSlab = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.15, 8),
      new THREE.MeshPhongMaterial({ color: 0x1e2d3d, transparent: true, opacity: 0.3, wireframe: true })
    );
    ghostSlab.position.set(0, ghostY, 0);
    this.scene.add(ghostSlab);

    // 工作空间名称和新增入口由固定导航承载，避免与顶层项目标签重叠。
  }

  // ============== LEVEL 2: FLOOR VIEW ==============

  _buildFloorView(projectId) {
    const THREE = this.THREE;
    const proj = this.projects.find(p => p.id === projectId);
    if (!proj) return;

    const projColor = new THREE.Color(proj.color || '#4ecdc4');

    // Floor plane
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshLambertMaterial({ color: 0x1a2636 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Room walls
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x1e2d3d, transparent: true, opacity: 0.5 });
    [[-9, 0, 0.1, 4, 18], [9, 0, 0.1, 4, 18], [0, 0, 18, 4, 0.1]].forEach(([x, z, wx, wy, wz]) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(wx, wy, wz), wallMat);
      w.position.set(x, 2, z - 9);
      this.scene.add(w);
    });

    // Color accent baseboard
    const baseboard = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.15, 0.1),
      new THREE.MeshBasicMaterial({ color: projColor })
    );
    baseboard.position.set(0, 0.08, -8.95);
    this.scene.add(baseboard);

    // Desks and agents
    const floorAgents = this.agents.filter(a => a.projectId === projectId);
    const deskPositions = [
      { x: -5, z: -4 }, { x: -1.5, z: -4 }, { x: 2, z: -4 }, { x: 5.5, z: -4 },
      { x: -5, z: 0 },  { x: -1.5, z: 0 },  { x: 2, z: 0 },  { x: 5.5, z: 0 },
      { x: -5, z: 4 },  { x: -1.5, z: 4 },  { x: 2, z: 4 },  { x: 5.5, z: 4 },
    ];

    floorAgents.forEach((agent, i) => {
      // 默认网格位置（自动布桌）；若 agent 已有 position3D 则用用户自定义坐标
      const gridPos = deskPositions[i % deskPositions.length] || { x: 0, z: 0 };
      const hasCustomPos = agent.position3D
        && typeof agent.position3D.x === 'number'
        && typeof agent.position3D.z === 'number';
      const characterPos = hasCustomPos
        ? { x: agent.position3D.x, z: agent.position3D.z }
        : { x: gridPos.x, z: gridPos.z + 1 }; // 默认站在桌后

      // 没有自定义位置时画桌椅（被用户拖走的就不再画固定桌椅）
      if (!hasCustomPos && i < deskPositions.length) {
        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(2, 0.6, 1.2),
          new THREE.MeshPhongMaterial({ color: 0x2d3a4a })
        );
        desk.position.set(gridPos.x, 0.3, gridPos.z);
        desk.castShadow = true;
        this.scene.add(desk);

        const chair = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.8, 0.6),
          new THREE.MeshPhongMaterial({ color: 0x3d4a5a })
        );
        chair.position.set(gridPos.x, 0.4, gridPos.z + 1);
        this.scene.add(chair);
      }

      // 角色：用 bodyType（带回退）+ project 主色作为衣服点缀
      const bodyType = String(agent.bodyType || '').trim() || 'default';
      const figure = this._createCharacterFigure({
        bodyType,
        accent: null, // 用 bodyType 预设自带的颜色
        scale: 1.2,
      });
      figure.position.set(characterPos.x, 0.6, characterPos.z);
      // ⚠️ 用 Object.assign 合并 —— 不能直接 `userData = { ... }`，
      //    那样会把 _createCharacterFigure 写进去的 __idle 给抹掉。
      Object.assign(figure.userData, { type: 'agent', agent, draggable: true });
      if (figure.userData.__idle) figure.userData.__idle.baseY = 0.6;
      this.scene.add(figure);
      this._meshMap.set('agent-' + agent.id, figure);

      // 角色头顶标签
      const dimColor = proj.color || '#4ecdc4';
      this._addLabel(characterPos.x, 2.5, characterPos.z, agent.name, dimColor, agent.department || '');
    });

    // Ghost slots for empty positions
    const ghostStart = floorAgents.length;
    const maxGhosts = Math.min(1, deskPositions.length - ghostStart);
    for (let g = 0; g < maxGhosts; g++) {
      const pos = deskPositions[ghostStart + g];
      if (!pos) break;

      // Wireframe desk
      const ghostDesk = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.6, 1.2),
        new THREE.MeshPhongMaterial({ color: 0x2d3a4a, wireframe: true, transparent: true, opacity: 0.3 })
      );
      ghostDesk.position.set(pos.x, 0.3, pos.z);
      this.scene.add(ghostDesk);

      // Ghost figure
      const ghostFigure = this._createAgentFigure(new THREE.Color(0x555555), 1.0, true);
      ghostFigure.position.set(pos.x, 0.6, pos.z + 1);
      this.scene.add(ghostFigure);

    }
  }

  // ============== SHARED GEOMETRY ==============

  /**
   * Build a fully-articulated lowpoly character ("沙盘 model game" 风格)
   *  ─ 头 + 双眼  ─ 躯干 + 双臂 + 双腿 ─ 可选发型/帽子/配件
   *  ─ 多种 bodyType 预设：default / engineer / scholar / captain / ninja / robot / streamer / geek
   *  ─ 自带 idle 呼吸 + 摇摆动画（_animate loop 里读 userData.__idle）
   */
  _createAgentFigure(color, scale = 1, isGhost = false, bodyType = 'default') {
    return this._createCharacterFigure({
      bodyType: isGhost ? 'ghost' : bodyType,
      accent: color,
      scale,
      isGhost,
    });
  }

  _getBodyTypePresets() {
    if (this._bodyTypePresetsCache) return this._bodyTypePresetsCache;
    // 配色按 OpenXnet 主色（#5BA3C5）+ 拓展色板；每个角色身体/皮肤/配件三组色
    this._bodyTypePresetsCache = {
      default:   { body: 0x5BA3C5, skin: 0xF8D7B9, accent: 0xFFFFFF, accessory: 'tie' },
      engineer:  { body: 0xF59E0B, skin: 0xF8D7B9, accent: 0xFCD34D, accessory: 'hardhat' },
      scholar:   { body: 0x6366F1, skin: 0xF8D7B9, accent: 0xC7D2FE, accessory: 'glasses' },
      captain:   { body: 0xDC2626, skin: 0xF8D7B9, accent: 0xFCD34D, accessory: 'crown' },
      ninja:     { body: 0x1F2937, skin: 0xF8D7B9, accent: 0xEF4444, accessory: 'mask' },
      robot:     { body: 0x94A3B8, skin: 0xCBD5E1, accent: 0x10B981, accessory: 'antenna' },
      streamer:  { body: 0xEC4899, skin: 0xF8D7B9, accent: 0xF9A8D4, accessory: 'headphones' },
      geek:      { body: 0x10B981, skin: 0xF8D7B9, accent: 0x6EE7B7, accessory: 'cap' },
      ghost:     { body: 0x4B5563, skin: 0x4B5563, accent: 0x4B5563, accessory: null, isGhost: true },
    };
    return this._bodyTypePresetsCache;
  }

  _createCharacterFigure({ bodyType = 'default', accent = null, scale = 1.0, isGhost = false } = {}) {
    const THREE = this.THREE;
    const presets = this._getBodyTypePresets();
    const preset = presets[bodyType] || presets.default;
    const group = new THREE.Group();

    const ghostFlag = isGhost || preset.isGhost === true;
    // 共享材质工厂：ghost 用半透 wireframe，其余用 Phong 实体
    const mkMat = (hex, opts = {}) => {
      if (ghostFlag) {
        return new THREE.MeshPhongMaterial({
          color: hex, transparent: true, opacity: 0.32, wireframe: true,
        });
      }
      return new THREE.MeshPhongMaterial({
        color: hex,
        shininess: opts.shininess !== undefined ? opts.shininess : 18,
        ...opts,
      });
    };

    const bodyHex = (accent && !ghostFlag) ? accent : preset.body;
    const skinHex = preset.skin;
    const accentHex = preset.accent;

    const bodyMat = mkMat(bodyHex);
    const skinMat = mkMat(skinHex);
    const accentMat = mkMat(accentHex);
    const darkMat = mkMat(0x1F2937, { shininess: 4 });

    const S = scale;

    // ────── 双腿（黑色裤子）──────
    const legGeo = new THREE.CylinderGeometry(0.10 * S, 0.10 * S, 0.36 * S, 8);
    [-0.13, 0.13].forEach((dx) => {
      const leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(dx * S, 0.18 * S, 0);
      leg.castShadow = !ghostFlag;
      group.add(leg);
      // 小鞋（白底）
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.18 * S, 0.08 * S, 0.22 * S),
        mkMat(0xF1F5F9)
      );
      shoe.position.set(dx * S, 0.04 * S, 0.04 * S);
      group.add(shoe);
    });

    // ────── 躯干 ──────
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.42 * S, 0.5 * S, 0.28 * S),
      bodyMat
    );
    torso.position.y = 0.62 * S;
    torso.castShadow = !ghostFlag;
    group.add(torso);

    // 躯干装饰：腰带 / 衣领 / 单色条纹
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.44 * S, 0.06 * S, 0.30 * S),
      darkMat
    );
    belt.position.y = 0.42 * S;
    group.add(belt);

    // ────── 双臂 ──────
    const armGeo = new THREE.CylinderGeometry(0.07 * S, 0.07 * S, 0.42 * S, 8);
    const armPivots = [];
    [-1, 1].forEach((side) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.24 * S, 0.82 * S, 0);
      const arm = new THREE.Mesh(armGeo, bodyMat);
      arm.position.y = -0.22 * S;
      arm.castShadow = !ghostFlag;
      armPivot.add(arm);
      // 手（小球肤色）
      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.075 * S, 8, 8),
        skinMat
      );
      hand.position.y = -0.46 * S;
      armPivot.add(hand);
      group.add(armPivot);
      armPivots.push({ pivot: armPivot, side });
    });

    // ────── 头（肤色球）──────
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 * S, 16, 14),
      skinMat
    );
    head.position.y = 1.10 * S;
    head.castShadow = !ghostFlag;
    group.add(head);

    if (!ghostFlag) {
      // 眼睛（两个小黑点）
      const eyeGeo = new THREE.SphereGeometry(0.025 * S, 6, 6);
      const eyeMat = mkMat(0x111827);
      [-0.07, 0.07].forEach((dx) => {
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(dx * S, 1.12 * S, 0.20 * S);
        group.add(eye);
      });
      // 小腮红
      const blushGeo = new THREE.SphereGeometry(0.04 * S, 6, 6);
      const blushMat = mkMat(0xFB7185);
      [-0.13, 0.13].forEach((dx) => {
        const blush = new THREE.Mesh(blushGeo, blushMat);
        blush.position.set(dx * S, 1.04 * S, 0.18 * S);
        blush.scale.set(1, 0.5, 0.4);
        group.add(blush);
      });
    }

    // ────── 配件 ──────
    if (!ghostFlag && preset.accessory) {
      this._addCharacterAccessory(group, preset.accessory, accentHex, S, mkMat, skinHex);
    }

    // 阴影盘（角色脚下柔光）
    if (!ghostFlag) {
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(0.32 * S, 16),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.005;
      group.add(shadow);
    }

    // idle 动画标记：_animate loop 会读这俩偏移让角色微微起伏 + 手臂摆动
    group.userData.__idle = {
      seed: Math.random() * Math.PI * 2,
      armPivots: armPivots.map(a => a.pivot),
      baseY: 0,
    };
    group.userData.__bodyType = bodyType;

    return group;
  }

  _addCharacterAccessory(group, kind, accentHex, S, mkMat, skinHex) {
    const THREE = this.THREE;
    switch (kind) {
      case 'hardhat': {
        // 工程帽：圆顶 + 帽檐
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.24 * S, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          mkMat(accentHex)
        );
        cap.position.y = 1.22 * S;
        group.add(cap);
        const brim = new THREE.Mesh(
          new THREE.BoxGeometry(0.50 * S, 0.04 * S, 0.18 * S),
          mkMat(accentHex)
        );
        brim.position.set(0, 1.18 * S, 0.18 * S);
        group.add(brim);
        break;
      }
      case 'glasses': {
        const lensGeo = new THREE.RingGeometry(0.045 * S, 0.075 * S, 12);
        const lensMat = mkMat(0x111827, { side: THREE.DoubleSide });
        [-0.08, 0.08].forEach((dx) => {
          const lens = new THREE.Mesh(lensGeo, lensMat);
          lens.position.set(dx * S, 1.12 * S, 0.22 * S);
          group.add(lens);
        });
        // 鼻梁
        const bridge = new THREE.Mesh(
          new THREE.BoxGeometry(0.06 * S, 0.012 * S, 0.012 * S),
          mkMat(0x111827)
        );
        bridge.position.set(0, 1.12 * S, 0.22 * S);
        group.add(bridge);
        break;
      }
      case 'crown': {
        // 简洁王冠：底盘 + 三角尖角
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.20 * S, 0.20 * S, 0.06 * S, 12),
          mkMat(accentHex)
        );
        base.position.y = 1.36 * S;
        group.add(base);
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.05 * S, 0.12 * S, 6),
            mkMat(accentHex)
          );
          spike.position.set(Math.cos(angle) * 0.18 * S, 1.46 * S, Math.sin(angle) * 0.18 * S);
          group.add(spike);
        }
        break;
      }
      case 'mask': {
        // 忍者眼罩：横贯眼睛区域的暗色带
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(0.46 * S, 0.10 * S, 0.04 * S),
          mkMat(accentHex)
        );
        band.position.set(0, 1.14 * S, 0.18 * S);
        group.add(band);
        // 后脑勺打个结
        const knot = new THREE.Mesh(
          new THREE.SphereGeometry(0.04 * S, 6, 6),
          mkMat(accentHex)
        );
        knot.position.set(0, 1.14 * S, -0.20 * S);
        group.add(knot);
        break;
      }
      case 'antenna': {
        // 机器人头顶天线
        const stick = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015 * S, 0.015 * S, 0.18 * S, 6),
          mkMat(0x6B7280)
        );
        stick.position.y = 1.40 * S;
        group.add(stick);
        const ball = new THREE.Mesh(
          new THREE.SphereGeometry(0.05 * S, 8, 8),
          mkMat(accentHex)
        );
        ball.position.y = 1.52 * S;
        // 让球带自发光感
        ball.material.emissive = new THREE.Color(accentHex);
        ball.material.emissiveIntensity = 0.6;
        group.add(ball);
        break;
      }
      case 'headphones': {
        // 弧形头梁 + 两侧耳机杯
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(0.22 * S, 0.025 * S, 6, 18, Math.PI),
          mkMat(0x1F2937)
        );
        band.rotation.x = Math.PI / 2;
        band.rotation.y = Math.PI;
        band.position.set(0, 1.30 * S, 0);
        group.add(band);
        const cupGeo = new THREE.CylinderGeometry(0.06 * S, 0.06 * S, 0.08 * S, 10);
        [-1, 1].forEach((side) => {
          const cup = new THREE.Mesh(cupGeo, mkMat(accentHex));
          cup.rotation.z = Math.PI / 2;
          cup.position.set(side * 0.22 * S, 1.12 * S, 0);
          group.add(cup);
        });
        break;
      }
      case 'cap': {
        // 棒球帽：圆顶 + 前帽檐
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.22 * S, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
          mkMat(accentHex)
        );
        dome.position.y = 1.22 * S;
        group.add(dome);
        const brim = new THREE.Mesh(
          new THREE.BoxGeometry(0.34 * S, 0.025 * S, 0.20 * S),
          mkMat(accentHex)
        );
        brim.position.set(0, 1.22 * S, 0.20 * S);
        group.add(brim);
        break;
      }
      case 'tie': {
        // 简单领带：胸前一个倒三角
        const tie = new THREE.Mesh(
          new THREE.ConeGeometry(0.06 * S, 0.22 * S, 4),
          mkMat(accentHex)
        );
        tie.rotation.x = Math.PI; // 尖朝下
        tie.position.set(0, 0.66 * S, 0.16 * S);
        group.add(tie);
        const knot = new THREE.Mesh(
          new THREE.BoxGeometry(0.08 * S, 0.06 * S, 0.04 * S),
          mkMat(accentHex)
        );
        knot.position.set(0, 0.82 * S, 0.16 * S);
        group.add(knot);
        break;
      }
    }
  }

  _createRoads() {
    const THREE = this.THREE;
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
    // Horizontal road
    const hRoad = new THREE.Mesh(new THREE.BoxGeometry(50, 0.02, 2.5), roadMat);
    hRoad.position.set(0, 0.01, 0);
    this.scene.add(hRoad);
    // Vertical road
    const vRoad = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.02, 50), roadMat);
    vRoad.position.set(0, 0.01, 0);
    this.scene.add(vRoad);

    // Lane markings
    const laneMat = new THREE.MeshBasicMaterial({ color: 0x3d4f5f });
    for (let i = -20; i < 20; i += 3) {
      const markH = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.1), laneMat);
      markH.position.set(i, 0.02, 0);
      this.scene.add(markH);
      const markV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 1.5), laneMat);
      markV.position.set(0, 0.02, i);
      this.scene.add(markV);
    }
  }

  _createDecorations() {
    const THREE = this.THREE;
    // Trees
    const treePositions = [
      [-12, -8], [-12, 6], [12, -8], [12, 6],
      [-8, -12], [8, -12], [-8, 12], [8, 12],
      [-15, 0], [15, 0], [0, -15], [0, 15],
    ];
    treePositions.forEach(([x, z]) => {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.15, 1, 6),
        new THREE.MeshPhongMaterial({ color: 0x4a3728 })
      );
      trunk.position.set(x, 0.5, z);
      this.scene.add(trunk);
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(0.8, 1.8, 6),
        new THREE.MeshPhongMaterial({ color: 0x1b5e20 })
      );
      canopy.position.set(x, 1.8, z);
      canopy.castShadow = true;
      this.scene.add(canopy);
    });

    // Street lamps
    [[-6, -6], [6, -6], [-6, 6], [6, 6]].forEach(([x, z]) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3, 6),
        new THREE.MeshPhongMaterial({ color: 0x555555 })
      );
      pole.position.set(x, 1.5, z);
      this.scene.add(pole);
      const lampLight = new THREE.PointLight(0xffeedd, 0.3, 8);
      lampLight.position.set(x, 3.2, z);
      this.scene.add(lampLight);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffeedd })
      );
      bulb.position.set(x, 3.1, z);
      this.scene.add(bulb);
    });
  }

  _createParticles() {
    const THREE = this.THREE;
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = Math.random() * 15 + 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0x4ecdc4, size: 0.08, transparent: true, opacity: 0.4 });
    this._particleMesh = new THREE.Points(geo, mat);
    this.scene.add(this._particleMesh);
  }

  // ============== LABELS ==============

  _addLabel(x, y, z, title, color, subtitle) {
    const el = document.createElement('div');
    el.className = 'enterprise-3d-label';
    const titleElement = document.createElement('strong');
    titleElement.className = 'enterprise-3d-label__title';
    titleElement.textContent = String(title || '');
    titleElement.style.setProperty('--enterprise-3d-label-accent', String(color || '#4ecdc4'));
    el.appendChild(titleElement);
    if (subtitle) {
      const subtitleElement = document.createElement('small');
      subtitleElement.className = 'enterprise-3d-label__meta';
      subtitleElement.textContent = String(subtitle);
      el.appendChild(subtitleElement);
    }
    this.labelOverlay.appendChild(el);
    this._labelEls.push({ el, worldPos: new this.THREE.Vector3(x, y, z), type: 'label' });
  }

  /** 更新 3D 标签屏幕坐标，并将标签限制在可见画布范围内。 */
  _updateLabels() {
    const THREE = this.THREE;
    const { width: w, height: h } = this._getContainerSize();
    this._labelEls.forEach(({ el, worldPos }) => {
      const v = worldPos.clone().project(this.camera);
      const rawX = (v.x * 0.5 + 0.5) * w;
      const rawY = (-v.y * 0.5 + 0.5) * h;
      const halfWidth = Math.max(48, el.offsetWidth / 2);
      const halfHeight = Math.max(18, el.offsetHeight / 2);
      const sx = Math.min(w - halfWidth - 8, Math.max(halfWidth + 8, rawX));
      const sy = Math.min(h - halfHeight - 8, Math.max(halfHeight + 76, rawY));
      if (v.z >= -1 && v.z <= 1) {
        el.style.transform = `translate(-50%, -50%) translate(${sx}px, ${sy}px)`;
        el.style.opacity = '1';
      } else {
        el.style.opacity = '0';
      }
    });

    // Update selected agent screen position
    if (this.selectedAgent && this._selectedAgentMesh && this._onSelectedAgentPos) {
      const v = new THREE.Vector3();
      this._selectedAgentMesh.getWorldPosition(v);
      v.y += 2.8; // Floating above the agent's head
      v.project(this.camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      this._onSelectedAgentPos(sx, sy, true);
    } else if (this._onSelectedAgentPos) {
      this._onSelectedAgentPos(0, 0, false);
    }
  }

  _clearLabels() {
    this._labelEls.forEach(({ el }) => el.remove());
    this._labelEls = [];
  }

  // ============== SCENE MANAGEMENT ==============

  _clearScene() {
    const THREE = this.THREE;
    // Remove everything except ground, lights, and particles
    const keep = new Set();
    if (this._ground) keep.add(this._ground);
    if (this._particleMesh) keep.add(this._particleMesh);

    const toRemove = [];
    this.scene.children.forEach(child => {
      if (!keep.has(child) && !(child instanceof THREE.Light)) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
    this._meshMap.clear();
    this._clearLabels();
  }

  _rebuildCurrentLevel() {
    if (this.level === 0) this.showCityView();
    else if (this.level === 1 && this.currentWsId) this.showBuildingView(this.currentWsId);
    else if (this.level === 2 && this.currentProjectId) this.showFloorView(this.currentProjectId);
  }

  /** 返回当前层级推荐镜头；无输入，按对象数量计算视锥距离和中心点。 */
  _getDefaultCameraView() {
    if (this.level === 1) {
      const projectCount = this.projects.filter(project => project.workspaceId === this.currentWsId).length;
      return {
        distance: Math.min(9, 5.4 + Math.max(0, projectCount - 1) * 0.62),
        target: { x: 0, y: Math.max(0.9, Math.max(0, projectCount - 1) * 1.25 + 0.9), z: 0 },
      };
    }
    if (this.level === 2) {
      const floorAgents = this.agents.filter(agent => agent.projectId === this.currentProjectId);
      const staffCount = floorAgents.length;
      const defaultPositions = [
        { x: -5, z: -3 }, { x: -1.5, z: -3 }, { x: 2, z: -3 }, { x: 5.5, z: -3 },
        { x: -5, z: 1 }, { x: -1.5, z: 1 }, { x: 2, z: 1 }, { x: 5.5, z: 1 },
        { x: -5, z: 5 }, { x: -1.5, z: 5 }, { x: 2, z: 5 }, { x: 5.5, z: 5 },
      ];
      const visiblePositions = floorAgents.map((agent, index) => {
        const customPosition = agent.position3D;
        if (Number.isFinite(customPosition?.x) && Number.isFinite(customPosition?.z)) {
          return { x: Number(customPosition.x), z: Number(customPosition.z) };
        }
        return defaultPositions[index % defaultPositions.length] || { x: 0, z: 0 };
      });
      const target = visiblePositions.length > 0
        ? visiblePositions.reduce((center, position) => ({
            x: center.x + position.x / visiblePositions.length,
            z: center.z + position.z / visiblePositions.length,
          }), { x: 0, z: 0 })
        : { x: 0, z: 0 };
      return {
        distance: staffCount > 6 ? 7.6 : staffCount > 3 ? 7 : 6.4,
        target: { x: target.x, y: 0.4, z: target.z },
      };
    }
    const workspaceCount = Math.max(1, this.workspaces.length);
    return {
      distance: Math.min(11, 6.6 + Math.sqrt(Math.max(0, workspaceCount - 1)) * 1.6),
      target: { x: 0, y: 1, z: 0 },
    };
  }

  /** 按比例调整正交相机视锥；输入缩放因子，将距离限制在可读范围并更新控制器。 */
  _scaleCameraFrustum(factor) {
    if (!this.camera || !Number.isFinite(factor) || factor <= 0) return;
    const currentDistance = Number(this.camera.top || this._getDefaultCameraView().distance);
    const nextDistance = Math.min(14, Math.max(3.2, currentDistance * factor));
    const { width, height } = this._getContainerSize();
    this._applyCameraFrustum(nextDistance, width, height);
    this.controls?.update?.();
  }

  _zoomCamera(targetD, targetLookAt) {
    const THREE = this.THREE;
    if (this._zoomFrame) {
      cancelAnimationFrame(this._zoomFrame);
      this._zoomFrame = null;
    }
    const startPos = this.camera.position.clone();
    
    // We want the camera to look from the SAME relative angle
    const camDirection = new THREE.Vector3(1.4, 1.6, 1.4).normalize();
    const endTarget = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);
    
    // Calculate new position based on the target center and an arbitrary fixed distance
    const dist = 28; 
    const endPos = endTarget.clone().add(camDirection.clone().multiplyScalar(dist));

    const duration = 800;
    const startTime = performance.now();
    const startTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0,0,0);
    const startD = this.camera.top || 10;

    const tween = () => {
      const elapsed = performance.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic

      this.camera.position.lerpVectors(startPos, endPos, ease);
      
      // Update OrbitControls target so it doesn't override us incorrectly
      if (this.controls) {
        this.controls.target.lerpVectors(startTarget, endTarget, ease);
        this.controls.update();
      } else {
        this.camera.lookAt(startTarget.clone().lerp(endTarget, ease));
      }

      // Animate frustum size (zoom)
      const currentD = startD + (targetD - startD) * ease;
      const { width: w, height: h } = this._getContainerSize();
      this._applyCameraFrustum(currentD, w, h);

      if (t < 1 && !this._disposed) {
        this._zoomFrame = requestAnimationFrame(tween);
      } else {
        this._zoomFrame = null;
      }
    };
    this._zoomFrame = requestAnimationFrame(tween);
  }

  // ============== CONTROLS ==============

  _setupControls() {
    const THREE = this.THREE;
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2.5;
      this.controls.minPolarAngle = Math.PI / 6;
      this.controls.enableZoom = true;
      this.controls.zoomSpeed = 0.5;
    }
  }

  // ============== INTERACTION ==============

  _setupInteraction() {
    const THREE = this.THREE;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let clickTimer = null;
    // ─── 拖拽状态机 ───
    // dragState = { mesh, agent, baseY, startClientX, startClientY, moved, suppressClick }
    let dragState = null;
    // 拖拽时用的隐形地平面（y=0）；只在 level 2 启用
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const dragHitPoint = new THREE.Vector3();

    const pickAgent = (clientX, clientY) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, this.camera);
      const meshes = [];
      this._meshMap.forEach((mesh) => {
        mesh.traverse(child => { if (child.isMesh) meshes.push(child); });
      });
      const intersects = raycaster.intersectObjects(meshes, true);
      if (!intersects.length) return null;
      let obj = intersects[0].object;
      while (obj && !obj.userData.type) obj = obj.parent;
      return obj || null;
    };

    const pickFloor = (clientX, clientY) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, this.camera);
      const hit = raycaster.ray.intersectPlane(dragPlane, dragHitPoint);
      return hit ? { x: dragHitPoint.x, z: dragHitPoint.z } : null;
    };

    // ─────── PointerDown：检测是否点中可拖拽角色 ───────
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (this.level !== 2) return; // 只在楼层视图启用拖拽
      if (e.button !== 0) return;   // 仅左键
      const obj = pickAgent(e.clientX, e.clientY);
      if (!obj || !obj.userData.draggable) return;
      // 进入候选拖拽：未真正移动前先不视为 drag，方便单击仍能选中
      dragState = {
        mesh: obj,
        agent: obj.userData.agent,
        baseY: obj.position.y,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
        suppressClick: false,
      };
      this.renderer.domElement.setPointerCapture && this.renderer.domElement.setPointerCapture(e.pointerId);
    });

    // ─────── PointerMove：超过阈值后开始拖动角色 ───────
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      if (!dragState) return;
      if (!dragState.moved) {
        const dx = Math.abs(e.clientX - dragState.startClientX);
        const dy = Math.abs(e.clientY - dragState.startClientY);
        if (dx > 5 || dy > 5) {
          dragState.moved = true;
          dragState.suppressClick = true;
          dragState.mesh.userData.__dragging = true;
          // 关掉 OrbitControls，避免镜头跟着鼠标转
          if (this.controls) this.controls.enabled = false;
          // 抬起一点 + 显示 grab 光标
          dragState.mesh.position.y = dragState.baseY + 0.6;
          this.renderer.domElement.style.cursor = 'grabbing';
        }
      }
      if (dragState.moved) {
        const target = pickFloor(e.clientX, e.clientY);
        if (target) {
          // 限制在 floor 范围内（±9，墙内）
          const clampedX = Math.max(-7.5, Math.min(7.5, target.x));
          const clampedZ = Math.max(-7.5, Math.min(7.5, target.z));
          dragState.mesh.position.x = clampedX;
          dragState.mesh.position.z = clampedZ;
        }
      }
    });

    // ─────── PointerUp：落下角色、触发持久化 callback ───────
    const onPointerEnd = (e) => {
      if (!dragState) return;
      if (this.controls) this.controls.enabled = true;
      this.renderer.domElement.style.cursor = '';
      if (dragState.moved) {
        // 平稳落地
        dragState.mesh.position.y = dragState.baseY;
        dragState.mesh.userData.__dragging = false;
        dragState.mesh.userData.__idle.baseY = dragState.baseY;
        if (this._onAgentMove) {
          this._onAgentMove(dragState.agent, {
            x: dragState.mesh.position.x,
            z: dragState.mesh.position.z,
          });
        }
      }
      const wasMoved = dragState.moved;
      dragState = null;
      // 用 wasMoved 标记接下来的 click 事件需要忽略
      if (wasMoved) {
        this._suppressNextClick = true;
        // 在下一个事件循环清除标记，防止永久卡死
        setTimeout(() => { this._suppressNextClick = false; }, 50);
      }
    };
    this.renderer.domElement.addEventListener('pointerup', onPointerEnd);
    this.renderer.domElement.addEventListener('pointercancel', onPointerEnd);

    // ─────── 普通 click（选中），dblclick（打开详情）───────
    this.renderer.domElement.addEventListener('click', (e) => {
      if (this._suppressNextClick) return; // 拖拽刚结束，吞掉这次 click
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }

      clickTimer = setTimeout(() => {
        clickTimer = null;
        const obj = pickAgent(e.clientX, e.clientY);
        if (!obj) return;
        if (obj.userData.type === 'building' && this._onBuildingClick) {
          this._onBuildingClick(obj.userData.wsId, obj.userData.wsName);
        } else if (obj.userData.type === 'floor' && this._onFloorClick) {
          this._onFloorClick(obj.userData.projectId, obj.userData.projectName);
        } else if (obj.userData.type === 'agent' && this._onAgentClick) {
          this.selectedAgent = obj.userData.agent;
          this._selectedAgentMesh = obj;
          this._onAgentClick(obj.userData.agent);
        }
      }, 250);
    });

    this.renderer.domElement.addEventListener('dblclick', (e) => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      const obj = pickAgent(e.clientX, e.clientY);
      if (obj && obj.userData.type === 'agent' && this._onAgentDblClick) {
        this._onAgentDblClick(obj.userData.agent);
      }
    });

    // 鼠标悬停在可拖拽角色上时切换 grab 光标
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      if (dragState) return; // 拖拽中由上面统一管理
      if (this.level !== 2) return;
      const obj = pickAgent(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor = (obj && obj.userData.draggable) ? 'grab' : '';
    });
  }

  // ============== UI (Fullscreen) ==============

  _createUI() {
    this._fullscreenButton = this.container.querySelector('.enterprise-sandbox-view-tool--fullscreen');
  }

  // ============== ANIMATION LOOP ==============

  _animate() {
    if (this._disposed) return;
    this._animId = requestAnimationFrame(() => this._animate());

    const dt = this._clock.getDelta();
    const t = this._clock.getElapsedTime();

    // Particles drift
    if (this._particleMesh) {
      const pos = this._particleMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.setY(i, pos.getY(i) + Math.sin(t + i) * 0.003);
        pos.setX(i, pos.getX(i) + Math.cos(t * 0.5 + i) * 0.001);
      }
      pos.needsUpdate = true;
    }

    // 角色 idle 动画：每个 character 上挂的 __idle 数据驱动呼吸 + 手臂前后摆动
    if (this._meshMap && this._meshMap.size) {
      this._meshMap.forEach((mesh) => {
        const idle = mesh.userData && mesh.userData.__idle;
        if (!idle) return;
        if (mesh.userData.__dragging) return; // 拖拽时不要叠加动画
        const phase = t * 1.4 + idle.seed;
        // 整体微微起伏（呼吸感）
        const bob = Math.sin(phase) * 0.018;
        mesh.position.y = (idle.baseY || 0) + bob;
        // 双臂左右反向小幅摆动
        if (idle.armPivots && idle.armPivots.length === 2) {
          const swing = Math.sin(phase) * 0.18;
          idle.armPivots[0].rotation.x = swing;
          idle.armPivots[1].rotation.x = -swing;
        }
      });
    }

    if (this.controls && this.controls.update) this.controls.update();
    this._updateLabels();
    this.renderer.render(this.scene, this.camera);
  }
}

// Export
if (typeof window !== 'undefined') window.Enterprise3DScene = Enterprise3DScene;
