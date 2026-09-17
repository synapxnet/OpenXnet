/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 企业多场景三维沙盘 / Enterprise sandbox with original spatial presentations.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */

class Enterprise3DScene {
  /** 初始化三层企业实体、原创场景与既有交互。 / Initialize three enterprise levels, original scenery and existing interaction. */
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
    this._isZh = options.isZh !== false;
    this._presentationStyle = ['studio', 'atrium', 'command'].includes(options.presentationStyle) ? options.presentationStyle : 'studio';
    this._sceneMaterials = new Map();
    this._motionPreference = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

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

  /** 返回经过白名单验证的场景风格。 / Return the allowlisted presentation style. */
  getPresentationStyle() { return ['studio', 'atrium', 'command'].includes(this._presentationStyle) ? this._presentationStyle : 'studio'; }

  /** 离屏构建新场景后原子替换，保留取景、选择与实际员工坐标。 / Stage new scenery before replacement, retaining the camera, selection and actual staff coordinates. */
  setPresentationStyle(id) {
    if (this._disposed || !['studio', 'atrium', 'command'].includes(id)) return false;
    if (id === this.getPresentationStyle()) return true;
    const THREE = this.THREE;
    const previous = { style: this.getPresentationStyle(), scene: this.scene, meshes: this._meshMap, labels: this._labelEls, materials: this._sceneMaterials, bounds: this._viewBounds, fit: this._lastFitDistance, selection: this._selectionRing, selectedMesh: this._selectedAgentMesh, floorLimits: this._floorLimits, workspaceId: this.currentWsId };
    const staged = new THREE.Scene();
    this._presentationStyle = id; this.scene = staged; this._meshMap = new Map(); this._labelEls = []; this._sceneMaterials = new Map(); this._selectionRing = null; this._selectedAgentMesh = null;
    try {
      if (this.level === 0) this._buildCityView();
      else if (this.level === 1) this._buildBuildingView(this.currentWsId);
      else if (this.level === 2) this._buildFloorView(this.currentProjectId);
      else throw new Error('Enterprise3D: unsupported level');
      // 拖动后的在屏位置可以先于数据持久化，表现切换不得把它重置。 / On-screen drag positions may precede persistence and must survive presentation changes.
      for (const [key, mesh] of this._meshMap) {
        const old = previous.meshes.get(key);
        if (mesh.userData.type === 'agent' && old) {
          mesh.position.x = old.position.x; mesh.position.z = old.position.z; mesh.rotation.y = old.rotation.y;
          if (this.selectedAgent?.id === mesh.userData.agent?.id) this._selectedAgentMesh = mesh;
        }
      }
    } catch (error) {
      this._disposeObjects(staged.children, this._sceneMaterials); this._clearLabels();
      this._presentationStyle = previous.style; this.scene = previous.scene; this._meshMap = previous.meshes; this._labelEls = previous.labels; this._sceneMaterials = previous.materials;
      this._viewBounds = previous.bounds; this._lastFitDistance = previous.fit; this._selectionRing = previous.selection; this._selectedAgentMesh = previous.selectedMesh; this._floorLimits = previous.floorLimits; this.currentWsId = previous.workspaceId;
      console.warn('Enterprise3D presentation switch failed:', error); return false;
    }
    this._cancelPointerInteraction?.();
    if (this._zoomFrame) { cancelAnimationFrame(this._zoomFrame); this._zoomFrame = null; }
    this.scene = previous.scene;
    const oldObjects = this.scene.children.filter(child => child !== this._ground && !(child instanceof THREE.Light));
    this._disposeObjects(oldObjects, previous.materials); oldObjects.forEach(object => this.scene.remove(object));
    previous.labels.forEach(({ el }) => el.remove());
    [...staged.children].forEach(object => this.scene.add(object));
    previous.materials?.clear();
    // 不调用镜头过渡或controls.update，避免改变仍在阻尼中的观察方向。 / Skip camera transitions and control updates to retain the exact current view.
    this._lastFitDistance = this._getDefaultCameraView().distance;
    this._applySkin(); this._updateLabels();
    return true;
  }

  /** 投影当前可见公共实体，虚拟米仅为旧布局的表现约定而非物理测量。 / Project visible public entities; virtual meters are a legacy-layout convention rather than physical measurements. */
  getSpatialSnapshot() {
    const entities = [];
    if (!this._disposed) {
      this.scene?.updateMatrixWorld?.(true);
      for (const mesh of this._meshMap?.values() || []) {
        const data = mesh.userData || {}; let source; let type; let parentId = null;
        if (data.type === 'building') { source = { id: data.wsId, name: data.wsName }; type = 'workspace'; }
        else if (data.type === 'floor') { source = { id: data.projectId, name: data.projectName }; type = 'project'; parentId = this.projects.find(project => project.id === data.projectId)?.workspaceId || this.currentWsId || null; }
        else if (data.type === 'agent') { source = data.agent; type = 'staff'; parentId = source?.projectId || source?.assignedWorkspace || null; }
        else continue;
        if (!source || !['string', 'number'].includes(typeof source.id)) continue;
        const id = String(source.id);
        if (!id || id.length > 512 || /[\u0000-\u001f\u007f]/.test(id)) continue;
        let visible = true;
        for (let ancestor = mesh; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) { visible = false; break; }
        if (!visible) continue;
        const position = mesh.getWorldPosition(new this.THREE.Vector3());
        if (![position.x, position.y, position.z].every(Number.isFinite)) continue;
        entities.push({ id, type, name: String(source.name || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 160), parentId: parentId == null ? null : String(parentId), position: { x: position.x, y: position.y, z: position.z } });
        if (entities.length >= 2000) break;
      }
    }
    return { schema: 'openxnet.enterprise-spatial-snapshot.v1', schemaVersion: 1, style: this.getPresentationStyle(),
      coordinateSystem: { units: 'meters', upAxis: 'Y', handedness: 'right', frameId: 'openxnet-enterprise-local', source: 'legacy_layout', metersPerLegacyUnit: 1, measured: false },
      level: this.level, workspaceId: this.currentWsId ?? null, projectId: this.currentProjectId ?? null, entities };
  }

  /** 提供原创材质配色，产品浮层继续由全局皮肤管理。 / Provide original material palettes while global skins continue to control product overlays. */
  _getPresentationPalette() {
    const palettes = {
      studio: { stone: 0xe8edf2, floor: 0xf9fafb, wall: 0xf1f5fa, frame: 0xb3c4d4, accent: 0x2588cf, glass: 0x79bfe7, dark: 0x32475b, wood: 0xc8af90, fabric: 0x91b9d0 },
      atrium: { stone: 0xd9d5cc, floor: 0xc8ae89, wall: 0xece7dd, frame: 0x876949, accent: 0x2b95bd, glass: 0xafdae6, dark: 0x41505b, wood: 0xb88c5f, fabric: 0xc8d9e0 },
      command: { stone: 0x202d3d, floor: 0x2e4053, wall: 0x243448, frame: 0x526f89, accent: 0x34bee7, glass: 0x487b9c, dark: 0x172434, wood: 0x425972, fabric: 0x68869e },
    };
    return palettes[this.getPresentationStyle()];
  }

  /** 按当前场景复用有界材质，切换时随旧对象一同释放。 / Reuse bounded materials within the current presentation and dispose them with its objects. */
  _presentationMaterial(kind, color) {
    if (!this._sceneMaterials) this._sceneMaterials = new Map();
    const palette = this._getPresentationPalette();
    const value = color ?? palette[kind] ?? palette.stone;
    const key = `${kind}:${value}`;
    if (!this._sceneMaterials.has(key)) {
      const properties = kind === 'glass' ? { roughness: 0.13, metalness: 0.18, transparent: true, opacity: this.getPresentationStyle() === 'studio' ? 0.49 : 0.4, depthWrite: false, side: this.THREE.DoubleSide }
        : kind === 'frame' ? { roughness: 0.35, metalness: 0.55 }
        : kind === 'light' ? { roughness: 0.4, emissive: value, emissiveIntensity: 0.48 }
        : kind === 'wood' ? { roughness: 0.88, metalness: 0 }
        : { roughness: 0.69, metalness: 0.035 };
      this._sceneMaterials.set(key, new this.THREE.MeshStandardMaterial({ color: value, ...properties }));
    }
    return this._sceneMaterials.get(key);
  }

  /** 创建可复用圆桌、基座或种植池，不依赖外部素材。 / Create round tables, pedestals or planters without external assets. */
  _presentationCylinder(parent, radius, height, position, material, vertices = 40) {
    const mesh = new this.THREE.Mesh(new this.THREE.CylinderGeometry(radius, radius, height, vertices), material);
    mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

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

  /** 仅显式切换沙盘全屏时同步窗口；sync the native window only for an explicit sandbox fullscreen toggle. */
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
    const fittedView = this._getDefaultCameraView();
    const fittedDistance = fittedView.distance;
    if (this._zoomFrame) {
      this._zoomCamera(fittedDistance, fittedView.target);
      this.renderer.setSize(w, h, false);
      return;
    }
    const distance = this._lastFitDistance ? this.camera.top * fittedDistance / this._lastFitDistance : fittedDistance;
    this._lastFitDistance = fittedDistance;
    this._applyCameraFrustum(distance, w, h);
    this.renderer.setSize(w, h, false); // false: 不写 inline width/height，让 CSS 100% 接管，避免 1px 取整白缝
  }

  /** 清理场景而不改变用户窗口状态；dispose scene resources without changing the user's native window state. */
  dispose() {
    this._disposed = true;
    this._unbindSkinUpdates();
    if (this._animId) cancelAnimationFrame(this._animId);
    if (this._zoomFrame) cancelAnimationFrame(this._zoomFrame);
    this._setFullscreenState(false, { updateWindow: false });
    window.removeEventListener('resize', this._resizeHandler);
    this._resizeObserver?.disconnect();
    this.controls?.dispose();
    this._clearScene();
    this._disposeObjects(this.scene.children);
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

    const aspect = w / h;
    const d = 10;
    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
    this.camera.position.set(14, 16, 14);
    this.camera.lookAt(2, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(w, h, false); // false: 不写 inline width/height，让 CSS 100% 接管，避免 1px 取整白缝
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;position:absolute;top:0;left:0;';
    this.container.insertBefore(this.renderer.domElement, this.labelOverlay);

    // Lighting
    this._ambientLight = new THREE.HemisphereLight(0xf4faff, 0x8193ad, 2.4);
    this.scene.add(this._ambientLight);
    const mainLight = new THREE.DirectionalLight(0xfff5e9, 3.2);
    this._mainLight = mainLight;
    mainLight.position.set(-10, 22, 12);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.set(2048, 2048);
    mainLight.shadow.camera.left = -25; mainLight.shadow.camera.right = 25;
    mainLight.shadow.camera.top = 25; mainLight.shadow.camera.bottom = -25;
    mainLight.shadow.normalBias = 0.035;
    mainLight.shadow.bias = -0.00015;
    mainLight.shadow.radius = 3;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0xe3efff, 1.15);
    this._fillLight = fillLight;
    fillLight.position.set(10, 9, -8);
    this.scene.add(fillLight);

    this._createGround();
    this._bindSkinUpdates();
    this._setupControls();
    this._setupInteraction();
    this._createUI();
    this.showCityView();
    this._animate();

    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(this._resizeHandler);
      this._resizeObserver.observe(this.container);
    }

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

  /** 读取皮肤背景；首次进入从页面变量恢复，事件缺少颜色时保留同一回退规则。 */
  _resolveSkinAppearance(detail = {}) {
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    const theme = root?.getAttribute('data-theme') || '';
    const mode = detail?.mode === 'dark' || detail?.mode === 'light'
      ? detail.mode
      : (['dark', 'midnight', 'neon', 'ink'].includes(theme) ? 'dark' : 'light');
    const computedBackground = root && typeof window.getComputedStyle === 'function'
      ? window.getComputedStyle(root).getPropertyValue('--ox-bg-base').trim()
      : '';
    const fallback = mode === 'dark' ? '#111b29' : '#f4f8fb';
    const background = [detail?.background, computedBackground, fallback]
      .find(value => typeof value === 'string' && /^(#[\da-f]{3}(?:[\da-f]{3})?|(?:rgb|hsl)a?\([^)]*\))$/i.test(value.trim()))
      .trim();
    return { mode, background, color: new this.THREE.Color(background) };
  }

  /** 更新背景和少量环境曝光；不重建场景、不修改建筑与人物材质。 */
  _applySkin(detail) {
    if (this._disposed || !this.scene || !this.renderer) return;
    const appearance = this._resolveSkinAppearance(detail);
    if (this.scene.background?.isColor) this.scene.background.copy(appearance.color);
    else this.scene.background = appearance.color;
    this.renderer.setClearColor(appearance.color, 1);
    // 远景地面覆盖视口，需与清屏背景一同变化，楼层和人物仍保留日光色。
    this._groundBackdropMaterial?.color.copy(appearance.color);
    const dark = appearance.mode === 'dark';
    this.renderer.toneMappingExposure = dark ? 1.12 : 1.2;
    if (this._ambientLight) this._ambientLight.intensity = dark ? 2.25 : 2.4;
    if (this._mainLight) this._mainLight.intensity = dark ? 3.0 : 3.2;
    if (this._fillLight) this._fillLight.intensity = dark ? 1.08 : 1.15;
  }

  /** 一份场景只订阅一次皮肤事件，并立即应用当前皮肤。 */
  _bindSkinUpdates() {
    this._unbindSkinUpdates();
    if (this._disposed) return;
    this._skinAppliedHandler = event => this._applySkin(event.detail);
    window.addEventListener('openxnet-skin-applied', this._skinAppliedHandler);
    this._applySkin();
  }

  /** 释放订阅，防止离开沙盘后的皮肤切换继续访问已释放的渲染器。 */
  _unbindSkinUpdates() {
    if (!this._skinAppliedHandler) return;
    window.removeEventListener('openxnet-skin-applied', this._skinAppliedHandler);
    this._skinAppliedHandler = null;
  }

  /** 读取当前可见 3D 视口尺寸；聊天分屏时优先采用画布实际宽度。 */
  _getContainerSize() {
    const viewportElement = this.renderer?.domElement || this.container;
    const rect = viewportElement.getBoundingClientRect ? viewportElement.getBoundingClientRect() : null;
    const width = Math.max(1, Math.round((rect && rect.width) || viewportElement.clientWidth || this.container.clientWidth || 960));
    const height = Math.max(1, Math.round((rect && rect.height) || this.container.clientHeight || 540));
    return { width, height };
  }

  /** 更新页面全屏样式，清理和重复状态不触发窗口操作；update page fullscreen styles without window actions on cleanup or repeated state. */
  _setFullscreenState(active, { updateWindow = true } = {}) {
    const changed = this._isFullscreen !== Boolean(active);
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

    if (updateWindow && changed && window.electronAPI && typeof window.electronAPI.windowAction === 'function') {
      const fullscreenRequest = window.electronAPI.windowAction(this._isFullscreen ? 'enter-fullscreen' : 'exit-fullscreen');
      if (fullscreenRequest && typeof fullscreenRequest.catch === 'function') {
        fullscreenRequest.catch((error) => console.warn('Enterprise3D fullscreen window action failed:', error));
      }
    }

    if (this._fullscreenButton) {
      this._fullscreenButton.innerHTML = this._isFullscreen
        ? '<i class="fa-solid fa-compress"></i>'
        : '<i class="fa-solid fa-expand"></i>';
      this._fullscreenButton.title = this._isFullscreen
        ? (this._isZh ? '退出全屏' : 'Exit fullscreen')
        : (this._isZh ? '全屏显示' : 'Enter fullscreen');
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
      set(el, 'background', 'var(--ox-bg-base, #f4f8fb)');
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
    set(root, 'inset', '0');
    set(root, 'top', '0');
    set(root, 'left', '0');
    set(root, 'right', '0');
    set(root, 'bottom', '0');
    set(root, 'z-index', '2147483000');
    set(root, 'width', '100vw');
    set(root, 'height', '100dvh');
    set(root, 'min-height', '100dvh');
    set(root, 'max-width', 'none');
    set(root, 'margin', '0');
    set(root, 'padding', '0');
    set(root, 'border', '0');
    set(root, 'outline', '0');
    set(root, 'border-radius', '0');
    set(root, 'background', 'var(--ox-bg-base, #f4f8fb)');
    set(root, 'box-shadow', 'none');
    set(root, 'overflow', 'hidden');
    set(root, 'transform', 'none');
    set(root, 'box-sizing', 'border-box');

    set(stage, 'position', 'relative');
    set(stage, 'inset', '0');
    set(stage, 'width', '100%');
    set(stage, 'height', '100%');
    set(stage, 'min-height', '0');
    set(stage, 'margin', '0');
    set(stage, 'padding', '0');
    set(stage, 'border', '0');
    set(stage, 'border-radius', '0');
    set(stage, 'background', 'var(--ox-bg-base, #f4f8fb)');
    set(stage, 'overflow', 'hidden');
    set(stage, 'box-sizing', 'border-box');

    set(canvas, 'position', 'absolute');
    set(canvas, 'inset', '0');
    set(canvas, 'width', '100%');
    set(canvas, 'height', '100%');
    set(canvas, 'display', 'block');
    set(canvas, 'background', 'var(--ox-bg-base, #f4f8fb)');
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

    // 兜底白边消除：给 html / body / shell 使用当前皮肤背景；
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
      htmlEl.style.setProperty('background', 'var(--ox-bg-base, #f4f8fb)', 'important');
      htmlEl.style.setProperty('margin', '0', 'important');
      htmlEl.style.setProperty('padding', '0', 'important');
      bodyEl.style.setProperty('background', 'var(--ox-bg-base, #f4f8fb)', 'important');
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
    this._groundBackdropMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 1 });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      this._groundBackdropMaterial
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this._ground.add(ground);
    this.scene.add(this._ground);
  }

  // ============== LEVEL 0: CITY VIEW ==============

  /** 按真实工作空间创建园区，各风格保留同一实体布局。 / Build the campus from actual workspaces with the same entity layout across presentations. */
  _buildCityView() {
    const wsTypeStyles = {
      local:  { color: 0x328ed0, accent: '#2588cf' },
      docker: { color: 0x567ca7, accent: '#426a94' },
      cloud:  { color: 0x59adca, accent: '#3298bc' },
      server: { color: 0xbd8269, accent: '#a76750' },
      vm:     { color: 0x8b8bc4, accent: '#7777ad' },
    };
    const count = Math.max(1, this.workspaces.length);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const spacing = 9;
    this._campusSize = { width: cols * spacing + 2, depth: rows * spacing + 2 };
    this._createRoads();
    this._createDecorations();
    let maxHeight = 3;
    this.workspaces.forEach((ws, i) => {
      const row = Math.floor(i / cols);
      const rowCount = Math.min(cols, count - row * cols);
      const x = (i % cols - (rowCount - 1) / 2) * spacing;
      const z = (row - (rows - 1) / 2) * spacing;
      const floors = this.projects.filter(p => p.workspaceId === ws.id).length;
      const style = wsTypeStyles[ws.type] || wsTypeStyles.local;
      const buildingHeight = Math.max(2, Math.min(floors, 8)) * 1.05 + 0.7;
      maxHeight = Math.max(maxHeight, buildingHeight + 1.5);
      const building = this._createBuilding(x, z, buildingHeight, style.color, ws.name, style.accent, floors);
      building.userData = { type: 'building', wsId: ws.id, wsName: ws.name };
      this._meshMap.set('ws-' + ws.id, building);
      const agentCount = this.agents.filter(a => a.assignedWorkspace === ws.id).length;
      const summary = this._isZh ? `${floors} 个项目 · ${agentCount} 名员工` : `${floors} projects · ${agentCount} staff`;
      this._addLabel(x, buildingHeight + 1.05, z, ws.name, style.accent, summary);
    });
    this._viewBounds = new this.THREE.Box3(
      new this.THREE.Vector3(-this._campusSize.width / 2, 0, -this._campusSize.depth / 2),
      new this.THREE.Vector3(this._campusSize.width / 2, maxHeight, this._campusSize.depth / 2)
    );
  }

  /** 用建筑剖面、木廊露台或石墨任务舱表现同一工作空间。 / Represent one workspace as a stone cutaway, timber terraces or graphite command modules. */
  _createBuilding(x, z, height, color, name, accent, floors) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const style = this.getPresentationStyle();
    const palette = this._getPresentationPalette();
    const stone = this._presentationMaterial('stone'); const frame = this._presentationMaterial('frame');
    const wood = this._presentationMaterial('wood'); const glazing = this._presentationMaterial('glass');
    const accentMaterial = this._presentationMaterial('light', palette.accent);
    group.name = `presentation-${style}-workspace`;
    this._studioBox(group, [6.8, 0.22, 6.5], [0, 0.05, 0], stone);
    this._studioBox(group, [6.45, 0.08, 6.15], [0, 0.19, 0], this._presentationMaterial('floor'));
    const levels = Math.max(2, Math.min(floors, 8));
    for (let f = 0; f < levels; f++) {
      const y = 0.32 + f * 1.05;
      if (style === 'atrium') {
        const terrace = f % 2 ? -0.25 : 0.25;
        this._studioBox(group, [5.25, 0.15, 4.55], [terrace, y, -0.2], wood);
        this._studioBox(group, [4.8, 0.055, 0.055], [terrace, y + 0.61, 2.02], frame);
        for (const post of [-2.12, 0, 2.12]) this._studioBox(group, [0.055, 0.56, 0.055], [post, y + 0.32, 2.02], frame);
        this._studioBox(group, [1.25, 0.22, 0.55], [-1.63, y + 0.16, 1.35], stone);
        this._studioPlant(group, -1.63, y + 0.25, 1.35, 0.48);
        this._presentationCylinder(group, 0.56, 0.09, [1.1, y + 0.43, 0.1], this._presentationMaterial('floor'));
        this._presentationCylinder(group, 0.13, 0.38, [1.1, y + 0.22, 0.1], frame, 16);
      } else if (style === 'command') {
        this._studioBox(group, [5.05, 0.21, 4.45], [0, y, -0.2], frame);
        this._studioBox(group, [4.8, 0.88, 0.25], [0, y + 0.54, -2.18], stone);
        this._studioBox(group, [0.38, 0.85, 4.18], [-2.35, y + 0.51, -0.2], stone);
        this._studioBox(group, [4.65, 0.04, 0.06], [0, y + 0.12, 2.03], accentMaterial);
        for (const screenX of [-1.25, 1.15]) this._presentationScreen(group, screenX, y + 0.57, -1.98, 1.48, 0.63);
        this._studioBox(group, [2.3, 0.16, 0.75], [0.3, y + 0.41, 0.45], frame);
        this._studioBox(group, [2.05, 0.025, 0.5], [0.3, y + 0.505, 0.45], this._presentationMaterial('glass'));
      } else {
        this._studioBox(group, [5.15, 0.15, 4.55], [0, y, -0.2], this._presentationMaterial('floor'));
        this._studioBox(group, [4.9, 0.88, 0.16], [0, y + 0.52, -2.22], stone);
        this._studioBox(group, [0.13, 0.88, 4.26], [-2.42, y + 0.52, -0.15], stone);
        this._studioBox(group, [1.72, 0.74, 0.035], [-1.37, y + 0.49, 1.94], glazing);
        this._studioBox(group, [0.035, 0.75, 3.62], [2.43, y + 0.5, -0.18], glazing);
        for (const deskX of [-1.25, 0.45]) this._studioDesk(group, deskX, y + 0.1, -0.6, 0.43, color);
        this._studioBox(group, [0.055, 0.8, 0.055], [-0.45, y + 0.5, 1.95], frame);
      }
    }
    for (const px of [-2.42, 2.42]) this._studioBox(group, [0.17, height, 0.17], [px, height / 2 + 0.2, -2.14], style === 'atrium' ? wood : frame);
    if (style === 'atrium') {
      for (let beam = -2.3; beam <= 2.4; beam += 0.65) this._studioBox(group, [0.15, 0.14, 4.6], [beam, height + 0.2, -0.15], wood);
      this._studioPlant(group, 2.78, 0.23, 1.8, 0.9);
    } else {
      this._studioBox(group, [5.25, 0.22, 1.3], [0, height + 0.18, -1.62], stone);
      this._studioBox(group, [4.82, 0.05, 0.08], [0, height + 0.32, -0.97], accentMaterial);
      if (style === 'command') for (const px of [-2.62, 2.62]) this._studioBox(group, [0.26, height + 0.5, 0.6], [px, height / 2 + 0.2, -1.7], frame);
      else this._studioPlant(group, -2.86, 0.23, 1.8, 0.78);
    }
    this._studioBox(group, [2.35, 0.1, 0.55], [0.2, 0.22, 2.85], this._presentationMaterial('floor'));
    this._studioBox(group, [1.6, 0.55, 0.1], [0.2, 0.56, 2.25], this._presentationMaterial('frame', color));
    this.scene.add(group);
    return group;
  }

  // ============== LEVEL 1: BUILDING INTERIOR ==============

  /** 构建可检查的项目剖面，保持项目与员工的原始身份。 / Build inspectable project sections while preserving project and staff identities. */
  _buildBuildingView(wsId) {
    const THREE = this.THREE;
    const ws = this.workspaces.find(w => w.id === wsId);
    if (!ws) return;
    const projects = this.projects.filter(p => p.workspaceId === wsId);
    const count = Math.max(1, projects.length);
    const height = count * 3.15;
    const style = this.getPresentationStyle(); const palette = this._getPresentationPalette();
    const frame = this._presentationMaterial('frame'); const stone = this._presentationMaterial('stone'); const wood = this._presentationMaterial('wood');
    const building = new THREE.Group();
    building.name = `presentation-${style}-projects`;
    this.scene.add(building);
    this._studioBox(building, [10.6, 0.3, 8.8], [0, 0, 0], stone);
    if (style !== 'atrium') {
      this._studioBox(building, [10, height + 0.5, 0.18], [0, height / 2, -3.8], this._presentationMaterial('wall'));
      this._studioBox(building, [0.2, height + 0.5, 4.1], [-4.9, height / 2, -1.8], stone);
    }
    for (let i = 0; i < count; i++) {
      const y = i * 3.15 + 0.18;
      const project = projects[i];
      const color = project?.color || '#2588cf';
      const floor = new THREE.Group();
      floor.position.y = y;
      this._studioBox(floor, [10, 0.22, 8], [0, 0, 0], style === 'atrium' ? wood : this._presentationMaterial('floor'));
      this._studioBox(floor, [10, 0.13, 0.12], [0, -0.04, 4.04], color);
      this._studioBox(floor, [1.85, 2.8, 0.1], [-3.85, 1.5, -3.68], this._presentationMaterial('frame', color));
      if (style === 'command') {
        for (let panel = 0; panel < 3; panel++) this._presentationScreen(floor, -1.2 + panel * 2.28, 1.78, -3.59, 2.1, 1.42);
        this._studioBox(floor, [9.7, 0.035, 0.1], [0, 2.85, -3.5], this._presentationMaterial('light', palette.accent));
      } else if (style === 'atrium') {
        for (const post of [-4.6, 4.6]) this._studioBox(floor, [0.18, 2.85, 0.18], [post, 1.5, 3.5], wood);
        for (let beam = -4.5; beam <= 4.6; beam += 1.15) this._studioBox(floor, [0.13, 0.15, 2.2], [beam, 2.94, -2.5], wood);
        for (let plank = -4.6; plank < 5; plank += 0.55) this._studioBox(floor, [0.014, 0.012, 7.8], [plank, 0.117, 0], this._presentationMaterial('wood', 0xa27b53));
        this._studioPlant(floor, 1.6, 0.12, -3.2, 1.15);
      } else {
        this._studioBox(floor, [6.7, 1.7, 0.045], [0.8, 1.75, -3.56], this._presentationMaterial('glass'));
        for (let j = 0; j < 6; j++) this._studioBox(floor, [0.045, 1.76, 0.08], [-2.5 + j * 1.33, 1.75, -3.49], frame);
      }
      const staff = project ? this.agents.filter(a => a.projectId === project.id) : [];
      if (style === 'studio' && !staff.length) this._presentationEmptyFloorLounge(floor);
      for (let j = 0; j < Math.min(6, Math.max(3, staff.length)); j++) {
        const x = -2.9 + j % 3 * 2.8;
        const z = style === 'studio' && !staff.length ? 0.85 : -1.8 + Math.floor(j / 3) * 3.15;
        this._studioDesk(floor, x, 0.12, z, 0.86, color);
        if (staff[j]) {
          const agent = staff[j];
          const figure = this._createCharacterFigure({ bodyType: agent.bodyType || 'default', scale: 0.88 });
          figure.position.set(x + 0.62, 0.12, z + 1.12);
          figure.rotation.y = 0.22;
          Object.assign(figure.userData, { type: 'agent', agent });
          figure.userData.__idle.baseY = 0.12;
          floor.add(figure);
          this._meshMap.set('agent-' + agent.id, figure);
        }
      }
      this._studioPlant(floor, 4.15, 0.12, -2.8, 0.9);
      if (project) {
        floor.userData = { type: 'floor', projectId: project.id, projectName: project.name };
        this._meshMap.set('floor-' + project.id, floor);
        this._studioSign(floor, String(project.floor || i + 1).padStart(2, '0'), [-3.85, 1.95, -3.58], 0.85, '#ffffff', color);
      }
      building.add(floor);
    }
    // The front and right side stay open so every project remains inspectable.
    for (const x of [-4.85, 4.85]) {
      this._studioBox(building, [0.18, height + 0.35, 0.18], [x, height / 2, -3.85], style === 'atrium' ? wood : frame);
    }
    this._studioBox(building, [10.1, 0.14, 0.52], [0, height + 0.25, -3.65], style === 'atrium' ? wood : stone);
    this._studioPlant(building, -5.5, 0, 3.2, 1.15);
    this._viewBounds = new THREE.Box3(new THREE.Vector3(-6.2, 0, -4.6), new THREE.Vector3(5.4, height + 0.8, 4.6));
  }

  // ============== LEVEL 2: FLOOR VIEW ==============

  /** 按真实成员位置生成项目房间，三种表现共享员工与拖动范围。 / Build project rooms from actual staff positions, sharing staff and drag bounds across presentations. */
  _buildFloorView(projectId) {
    const THREE = this.THREE;
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;
    this.currentWsId = project.workspaceId;
    const staff = this.agents.filter(a => a.projectId === projectId);
    const rows = Math.max(2, Math.ceil(staff.length / 4));
    const depth = Math.max(16, rows * 3.8 + 5);
    const positions = staff.map((agent, i) => {
      const custom = agent.position3D;
      return Number.isFinite(custom?.x) && Number.isFinite(custom?.z)
        ? { x: custom.x, z: custom.z, custom: true }
        : { x: -5.6 + (i % 4) * 3.65, z: -1.5 + Math.floor(i / 4) * 3.8 - (rows - 2) * 1.9, custom: false };
    });
    const halfX = Math.max(9, ...positions.map(p => Math.abs(p.x) + 1.5));
    const halfZ = Math.max(depth / 2, ...positions.map(p => Math.abs(p.z) + 2));
    this._floorLimits = { x: halfX - 0.8, z: halfZ - 0.8 };
    const room = new THREE.Group();
    this.scene.add(room);
    const color = project.color || '#2588cf';
    this._createPresentationRoom(room, halfX, halfZ, color);

    const deskCount = Math.max(4, staff.length);
    if (this.getPresentationStyle() === 'studio') {
      const rug = this._presentationMaterial('fabric', 0xc7dce9);
      for (let row = 0; row < Math.ceil(deskCount / 4); row++) for (let pair = 0; pair < 2; pair++) {
        this._studioBox(room, [6.78, 0.01, 3.05], [-4.225 + pair * 7.3, 0.239, -2.2 + row * 3.8 - (rows - 2) * 1.9], rug);
      }
    }
    for (let i = 0; i < deskCount; i++) {
      const pos = positions[i] || { x: -5.6 + i % 4 * 3.65, z: -1.5, custom: false };
      const deskX = -5.6 + i % 4 * 3.65;
      const deskZ = -1.5 + Math.floor(i / 4) * 3.8 - (rows - 2) * 1.9;
      this._studioDesk(room, deskX - 0.45, 0.24, deskZ - 1.15, 1.05, color);
      const agent = staff[i];
      if (!agent) continue;
      const figure = this._createCharacterFigure({ bodyType: agent.bodyType || 'default', scale: 1.18 });
      figure.position.set(pos.x, 0.24, pos.z);
      figure.rotation.y = i % 2 === 0 ? 0.28 : -0.16;
      Object.assign(figure.userData, { type: 'agent', agent, draggable: true });
      figure.userData.__idle.baseY = 0.24;
      room.add(figure);
      this._meshMap.set('agent-' + agent.id, figure);
      this._addLabel(pos.x, 2.9, pos.z, agent.name, color, agent.department || '', figure);
    }
    const selection = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.58, 48),
      new THREE.MeshBasicMaterial({ color: this._getPresentationPalette().accent, side: THREE.DoubleSide, depthWrite: false })
    );
    selection.rotation.x = -Math.PI / 2;
    selection.visible = false;
    room.add(selection);
    this._selectionRing = selection;
    this._viewBounds = new THREE.Box3(new THREE.Vector3(-halfX - 0.4, 0, -halfZ - 0.4), new THREE.Vector3(halfX + 0.4, 4.15, halfZ + 0.4));
  }

  /** 创建三种明确不同的房间结构，员工通道保持开放。 / Create three distinct room structures while keeping staff circulation open. */
  _createPresentationRoom(room, halfX, halfZ, color) {
    const style = this.getPresentationStyle(); const palette = this._getPresentationPalette();
    const stone = this._presentationMaterial('stone'); const floor = this._presentationMaterial('floor');
    const frame = this._presentationMaterial('frame'); const wood = this._presentationMaterial('wood');
    const glow = this._presentationMaterial('light', palette.accent);
    room.name = `presentation-${style}-room`;
    this._studioBox(room, [halfX * 2, 0.35, halfZ * 2], [0, -0.025, 0], stone);
    this._studioBox(room, [halfX * 2 - 0.1, 0.08, halfZ * 2 - 0.1], [0, 0.19, 0], style === 'atrium' ? wood : floor);
    this._studioBox(room, [halfX * 2 - 0.3, 0.045, 0.09], [0, 0.145, halfZ - 0.03], style === 'command' ? glow : frame);
    if (style === 'atrium') {
      const planks = Math.min(64, Math.ceil(halfX * 2 / 0.48));
      for (let i = 1; i < planks; i++) this._studioBox(room, [0.017, 0.012, halfZ * 2 - 0.15], [-halfX + i * halfX * 2 / planks, 0.238, 0], this._presentationMaterial('wood', 0x9f774f));
      for (const x of [-halfX + 0.35, 0.1, halfX - 0.35]) {
        this._studioBox(room, [0.22, 3.65, 0.22], [x, 2.02, -halfZ + 0.5], wood);
        this._studioBox(room, [0.22, 3.65, 0.22], [x, 2.02, -halfZ + 3.35], wood);
      }
      for (const z of [-halfZ + 0.5, -halfZ + 3.35]) this._studioBox(room, [halfX * 2, 0.22, 0.22], [0, 3.84, z], wood);
      const beams = Math.min(28, Math.ceil(halfX * 2 / 0.8));
      for (let beam = 0; beam < beams; beam++) this._studioBox(room, [0.14, 0.16, 3.3], [-halfX + 0.3 + beam * (halfX * 2 - 0.6) / Math.max(1, beams - 1), 3.98, -halfZ + 1.93], wood);
      this._presentationCylinder(room, 1.48, 0.36, [halfX - 2.4, 0.41, -halfZ + 1.98], stone);
      this._presentationCylinder(room, 1.35, 0.035, [halfX - 2.4, 0.605, -halfZ + 1.98], this._presentationMaterial('wood', 0x7d765a));
      this._studioPlant(room, halfX - 2.4, 0.61, -halfZ + 1.98, 1.55);
      this._presentationMeeting(room, -halfX + 3.3, -halfZ + 2.05, color, false);
      this._studioBox(room, [2.9, 0.48, 0.8], [0, 0.5, -halfZ + 1], this._presentationMaterial('fabric'));
      this._studioBox(room, [2.9, 0.7, 0.16], [0, 0.87, -halfZ + 0.66], this._presentationMaterial('fabric'));
      this._studioSign(room, 'OPENXNET', [-halfX + 3.3, 2.84, -halfZ + 0.42], 3.2, '#ffffff', palette.accent);
      this._studioPlant(room, -halfX + 0.65, 0.24, halfZ - 1.2, 1.28);
      for (const z of [-halfZ + 4.8, 0.5, halfZ - 1.2]) {
        this._studioBox(room, [0.62, 0.44, 1.65], [halfX - 0.58, 0.46, z], stone);
        this._studioPlant(room, halfX - 0.58, 0.64, z, 0.56);
      }
    } else if (style === 'command') {
      this._studioBox(room, [halfX * 2, 3.1, 0.28], [0, 1.77, -halfZ], this._presentationMaterial('wall'));
      this._studioBox(room, [0.3, 2.85, halfZ + 1.8], [-halfX, 1.65, -halfZ / 2 + 0.9], stone);
      this._studioBox(room, [halfX * 2 - 0.2, 0.09, 0.2], [0, 3.3, -halfZ + 0.2], glow);
      for (const x of [-halfX + 0.3, halfX - 0.3]) {
        this._studioBox(room, [0.3, 3.5, 0.5], [x, 1.95, -halfZ + 0.45], frame);
        this._studioBox(room, [0.045, 2.8, 0.025], [x + 0.17, 1.94, -halfZ + 0.72], glow);
      }
      for (let panel = 0; panel < 3; panel++) this._presentationScreen(room, halfX - 7.35 + panel * 2.45, 2.05, -halfZ + 0.21, 2.25, 1.62);
      this._studioSign(room, 'OPENXNET', [-halfX + 3.2, 2.68, -halfZ + 0.23], 3.8, '#b6e9ff', palette.dark);
      this._presentationMeeting(room, -halfX + 3.4, -halfZ + 2, palette.accent, false);
      for (const x of [-halfX + 0.5, halfX - 0.5]) this._studioBox(room, [0.04, 0.014, halfZ * 2 - 0.9], [x, 0.24, 0], glow);
      for (let z = -halfZ + 2.5; z < halfZ; z += 3.8) this._studioBox(room, [halfX * 2 - 1, 0.012, 0.018], [0, 0.238, z], frame);
      this._studioBox(room, [0.7, 0.8, 2.4], [-halfX + 0.7, 0.62, halfZ - 2.2], stone);
      this._studioBox(room, [0.03, 0.05, 2.1], [-halfX + 1.065, 0.92, halfZ - 2.2], glow);
    } else {
      const joints = this._presentationMaterial('stone', 0xd7e1eb);
      const xJoints = Math.min(64, Math.ceil(halfX * 2 / 1.5)); const zJoints = Math.min(64, Math.ceil(halfZ * 2 / 1.5));
      for (let joint = 1; joint < xJoints; joint++) this._studioBox(room, [0.012, 0.009, halfZ * 2 - 0.2], [-halfX + joint * halfX * 2 / xJoints, 0.236, 0], joints);
      for (let joint = 1; joint < zJoints; joint++) this._studioBox(room, [halfX * 2 - 0.2, 0.009, 0.012], [0, 0.236, -halfZ + joint * halfZ * 2 / zJoints], joints);
      this._studioBox(room, [halfX * 2, 3.55, 0.18], [0, 1.99, -halfZ], this._presentationMaterial('wall'));
      this._studioBox(room, [0.18, 2.7, halfZ * 2], [-halfX, 1.57, 0], stone);
      this._studioBox(room, [halfX * 2 - 0.4, 0.08, 0.12], [0, 0.34, -halfZ + 0.14], frame);
      this._studioBox(room, [5.65, 2.83, 0.07], [-halfX + 3.1, 1.83, -halfZ + 0.135], this._presentationMaterial('stone', 0x2888c5));
      this._studioBox(room, [0.2, 2.83, 0.09], [-halfX + 5.86, 1.83, -halfZ + 0.15], this._presentationMaterial('stone', 0x51b9db));
      this._studioBox(room, [7.9, 2.15, 0.045], [halfX - 4.65, 2.04, -halfZ + 0.13], this._presentationMaterial('glass'));
      for (let i = 0; i < 5; i++) this._studioBox(room, [0.048, 2.22, 0.12], [halfX - 8.52 + i * 1.94, 2.04, -halfZ + 0.2], frame);
      this._presentationMeeting(room, -halfX + 3.2, -halfZ + 2.02, color, true);
      this._studioSign(room, 'OPENXNET', [-halfX + 3.1, 2.85, -halfZ + 0.23], 3.65, '#ffffff', 0x2888c5);
      for (const x of [0.45, 3.15]) {
        this._studioBox(room, [2.25, 0.14, 0.86], [x, 0.31, -halfZ + 1.3], wood);
        this._studioBox(room, [2.15, 0.38, 0.78], [x, 0.51, -halfZ + 1.3], this._presentationMaterial('fabric', 0xd4c3ae));
        this._studioBox(room, [2.15, 0.62, 0.16], [x, 0.84, -halfZ + 0.94], this._presentationMaterial('fabric', 0xd4c3ae));
      }
      this._presentationCylinder(room, 0.58, 0.08, [1.8, 0.7, -halfZ + 2.15], wood);
      this._presentationCylinder(room, 0.16, 0.45, [1.8, 0.43, -halfZ + 2.15], frame, 24);
      this._studioPlant(room, halfX - 0.8, 0.24, -halfZ + 0.95, 1.35);
      this._studioPlant(room, -halfX + 0.8, 0.24, halfZ - 1.1, 1.15);
    }
  }

  /** 为空项目剖面补上后侧会谈与休息区，仍由原楼层实体接收点击。 / Furnish the rear of empty project sections with meeting and lounge areas while retaining floor hit targets. */
  _presentationEmptyFloorLounge(floor) {
    const group = new this.THREE.Group(); group.position.set(0, 0.12, -2.45); floor.add(group);
    const wood = this._presentationMaterial('wood'); const frame = this._presentationMaterial('frame');
    const warmFabric = this._presentationMaterial('fabric', 0xd4c3ae);
    this._studioBox(group, [8.25, 0.012, 2.06], [0, 0.014, 0], this._presentationMaterial('fabric', 0xc7dce9));
    this._presentationCylinder(group, 0.72, 0.08, [-2.1, 0.76, 0], wood);
    this._presentationCylinder(group, 0.16, 0.68, [-2.1, 0.38, 0], frame, 24);
    for (const x of [-3.13, -1.07]) {
      this._studioBox(group, [0.54, 0.13, 0.57], [x, 0.41, 0], this._presentationMaterial('fabric'));
      this._studioBox(group, [0.54, 0.51, 0.08], [x, 0.72, -0.31], this._presentationMaterial('fabric'));
      this._studioBox(group, [0.06, 0.35, 0.06], [x, 0.2, 0], frame);
    }
    this._studioBox(group, [2.65, 0.12, 0.8], [1.87, 0.23, -0.38], wood);
    this._studioBox(group, [2.55, 0.31, 0.74], [1.87, 0.4, -0.38], warmFabric);
    this._studioBox(group, [2.55, 0.57, 0.13], [1.87, 0.71, -0.72], warmFabric);
    this._presentationCylinder(group, 0.4, 0.07, [1.87, 0.51, 0.49], wood);
    this._presentationCylinder(group, 0.12, 0.43, [1.87, 0.26, 0.49], frame, 24);
  }

  /** 创建玻璃会议间、庭院圆桌或多边任务台。 / Create a glazed meeting room, courtyard round table or polygonal task table. */
  _presentationMeeting(parent, x, z, accent, glazed) {
    const group = new this.THREE.Group(); group.position.set(x, 0.24, z); parent.add(group);
    const style = this.getPresentationStyle(); const palette = this._getPresentationPalette();
    this._studioBox(group, [5.65, 0.025, 3.05], [0, 0, 0], this._presentationMaterial('fabric'));
    const tabletop = this._presentationCylinder(group, 1.05, 0.12, [0, 0.82, 0.02], this._presentationMaterial(style === 'atrium' ? 'wood' : 'floor'), style === 'command' ? 6 : 48);
    tabletop.scale.z = 0.65;
    this._presentationCylinder(group, 0.23, 0.7, [0, 0.43, 0.02], this._presentationMaterial('frame'), 24);
    for (const side of [-1, 1]) for (const offset of [-0.62, 0.62]) {
      this._studioBox(group, [0.64, 0.12, 0.64], [offset, 0.42, side * 0.95], this._presentationMaterial('fabric', accent));
      this._studioBox(group, [0.64, 0.58, 0.09], [offset, 0.75, side * 1.23], this._presentationMaterial('fabric', accent));
      this._studioBox(group, [0.06, 0.34, 0.06], [offset, 0.2, side * 0.95], this._presentationMaterial('frame'));
    }
    if (glazed) {
      this._studioBox(group, [0.045, 2.47, 3.12], [2.78, 1.25, 0], this._presentationMaterial('glass'));
      this._studioBox(group, [2.2, 2.47, 0.045], [-1.72, 1.25, 1.57], this._presentationMaterial('glass'));
      this._studioBox(group, [5.72, 0.065, 0.065], [0, 2.52, 1.57], this._presentationMaterial('frame'));
      for (const px of [-2.82, 2.78]) this._studioBox(group, [0.055, 2.53, 0.055], [px, 1.28, 1.57], this._presentationMaterial('frame'));
    } else if (style === 'command') this._studioBox(group, [1.45, 0.018, 0.58], [0, 0.893, 0.02], this._presentationMaterial('light', palette.accent));
  }

  /** 绘制抽象协作面板，不虚构实时指标或外部屏幕素材。 / Draw abstract collaboration panels without fabricated live metrics or external screen artwork. */
  _presentationScreen(parent, x, y, z, width, height) {
    const screen = new this.THREE.Group(); screen.position.set(x, y, z); parent.add(screen);
    const palette = this._getPresentationPalette();
    this._studioBox(screen, [width, height, 0.085], [0, 0, 0], this._presentationMaterial('frame'));
    this._studioBox(screen, [width - 0.1, height - 0.1, 0.018], [0, 0, 0.053], this._presentationMaterial('stone', palette.dark));
    this._studioBox(screen, [width * 0.71, 0.025, 0.012], [-width * 0.045, height * 0.33, 0.068], this._presentationMaterial('light', palette.accent));
    for (let i = 0; i < 3; i++) {
      this._studioBox(screen, [width * 0.2, height * 0.22, 0.012], [-width * 0.29 + i * width * 0.29, 0.005, 0.068], this._presentationMaterial('stone', 0x406581));
      this._studioBox(screen, [width * 0.16, 0.017, 0.012], [-width * 0.29 + i * width * 0.29, -height * 0.25, 0.068], this._presentationMaterial('light', palette.accent));
    }
    return screen;
  }

  /** 创建薄墙与家具，透明玻璃不投射不透明的硬阴影。 / Create thin walls and furniture without letting glass cast opaque shadows. */
  _studioBox(parent, size, position, color) {
    const THREE = this.THREE;
    const material = color?.isMaterial ? color : new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.03 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = !material.transparent;
    mesh.receiveShadow = !material.transparent;
    parent.add(mesh);
    return mesh;
  }

  _studioPlant(parent, x, y, z, scale = 1) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.21, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xe4e7dc, roughness: 0.9 }));
    pot.position.y = 0.225;
    pot.castShadow = true;
    group.add(pot);
    this._studioBox(group, [0.055, 0.84, 0.055], [0, 0.77, 0], 0x627c54);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x508368 : 0x739e79, roughness: 0.88 }));
      leaf.scale.set(0.13, 0.38, 0.2);
      leaf.position.set(Math.cos(angle) * 0.19, 0.64 + i * 0.105, Math.sin(angle) * 0.19);
      leaf.rotation.set(Math.sin(angle) * 0.55, angle, Math.cos(angle) * 0.55);
      leaf.castShadow = true;
      group.add(leaf);
    }
    parent.add(group);
    return group;
  }

  /** 以办公岛、圆角木桌或双屏任务台布置相同员工工位。 / Furnish the same staff stations with office islands, round timber tables or dual-screen task consoles. */
  _studioDesk(parent, x, y, z, scale, accent) {
    const THREE = this.THREE;
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    const style = this.getPresentationStyle(); const palette = this._getPresentationPalette();
    const frame = this._presentationMaterial('frame'); const fabric = this._presentationMaterial('fabric', accent || palette.fabric);
    group.name = `presentation-${style}-desk`;
    if (style === 'atrium') {
      const table = this._presentationCylinder(group, 1.15, 0.12, [0, 0.92, 0], this._presentationMaterial('wood'));
      table.scale.z = 0.52;
      for (const side of [-1, 1]) this._presentationCylinder(group, 0.075, 0.87, [side * 0.77, 0.435, 0], frame, 16);
    } else if (style === 'command') {
      const table = this._presentationCylinder(group, 1.3, 0.18, [0, 0.92, 0], this._presentationMaterial('floor'), 6);
      table.scale.z = 0.57;
      this._studioBox(group, [0.5, 0.81, 0.65], [0, 0.45, 0], frame);
      this._studioBox(group, [1.8, 0.028, 0.05], [0, 1.02, 0.53], this._presentationMaterial('light', palette.accent));
    } else {
      this._studioBox(group, [2.25, 0.11, 1.05], [0, 0.92, 0], this._presentationMaterial('floor'));
      this._studioBox(group, [2.1, 0.04, 0.08], [0, 0.86, 0.42], fabric);
      for (const side of [-1, 1]) {
        this._studioBox(group, [0.085, 0.87, 0.8], [side * 0.98, 0.435, 0], frame);
        this._studioBox(group, [0.15, 0.06, 0.98], [side * 0.98, 0.03, 0], frame);
      }
    }
    if (style === 'command') {
      for (const side of [-1, 1]) {
        const screen = this._presentationScreen(group, side * 0.48, 1.39, -0.29, 0.87, 0.59);
        screen.rotation.y = -side * 0.16;
      }
    } else this._presentationScreen(group, 0, 1.41, -0.25, 0.95, 0.62);
    this._studioBox(group, [0.045, 0.2, 0.06], [0, 1.07, -0.25], frame);
    this._studioBox(group, [0.43, 0.035, 0.26], [0, 0.998, -0.2], frame);
    this._studioBox(group, [0.65, 0.035, 0.22], [-0.08, 1.04, 0.24], frame);
    this._studioBox(group, [0.16, 0.04, 0.22], [0.48, 1.04, 0.24], frame);
    this._studioBox(group, [0.32, 0.035, 0.42], [-0.82, 1.04, 0.1], fabric);
    this._presentationCylinder(group, 0.085, 0.18, [0.88, 1.1, 0.02], this._presentationMaterial('stone', 0xd1a68a), 16);
    // Chairs are tucked to one side of the standing characters.
    this._studioBox(group, [0.62, 0.12, 0.6], [-0.48, 0.51, 1.05], fabric);
    this._studioBox(group, [0.63, 0.58, 0.1], [-0.48, 0.86, 1.34], fabric);
    this._studioBox(group, [0.075, 0.45, 0.075], [-0.48, 0.23, 1.05], frame);
    this._studioBox(group, [0.68, 0.07, 0.075], [-0.48, 0.06, 1.05], frame);
    this._studioBox(group, [0.075, 0.07, 0.68], [-0.48, 0.06, 1.05], frame);
    parent.add(group);
    return group;
  }

  _studioSign(parent, text, position, width, foreground, background) {
    const THREE = this.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = typeof background === 'string' ? background : '#' + new THREE.Color(background).getHexString();
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = foreground;
    context.font = '600 70px "Segoe UI", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 256, 66, 470);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture }));
    sign.position.set(...position);
    parent.add(sign);
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
    this._bodyTypePresetsCache = {
      default:  { body: 0x426b82, skin: 0xe7b58d, accent: 0xdb765e, hair: 0x352d2c, hairStyle: 'sweep', accessory: 'tie' },
      engineer: { body: 0xc69742, skin: 0xb87955, accent: 0xf2c65c, hair: 0x29262a, hairStyle: 'short', accessory: 'hardhat' },
      scholar:  { body: 0x697983, skin: 0xf0c4a4, accent: 0xd5e3da, hair: 0x694535, hairStyle: 'bob', accessory: 'glasses' },
      captain:  { body: 0x354e63, skin: 0x9f6349, accent: 0xdabc78, hair: 0x262327, hairStyle: 'sweep', accessory: 'crown' },
      ninja:    { body: 0x444b54, skin: 0xe0a77b, accent: 0xce756c, hair: 0x25282d, hairStyle: 'short', accessory: 'mask' },
      robot:    { body: 0xd3dfdf, skin: 0xdce9e7, accent: 0x52bdb0, hair: 0x617b80, hairStyle: null, accessory: 'antenna' },
      streamer: { body: 0xb86778, skin: 0xf2ccad, accent: 0xe9af9b, hair: 0x583d46, hairStyle: 'bob', accessory: 'headphones' },
      geek:     { body: 0x547b67, skin: 0xce9470, accent: 0xc2d8b2, hair: 0x38322f, hairStyle: 'short', accessory: 'cap' },
      ghost:    { body: 0x9aadaf, skin: 0x9aadaf, accent: 0x9aadaf, hair: 0x9aadaf, accessory: null, isGhost: true },
    };
    return this._bodyTypePresetsCache;
  }

  _createCharacterFigure({ bodyType = 'default', accent = null, scale = 1.0, isGhost = false } = {}) {
    const THREE = this.THREE;
    const presets = this._getBodyTypePresets();
    const preset = presets[bodyType] || presets.default;
    const group = new THREE.Group();

    const ghostFlag = isGhost || preset.isGhost === true;
    const materialCache = new Map();
    const mkMat = (hex, opts = {}) => {
      const colorKey = hex && hex.isColor ? hex.getHex() : hex;
      const key = `${colorKey}:${JSON.stringify(opts)}`;
      if (!materialCache.has(key)) {
        materialCache.set(key, new THREE.MeshStandardMaterial({
          color: hex, roughness: 0.72, metalness: 0.02,
          ...(ghostFlag ? { transparent: true, opacity: 0.22, depthWrite: false } : opts),
        }));
      }
      return materialCache.get(key);
    };

    const bodyHex = (accent && !ghostFlag) ? accent : preset.body;
    const skinHex = preset.skin;
    const accentHex = preset.accent;

    const bodyMat = mkMat(bodyHex);
    const skinMat = mkMat(skinHex);
    const accentMat = mkMat(accentHex);
    const darkMat = mkMat(bodyType === 'robot' ? 0x728a90 : 0x36414a);
    const ivoryMat = mkMat(0xf0f1e9);
    const S = scale;
    const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
    const ellipsoid = (parent, material, position, dimensions) => {
      const mesh = new THREE.Mesh(sphereGeo, material);
      mesh.position.set(...position.map(v => v * S));
      mesh.scale.set(...dimensions.map(v => v * S));
      mesh.castShadow = !ghostFlag;
      mesh.receiveShadow = !ghostFlag;
      parent.add(mesh);
      return mesh;
    };
    const capsule = (parent, material, radius, length, position) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius * S, length * S, 5, 12), material);
      mesh.position.set(...position.map(v => v * S));
      mesh.castShadow = !ghostFlag;
      parent.add(mesh);
      return mesh;
    };

    [-0.115, 0.115].forEach((dx) => {
      capsule(group, darkMat, 0.089, 0.40, [dx, 0.37, 0]);
      ellipsoid(group, ivoryMat, [dx, 0.035, 0.045], [0.108, 0.035, 0.168]);
      ellipsoid(group, bodyType === 'captain' ? darkMat : mkMat(0x53616a), [dx, 0.084, 0.035], [0.104, 0.070, 0.155]);
    });
    ellipsoid(group, darkMat, [0, 0.645, 0], [0.218, 0.115, 0.15]);

    // A closed, gently tapered profile gives the jacket continuous shoulders and a rounded hem.
    const jacketProfile = [[0, 0], [0.17, 0], [0.22, 0.025], [0.227, 0.09],
      [0.231, 0.28], [0.249, 0.395], [0.234, 0.44], [0.18, 0.487], [0.105, 0.51], [0, 0.51]];
    const torso = new THREE.Mesh(new THREE.LatheGeometry(jacketProfile.map(([x, y]) => new THREE.Vector2(x * S, y * S)), 24), bodyMat);
    torso.position.y = 0.635 * S;
    torso.scale.z = 0.7;
    torso.castShadow = !ghostFlag;
    torso.receiveShadow = !ghostFlag;
    group.add(torso);
    capsule(group, skinMat, 0.083, 0.075, [0, 1.18, 0]);
    ellipsoid(group, ivoryMat, [0, 1.07, 0.148], [0.090, 0.112, 0.040]);
    if (!ghostFlag) {
      const lapelShape = new THREE.Shape();
      lapelShape.moveTo(-0.07 * S, 0.085 * S);
      lapelShape.lineTo(0.05 * S, 0.075 * S);
      lapelShape.lineTo(0.015 * S, -0.075 * S);
      lapelShape.closePath();
      const lapelGeo = new THREE.ExtrudeGeometry(lapelShape, { depth: 0.013 * S, bevelEnabled: true, bevelSize: 0.006 * S, bevelThickness: 0.004 * S, bevelSegments: 2, steps: 1 });
      [-1, 1].forEach(side => {
        const lapel = new THREE.Mesh(lapelGeo, bodyType === 'robot' ? accentMat : ivoryMat);
        lapel.position.set(side * 0.085 * S, 1.045 * S, 0.176 * S);
        lapel.scale.x = -side;
        lapel.rotation.z = -side * 0.1;
        group.add(lapel);
      });
      ellipsoid(group, accentMat, [0.13, 0.984, 0.166], [0.028, 0.033, 0.012]);
      [0.91, 0.82].forEach(y => ellipsoid(group, darkMat, [0, y, 0.166], [0.012, 0.012, 0.007]));
    }

    const armPivots = [];
    [-1, 1].forEach((side) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.265 * S, 1.055 * S, 0);
      armPivot.rotation.z = side * 0.11;
      capsule(armPivot, bodyMat, 0.080, 0.235, [0, -0.132, 0]);
      ellipsoid(armPivot, ivoryMat, [0, -0.301, 0], [0.071, 0.026, 0.069]);
      ellipsoid(armPivot, skinMat, [0, -0.365, 0.008], [0.062, 0.079, 0.059]);
      group.add(armPivot);
      armPivots.push(armPivot);
    });

    const hairMat = mkMat(preset.hair || 0x38322f);
    if (!ghostFlag && preset.hairStyle === 'bob') {
      ellipsoid(group, hairMat, [0, 1.445, -0.047], [0.248, 0.271, 0.192]);
    }
    ellipsoid(group, skinMat, [0, 1.458, 0], [0.229, 0.248, 0.204]);
    [-1, 1].forEach(side => ellipsoid(group, skinMat, [side * 0.223, 1.439, -0.005], [0.038, 0.055, 0.037]));
    if (!ghostFlag) {
      const robot = bodyType === 'robot';
      if (robot) ellipsoid(group, mkMat(0x314b51, { roughness: 0.3 }), [0, 1.472, 0.170], [0.184, 0.145, 0.055]);
      const eyeMat = robot ? mkMat(accentHex, { emissive: accentHex, emissiveIntensity: 0.6 }) : mkMat(0x29292d);
      [-1, 1].forEach(side => {
        ellipsoid(group, eyeMat, [side * 0.075, 1.490, robot ? 0.217 : 0.194], [0.018, 0.025, 0.014]);
        if (!robot) {
          ellipsoid(group, ivoryMat, [side * 0.075 + 0.005, 1.499, 0.205], [0.005, 0.006, 0.004]);
          const brow = capsule(group, hairMat, 0.007, 0.041, [side * 0.077, 1.544, 0.18]);
          brow.rotation.z = Math.PI / 2 + side * 0.12;
        }
      });
      if (!robot) ellipsoid(group, skinMat, [0, 1.433, 0.200], [0.025, 0.030, 0.026]);
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.031 * S, 0.005 * S, 5, 12, Math.PI), robot ? eyeMat : mkMat(0x955f50));
      smile.position.set(0, 1.390 * S, (robot ? 0.22 : 0.193) * S);
      smile.rotation.z = Math.PI;
      group.add(smile);
      if (preset.hairStyle) {
        const hair = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.51), hairMat);
        hair.position.set(0, 1.484 * S, -0.016 * S);
        hair.scale.set(0.24 * S, 0.245 * S, 0.213 * S);
        hair.castShadow = true;
        group.add(hair);
        if (preset.accessory !== 'hardhat' && preset.accessory !== 'cap') {
          const fringe = ellipsoid(group, hairMat, [-0.067, 1.654, 0.124], [0.165, 0.065, 0.103]);
          fringe.rotation.z = preset.hairStyle === 'sweep' ? 0.28 : -0.13;
        }
        if (preset.hairStyle === 'sweep') {
          const part = ellipsoid(group, hairMat, [0.123, 1.630, 0.097], [0.087, 0.052, 0.101]);
          part.rotation.z = -0.4;
        }
      }
    }

    // ────── 配件 ──────
    if (!ghostFlag && preset.accessory) {
      this._addCharacterAccessory(group, preset.accessory, accentHex, S, mkMat, skinHex);
    }

    group.userData.__idle = {
      seed: Math.random() * Math.PI * 2,
      armPivots,
      baseY: 0,
    };
    group.userData.__bodyType = bodyType;

    return group;
  }

  _addCharacterAccessory(group, kind, accentHex, S, mkMat, skinHex) {
    const THREE = this.THREE;
    const accentMat = mkMat(accentHex);
    const darkMat = mkMat(0x35414b);
    const ivoryMat = mkMat(0xf0f1e9);
    const sphereGeo = new THREE.SphereGeometry(1, 16, 12);
    const rounded = (material, position, dimensions) => {
      const mesh = new THREE.Mesh(sphereGeo, material);
      mesh.position.set(...position.map(v => v * S));
      mesh.scale.set(...dimensions.map(v => v * S));
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    };
    const rod = (material, radius, length, position) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius * S, length * S, 4, 10), material);
      mesh.position.set(...position.map(v => v * S));
      group.add(mesh);
      return mesh;
    };
    const folio = (color, position, angle) => {
      const shape = new THREE.Shape();
      const w = 0.17 * S, h = 0.245 * S, r = 0.024 * S;
      shape.moveTo(-w + r, -h);
      shape.lineTo(w - r, -h); shape.quadraticCurveTo(w, -h, w, -h + r);
      shape.lineTo(w, h - r); shape.quadraticCurveTo(w, h, w - r, h);
      shape.lineTo(-w + r, h); shape.quadraticCurveTo(-w, h, -w, h - r);
      shape.lineTo(-w, -h + r); shape.quadraticCurveTo(-w, -h, -w + r, -h);
      const book = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.048 * S, bevelEnabled: false }), mkMat(color));
      book.position.set(...position.map(v => v * S));
      book.rotation.z = angle;
      book.castShadow = true;
      group.add(book);
      return book;
    };
    switch (kind) {
      case 'hardhat': {
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.264 * S, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          accentMat
        );
        cap.position.y = 1.58 * S;
        cap.scale.y = 0.81;
        cap.castShadow = true;
        group.add(cap);
        rounded(accentMat, [0, 1.588, 0.026], [0.292, 0.025, 0.270]);
        const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.261 * S, 0.012 * S, 6, 20, Math.PI), ivoryMat);
        ridge.rotation.y = Math.PI / 2;
        ridge.position.y = 1.582 * S;
        ridge.scale.y = 0.82;
        group.add(ridge);
        [-1, 1].forEach(side => {
          const stripe = rod(ivoryMat, 0.016, 0.21, [side * 0.143, 0.864, 0.154]);
          stripe.rotation.z = side * 0.07;
        });
        break;
      }
      case 'glasses': {
        const lensGeo = new THREE.TorusGeometry(0.049 * S, 0.008 * S, 6, 20);
        [-0.08, 0.08].forEach((dx) => {
          const lens = new THREE.Mesh(lensGeo, darkMat);
          lens.position.set(dx * S, 1.49 * S, 0.214 * S);
          group.add(lens);
        });
        rod(darkMat, 0.006, 0.047, [0, 1.495, 0.217]).rotation.z = Math.PI / 2;
        folio(0xa27765, [-0.30, 0.80, 0.09], -0.13);
        break;
      }
      case 'crown': {
        // Keep the stored accessory key; the captain now wears tailored leadership details.
        [-1, 1].forEach(side => rounded(accentMat, [side * 0.235, 1.109, 0], [0.066, 0.019, 0.065]));
        folio(0x4d5f68, [-0.315, 0.80, 0.10], -0.12);
        rod(accentMat, 0.018, 0.15, [0, 0.99, 0.179]);
        break;
      }
      case 'mask': {
        rounded(darkMat, [0, 1.363, 0.137], [0.180, 0.075, 0.083]);
        rounded(accentMat, [0, 1.182, 0], [0.123, 0.045, 0.113]);
        const scarf = rounded(accentMat, [-0.093, 1.084, -0.10], [0.045, 0.127, 0.032]);
        scarf.rotation.z = -0.28;
        break;
      }
      case 'antenna': {
        rod(darkMat, 0.015, 0.085, [0, 1.738, 0]);
        const lightMat = mkMat(accentHex, { emissive: accentHex, emissiveIntensity: 0.7, roughness: 0.3 });
        rounded(lightMat, [0, 1.812, 0], [0.037, 0.037, 0.037]);
        rounded(darkMat, [0, 0.954, 0.157], [0.10, 0.087, 0.025]);
        rounded(lightMat, [0, 0.96, 0.18], [0.054, 0.025, 0.012]);
        [-1, 1].forEach(side => rounded(accentMat, [side * 0.24, 1.449, 0], [0.035, 0.065, 0.06]));
        break;
      }
      case 'headphones': {
        const band = new THREE.Mesh(
          new THREE.TorusGeometry(0.26 * S, 0.022 * S, 8, 24, Math.PI), darkMat
        );
        band.position.set(0, 1.474 * S, -0.02 * S);
        group.add(band);
        [-1, 1].forEach((side) => {
          rounded(darkMat, [side * 0.25, 1.471, -0.018], [0.05, 0.087, 0.072]);
          rounded(accentMat, [side * 0.284, 1.471, -0.018], [0.023, 0.066, 0.053]);
        });
        const boom = rod(darkMat, 0.010, 0.15, [0.22, 1.404, 0.086]);
        boom.rotation.x = -0.85;
        rounded(darkMat, [0.218, 1.35, 0.15], [0.025, 0.023, 0.036]);
        break;
      }
      case 'cap': {
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.246 * S, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMat
        );
        dome.position.y = 1.575 * S;
        dome.scale.y = 0.72;
        dome.castShadow = true;
        group.add(dome);
        rounded(accentMat, [0, 1.586, 0.192], [0.221, 0.017, 0.155]);
        rounded(ivoryMat, [0, 1.65, 0.235], [0.027, 0.029, 0.01]);
        folio(0x3c545b, [-0.30, 0.79, 0.10], -0.12);
        break;
      }
      case 'tie': {
        const tieShape = new THREE.Shape();
        tieShape.moveTo(-0.019 * S, 0.09 * S);
        tieShape.lineTo(0.019 * S, 0.09 * S);
        tieShape.lineTo(0.034 * S, -0.082 * S);
        tieShape.lineTo(0, -0.116 * S);
        tieShape.lineTo(-0.034 * S, -0.082 * S);
        tieShape.closePath();
        const tie = new THREE.Mesh(new THREE.ExtrudeGeometry(tieShape, { depth: 0.012 * S, bevelEnabled: false }), accentMat);
        tie.position.set(0, 0.994 * S, 0.171 * S);
        group.add(tie);
        rounded(accentMat, [0, 1.095, 0.182], [0.027, 0.026, 0.018]);
        break;
      }
    }
  }

  /** 用石材广场、木栈道或任务中枢基座组织园区。 / Organize the campus with a stone plaza, timber promenade or command plinth. */
  _createRoads() {
    const { width, depth } = this._campusSize;
    const campus = new this.THREE.Group();
    const style = this.getPresentationStyle(); const palette = this._getPresentationPalette();
    campus.name = `presentation-${style}-campus`;
    this.scene.add(campus);
    this._studioBox(campus, [width, 0.22, depth], [0, -0.06, 0], this._presentationMaterial('stone'));
    this._studioBox(campus, [width - 0.18, 0.06, depth - 0.18], [0, 0.08, 0], this._presentationMaterial('floor'));
    const roadZ = depth / 2 - 0.75;
    this._studioBox(campus, [width - 0.25, 0.025, 1.25], [0, 0.125, roadZ], this._presentationMaterial(style === 'atrium' ? 'wood' : 'frame'));
    this._studioBox(campus, [width - 0.3, 0.035, 0.1], [0, 0.13, roadZ - 0.78], this._presentationMaterial('light', palette.accent));
    for (let x = -width / 2 + 0.9; x < width / 2 - 0.5; x += 1.4) {
      this._studioBox(campus, [0.62, 0.015, style === 'atrium' ? 1.1 : 0.045], [x, 0.145, roadZ], this._presentationMaterial(style === 'atrium' ? 'wood' : 'stone'));
    }
    for (let i = 0; i < 5; i++) {
      this._studioBox(campus, [0.15, 0.02, 1.05], [-0.5 + i * 0.25, 0.15, roadZ], this._presentationMaterial('floor'));
    }
  }

  /** 以种植、长椅或灯柱增强空间层次，不添加外部模型。 / Add spatial depth through planting, benches or light columns without external models. */
  _createDecorations() {
    const THREE = this.THREE;
    const { width, depth } = this._campusSize;
    const landscape = new THREE.Group();
    this.scene.add(landscape);
    const style = this.getPresentationStyle(); const palette = this._getPresentationPalette();
    if (style === 'command') {
      for (const x of [-width / 2 + 0.45, width / 2 - 0.45]) for (let z = -depth / 2 + 1; z < depth / 2 - 1; z += 3.2) {
        this._studioBox(landscape, [0.38, 1.3, 0.38], [x, 0.78, z], this._presentationMaterial('frame'));
        this._studioBox(landscape, [0.12, 0.83, 0.04], [x, 0.94, z + 0.205], this._presentationMaterial('light', palette.accent));
      }
      return;
    }
    /** 原创树冠与树池仅作为植物装饰。 / Original canopies and planters are decorative vegetation only. */
    const tree = (x, z, scale) => {
      const group = new THREE.Group();
      group.position.set(x, 0.13, z);
      group.scale.setScalar(scale);
      this._studioBox(group, [1.15, 0.13, 1.15], [0, 0, 0], 0xe9ece1);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 1.15, 10), new THREE.MeshStandardMaterial({ color: 0x8e9172 }));
      trunk.position.y = 0.58;
      trunk.castShadow = true;
      group.add(trunk);
      for (let i = 0; i < 3; i++) {
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.66, 1), new THREE.MeshStandardMaterial({ color: [0x759a78, 0x5a866b, 0x86a882][i], roughness: 1, flatShading: true }));
        crown.position.set(i === 1 ? -0.28 : i === 2 ? 0.3 : 0, 1.48 + (i === 0 ? 0.3 : 0), i === 2 ? 0.18 : 0);
        crown.scale.set(0.82, i === 0 ? 1.25 : 0.88, 0.85);
        crown.castShadow = true;
        group.add(crown);
      }
      landscape.add(group);
    };
    for (let z = -depth / 2 + 1.3; z < depth / 2 - 2; z += 3) {
      tree(-width / 2 + 0.7, z, style === 'atrium' ? 0.92 : 0.67);
      tree(width / 2 - 0.7, z, style === 'atrium' ? 0.92 : 0.67);
    }
    for (let x = -width / 2 + 2; x < width / 2 - 1; x += 3.6) {
      tree(x, -depth / 2 + 0.7, 0.78);
      this._studioBox(landscape, [1.3, 0.12, 0.45], [x, 0.5, depth / 2 - 1.8], 0xb08b73);
      for (const side of [-0.45, 0.45]) this._studioBox(landscape, [0.08, 0.36, 0.38], [x + side, 0.28, depth / 2 - 1.8], 0x63776a);
    }
  }

  // ============== LABELS ==============

  _addLabel(x, y, z, title, color, subtitle, anchor = null) {
    const el = document.createElement('div');
    el.className = 'enterprise-3d-label';
    const titleElement = document.createElement('strong');
    titleElement.className = 'enterprise-3d-label__title';
    titleElement.textContent = String(title || '');
    titleElement.style.setProperty('--enterprise-3d-label-accent', String(color || '#2588cf'));
    el.appendChild(titleElement);
    if (subtitle) {
      const subtitleElement = document.createElement('small');
      subtitleElement.className = 'enterprise-3d-label__meta';
      subtitleElement.textContent = String(subtitle);
      el.appendChild(subtitleElement);
    }
    this.labelOverlay.appendChild(el);
    this._labelEls.push({ el, worldPos: new this.THREE.Vector3(x, y, z), anchor, type: 'label' });
  }

  /** 更新 3D 标签屏幕坐标，并将标签限制在可见画布范围内。 */
  _updateLabels() {
    const THREE = this.THREE;
    const { width: w, height: h } = this._getContainerSize();
    const occupied = [];
    this._labelEls.forEach(({ el, worldPos, anchor }) => {
      if (anchor && this.selectedAgent?.id === anchor.userData.agent?.id && this._onSelectedAgentPos) {
        el.style.opacity = '0';
        return;
      }
      if (anchor) {
        anchor.getWorldPosition(worldPos);
        worldPos.y += 2.65;
      }
      const v = worldPos.clone().project(this.camera);
      const rawX = (v.x * 0.5 + 0.5) * w;
      const rawY = (-v.y * 0.5 + 0.5) * h;
      const halfWidth = Math.max(48, el.offsetWidth / 2);
      const halfHeight = Math.max(18, el.offsetHeight / 2);
      const box = { left: rawX - halfWidth, right: rawX + halfWidth, top: rawY - halfHeight, bottom: rawY + halfHeight };
      const collides = occupied.some(other => box.left < other.right + 6 && box.right > other.left - 6 && box.top < other.bottom + 5 && box.bottom > other.top - 5);
      const inView = box.left >= 4 && box.right <= w - 4 && box.top >= 70 && box.bottom <= h - 42;
      if (v.z >= -1 && v.z <= 1 && inView && !collides) {
        el.style.transform = `translate(-50%, -50%) translate(${rawX}px, ${rawY}px)`;
        el.style.opacity = '1';
        occupied.push(box);
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

  /** 释放上一层对象与专属材质，保留地面和全局灯光。 / Release prior level objects and presentation materials while retaining ground and global lighting. */
  _clearScene() {
    const THREE = this.THREE;
    // Keep the studio ground and lighting while releasing the previous level.
    const keep = new Set();
    if (this._ground) keep.add(this._ground);

    const toRemove = [];
    this.scene.children.forEach(child => {
      if (!keep.has(child) && !(child instanceof THREE.Light)) {
        toRemove.push(child);
      }
    });
    this._cancelPointerInteraction?.();
    this._disposeObjects(toRemove, this._sceneMaterials);
    this._sceneMaterials?.clear();
    toRemove.forEach(obj => this.scene.remove(obj));
    this._selectedAgentMesh = null;
    this._selectionRing = null;
    this._viewBounds = null;
    this._lastFitDistance = null;
    this._meshMap.clear();
    this._clearLabels();
  }

  /** 对共享几何、纹理、材质和阴影去重后释放。 / Deduplicate and dispose shared geometries, textures, materials and shadows. */
  _disposeObjects(objects, presentationMaterials = null) {
    const resources = new Set();
    for (const material of presentationMaterials?.values() || []) resources.add(material);
    objects.forEach(object => object.traverse(child => {
      if (child.geometry) resources.add(child.geometry);
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.filter(Boolean).forEach(material => {
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
        resources.add(material);
      });
      if (child.shadow) resources.add(child.shadow);
    }));
    resources.forEach(resource => resource.dispose?.());
  }

  _rebuildCurrentLevel() {
    if (this.level === 0) this.showCityView();
    else if (this.level === 1 && this.currentWsId) this.showBuildingView(this.currentWsId);
    else if (this.level === 2 && this.currentProjectId) this.showFloorView(this.currentProjectId);
  }

  /** 返回当前层级推荐镜头；无输入，按对象数量计算视锥距离和中心点。 */
  _getDefaultCameraView() {
    const THREE = this.THREE;
    const bounds = this._viewBounds || new THREE.Box3(new THREE.Vector3(-6, 0, -6), new THREE.Vector3(6, 5, 6));
    const center = bounds.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(1.25, 1.35, 1.65).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    let horizontal = 0;
    let vertical = 0;
    // Fit all eight projected corners, including portrait viewports and tall buildings.
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const offset = new THREE.Vector3(x, y, z).sub(center);
          horizontal = Math.max(horizontal, Math.abs(offset.dot(right)));
          vertical = Math.max(vertical, Math.abs(offset.dot(up)));
        }
      }
    }
    const { width, height } = this._getContainerSize();
    const distance = Math.max(horizontal / (width / height), vertical) * 1.14;
    center.y += distance * 0.035;
    return { distance, target: { x: center.x, y: center.y, z: center.z } };
  }

  /** 按比例调整正交相机视锥；输入缩放因子，将距离限制在可读范围并更新控制器。 */
  _scaleCameraFrustum(factor) {
    if (!this.camera || !Number.isFinite(factor) || factor <= 0) return;
    if (this._zoomFrame) cancelAnimationFrame(this._zoomFrame);
    this._zoomFrame = null;
    const fittedDistance = this._getDefaultCameraView().distance;
    const currentDistance = Number(this.camera.top || fittedDistance) / this.camera.zoom;
    const nextDistance = Math.min(fittedDistance * 2, Math.max(2, currentDistance * factor));
    this.camera.zoom = 1;
    const { width, height } = this._getContainerSize();
    this._applyCameraFrustum(nextDistance, width, height);
    this.controls?.update?.();
  }

  /** 镜头按当前层取景，减少动效偏好下直接到达目标。 / Frame the current level, moving immediately when reduced motion is preferred. */
  _zoomCamera(targetD, targetLookAt) {
    const THREE = this.THREE;
    if (this._zoomFrame) {
      cancelAnimationFrame(this._zoomFrame);
      this._zoomFrame = null;
    }
    const startPos = this.camera.position.clone();
    
    // We want the camera to look from the SAME relative angle
    const camDirection = new THREE.Vector3(1.25, 1.35, 1.65).normalize();
    const endTarget = new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z);
    
    // Calculate new position based on the target center and an arbitrary fixed distance
    const dist = Math.max(40, targetD * 3);
    const endPos = endTarget.clone().add(camDirection.clone().multiplyScalar(dist));

    const duration = 800;
    const startTime = performance.now();
    const startTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0,0,0);
    const startD = (this.camera.top || 10) / this.camera.zoom;
    this.camera.zoom = 1;
    this._lastFitDistance = targetD;
    if (this._motionPreference?.matches) {
      this.camera.position.copy(endPos);
      if (this.controls) this.controls.target.copy(endTarget);
      this.camera.lookAt(endTarget);
      const { width, height } = this._getContainerSize();
      this._applyCameraFrustum(targetD, width, height);
      return;
    }

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
      this.controls.minZoom = 0.4;
      this.controls.maxZoom = 3.5;
      this.controls.target.set(0, 0, 0);
    }
  }

  // ============== INTERACTION ==============

  /** 保留选择、进入、双击和人物拖动，场景替换时取消旧指针状态。 / Preserve selection, entry, double-click and dragging while canceling old pointer state during scene replacement. */
  _setupInteraction() {
    const THREE = this.THREE;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let clickTimer = null;
    let pointerStart = null;
    let cameraDragged = false;
    // ─── 拖拽状态机 ───
    // dragState = { mesh, agent, baseY, startClientX, startClientY, moved, suppressClick }
    let dragState = null;
    /** 清理旧模型的在途拖动而不触发移动保存或业务回调。 / Clear in-flight drags on old models without saving movement or invoking business callbacks. */
    this._cancelPointerInteraction = () => {
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
      if (dragState) {
        dragState.mesh.userData.__dragging = false;
        dragState.mesh.position.y = dragState.baseY;
        try { this.renderer.domElement.releasePointerCapture?.(dragState.pointerId); } catch (_) { /* 指针可能已释放。 / The pointer may already be released. */ }
      }
      dragState = null; pointerStart = null; cameraDragged = false;
      if (this.controls) this.controls.enabled = true;
      this.renderer.domElement.style.cursor = '';
    };
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
      pointerStart = { x: e.clientX, y: e.clientY };
      cameraDragged = false;
      if (this.level !== 2) return; // 只在楼层视图启用拖拽
      if (e.button !== 0) return;   // 仅左键
      const obj = pickAgent(e.clientX, e.clientY);
      if (!obj || !obj.userData.draggable) return;
      // 进入候选拖拽：未真正移动前先不视为 drag，方便单击仍能选中
      dragState = {
        pointerId: e.pointerId,
        mesh: obj,
        agent: obj.userData.agent,
        baseY: obj.position.y,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
        suppressClick: false,
        origin: pickFloor(e.clientX, e.clientY),
        originalX: obj.position.x,
        originalZ: obj.position.z,
      };
      if (this.controls) this.controls.enabled = false;
      this.renderer.domElement.setPointerCapture && this.renderer.domElement.setPointerCapture(e.pointerId);
    });

    // ─────── PointerMove：超过阈值后开始拖动角色 ───────
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      if (pointerStart && e.buttons && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5) cameraDragged = true;
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
          const limit = this._floorLimits || { x: 7.5, z: 7.5 };
          const targetX = dragState.origin ? dragState.originalX + target.x - dragState.origin.x : target.x;
          const targetZ = dragState.origin ? dragState.originalZ + target.z - dragState.origin.z : target.z;
          const clampedX = Math.max(-limit.x, Math.min(limit.x, targetX));
          const clampedZ = Math.max(-limit.z, Math.min(limit.z, targetZ));
          dragState.mesh.position.x = clampedX;
          dragState.mesh.position.z = clampedZ;
        }
      }
    });

    // ─────── PointerUp：落下角色、触发持久化 callback ───────
    const onPointerEnd = (e) => {
      pointerStart = null;
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
      if (this._suppressNextClick || cameraDragged) return;
      if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; return; }

      clickTimer = setTimeout(() => {
        clickTimer = null;
        if (this._disposed) return;
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
      const obj = pickAgent(e.clientX, e.clientY);
      this.renderer.domElement.style.cursor = obj?.userData.draggable ? 'grab' : obj ? 'pointer' : '';
    });
  }

  // ============== UI (Fullscreen) ==============

  /** 从沙盘外壳查找画布外的全屏入口，沿用实际按钮同步状态。 / Find the fullscreen control outside the canvas through the sandbox shell and synchronize its actual state. */
  _createUI() {
    this._fullscreenButton = (this.container.closest('.enterprise-sandbox-shell') || this.container).querySelector('.enterprise-sandbox-view-tool--fullscreen');
  }

  // ============== ANIMATION LOOP ==============

  /** 渲染场景与细微人物呼吸，减少动效时保持静态姿态。 / Render the scene and subtle breathing, retaining static poses under reduced motion. */
  _animate() {
    if (this._disposed) return;
    this._animId = requestAnimationFrame(() => this._animate());

    const t = this._clock.getElapsedTime();
    const reducedMotion = this._motionPreference?.matches === true;

    // 角色 idle 动画：每个 character 上挂的 __idle 数据驱动呼吸 + 手臂前后摆动
    if (this._meshMap && this._meshMap.size) {
      this._meshMap.forEach((mesh) => {
        const idle = mesh.userData && mesh.userData.__idle;
        if (!idle) return;
        if (mesh.userData.__dragging) return; // 拖拽时不要叠加动画
        const phase = t * 1.4 + idle.seed;
        // 整体微微起伏（呼吸感）
        const bob = reducedMotion ? 0 : (Math.sin(phase) + 1) * 0.004;
        mesh.position.y = (idle.baseY || 0) + bob;
        // 双臂左右反向小幅摆动
        if (idle.armPivots && idle.armPivots.length === 2) {
          const swing = reducedMotion ? 0 : Math.sin(phase) * 0.055;
          idle.armPivots[0].rotation.x = swing;
          idle.armPivots[1].rotation.x = -swing;
        }
      });
    }

    if (this._selectionRing) {
      this._selectionRing.visible = Boolean(this.selectedAgent && this._selectedAgentMesh);
      if (this._selectionRing.visible) {
        this._selectedAgentMesh.getWorldPosition(this._selectionRing.position);
        this._selectionRing.position.y = 0.252;
      }
    }

    if (this.controls && this.controls.update) { this.controls.enableDamping = !reducedMotion; this.controls.update(); }
    this._updateLabels();
    this.renderer.render(this.scene, this.camera);
  }
}

// Export
if (typeof window !== 'undefined') window.Enterprise3DScene = Enterprise3DScene;
