#!/usr/bin/env node
/*
 * Copyright (C) 2026 Synapxnet. All rights reserved.
 * This file is Synapxnet Proprietary and Confidential. It is strictly
 * forbidden to copy, distribute, or use without explicit authorization.
 * 企业空间表现状态与资源回归 / Enterprise spatial presentation state and resource regression.
 * Author: maoyo | Department: 研发部 | Date: 2026-09-14
 * Version: 1.0.0 | Security Level: INTERNAL
 * __version__: 1.0.0 | __author__: maoyo | __copyright__: Copyright 2026 Synapxnet
 * __maintainer__: maoyo | __email__: synapxnet@gmail.com
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const THREE = require('../static/libs/three/build/three.cjs');
const source = fs.readFileSync(path.join(__dirname, '../static/js/enterprise3d.js'), 'utf8');

/** 为标签和标牌提供最小 DOM，几何、材质与相机仍使用生产 Three.js。 Provide minimal label and sign DOM while using production Three.js geometry, materials and camera. */
function element(tag = 'div') {
  return {
    tagName: tag, children: [], parentNode: null, offsetWidth: 110, offsetHeight: 42, removed: false,
    style: { /** 保存标签样式变量。 Store a label style variable. */ setProperty(key, value) { this[key] = value; } },
    /** 添加可跟踪的标签节点。 Append a traceable label node. */
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    /** 按真实父子关系移除标签。 Remove a label from its actual parent. */
    remove() { this.removed = true; if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(/** 保留其他标签。 Keep other labels. */ child => child !== this); this.parentNode = null; },
    /** 提供标牌绘图接口，不模拟 GPU 渲染。 Provide sign drawing interfaces without pretending to render on a GPU. */
    getContext() { return { /** 绘图不影响场景结构验证。 Drawing does not affect scene structure verification. */ fillRect() {}, /** 文本不影响几何验证。 Text does not affect geometry verification. */ fillText() {} }; },
  };
}

/** 加载真实类而不启动 WebGL、定时器或设备。 Load the real class without starting WebGL, timers or devices. */
function makeScene(level = 2) {
  const context = {
    window: {}, document: { createElement: element, documentElement: { /** 使用浅色测试环境。 Use a light test environment. */ getAttribute() { return 'light'; } } },
    console: { /** 故意失败测试不输出无关告警。 Suppress expected warnings from deliberate failure tests. */ warn() {} },
    /** 记录取消的过渡，防止切换后旧镜头动画继续运行。 Record cancelled transitions so old camera animations cannot continue after switching. */
    cancelAnimationFrame(id) { context.cancelled.push(id); },
    cancelled: [],
  };
  vm.runInNewContext(source, context);
  const scene = Object.create(context.window.Enterprise3DScene.prototype);
  const bodyTypes = ['default', 'engineer', 'scholar', 'captain', 'ninja', 'robot', 'streamer', 'geek'];
  Object.assign(scene, {
    THREE, _disposed: false, _presentationStyle: 'studio', level,
    currentWsId: level ? 'workspace-a' : null, currentProjectId: level === 2 ? 'project-a' : null,
    workspaces: [{ id: 'workspace-a', name: '团队空间', type: 'local', path: '/private/path', apiKey: 'PRIVATE-WORKSPACE-KEY' }],
    projects: [{ id: 'project-a', workspaceId: 'workspace-a', name: '设计项目', floor: 1, color: '#2588cf', description: 'PRIVATE-PROJECT-DESCRIPTION' }],
    agents: bodyTypes.map(/** 创建带明确敏感字段的八类员工，用于检查身份与信息边界。 Create eight staff types with explicit private fields to check identity and information boundaries. */ (bodyType, index) => ({ id: `staff-${index}`, name: `成员 ${index}`, projectId: 'project-a', assignedWorkspace: 'workspace-a', bodyType, position3D: { x: index - 4, z: index % 2 ? 2 : -2 }, system_prompt: 'PRIVATE-SYSTEM-PROMPT', runtime_system_prompt: 'PRIVATE-RUNTIME-PROMPT', api_key: 'PRIVATE-API-KEY', task: { body: 'PRIVATE-TASK-BODY' } })),
    scene: new THREE.Scene(), _meshMap: new Map(), _labelEls: [], _sceneMaterials: new Map(), labelOverlay: element(),
    camera: new THREE.OrthographicCamera(-11, 11, 9, -9, 0.1, 1000),
    controls: { target: new THREE.Vector3(1.4, 1.3, -0.8), enabled: true, /** 切换表现不应推进阻尼镜头。 A presentation change must not advance a damped camera. */ update() { throw new Error('Unexpected camera control update'); } },
    renderer: { /** 背景更新不需要 GPU。 Background updates need no GPU. */ setClearColor() {} },
    /** 固定逻辑视口用于验证相机保持。 Fix the logical viewport to verify camera preservation. */
    _getContainerSize() { return { width: 1200, height: 800 }; },
  });
  scene.camera.position.set(21, 17, 13);
  scene.camera.lookAt(scene.controls.target);
  scene.camera.zoom = 1.17;
  scene.camera.updateProjectionMatrix();
  scene.camera.updateMatrixWorld();
  scene._ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial());
  scene.scene.add(scene._ground, new THREE.AmbientLight());
  if (level === 0) scene._buildCityView();
  else if (level === 1) scene._buildBuildingView('workspace-a');
  else scene._buildFloorView('project-a');
  scene.context = context;
  return scene;
}

/** 读取完整观察状态，不只检查缩放值。 Capture complete view state, not only zoom. */
function cameraState(scene) {
  return { position: scene.camera.position.toArray(), quaternion: scene.camera.quaternion.toArray(), projection: scene.camera.projectionMatrix.toArray(), zoom: scene.camera.zoom, frustum: [scene.camera.left, scene.camera.right, scene.camera.top, scene.camera.bottom, scene.camera.near, scene.camera.far], target: scene.controls.target.toArray() };
}

/** 汇总真实几何结构，不依赖风格名称或材质颜色判断差异。 Summarize actual geometry without relying on style names or material colors. */
function geometrySignature(scene) {
  const counts = {};
  scene.scene.traverse(/** 记录每种几何的顶点和网格数量。 Record vertex and mesh counts for every geometry type. */ object => {
    if (!object.geometry) return;
    const key = object.geometry.type;
    counts[key] ||= { meshes: 0, vertices: 0 };
    counts[key].meshes++;
    counts[key].vertices += object.geometry.attributes.position.count;
  });
  return JSON.stringify(counts);
}

/** 观察当前场景资源的真实 dispose 事件。 Observe actual dispose events for current scene resources. */
function watchResources(scene) {
  const resources = new Map();
  scene.scene.traverse(/** 按引用去重共享资源。 Deduplicate shared resources by reference. */ object => {
    if (object === scene._ground || object instanceof THREE.Light) return;
    if (object.geometry) resources.set(object.geometry, 0);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      resources.set(material, 0);
      if (material.map) resources.set(material.map, 0);
    }
  });
  for (const resource of resources.keys()) resource.addEventListener('dispose', /** 统计每次实际释放。 Count every actual disposal. */ () => resources.set(resource, resources.get(resource) + 1));
  return resources;
}

/** 三个业务层级均须有不同真实几何且保持视角与身份。 Every business level must have distinct real geometry while preserving view and identity. */
test('three presentations rebuild distinct geometry while preserving all three business levels and camera state', () => {
  for (const level of [0, 1, 2]) {
    const scene = makeScene(level);
    const initial = cameraState(scene);
    const data = JSON.stringify([scene.workspaces, scene.projects, scene.agents]);
    const keys = [...scene._meshMap.keys()];
    const identities = { level, workspace: scene.currentWsId, project: scene.currentProjectId };
    const signatures = [geometrySignature(scene)];
    for (const style of ['atrium', 'command']) {
      assert.equal(scene.setPresentationStyle(style), true);
      assert.equal(scene.getPresentationStyle(), style);
      signatures.push(geometrySignature(scene));
      assert.deepEqual(cameraState(scene), initial);
      assert.deepEqual([...scene._meshMap.keys()], keys);
      assert.deepEqual({ level: scene.level, workspace: scene.currentWsId, project: scene.currentProjectId }, identities);
      assert.equal(JSON.stringify([scene.workspaces, scene.projects, scene.agents]), data);
    }
    assert.equal(new Set(signatures).size, 3, `Level ${level} must use three actual geometry structures`);
  }
});

/** 选中员工及未落盘的拖动位置必须跨风格保持。 Selected staff and unsaved drag positions must survive style changes. */
test('switching retains selected staff, all eight avatars and on-screen drag positions before persistence', () => {
  const scene = makeScene();
  scene.selectedAgent = scene.agents[5];
  const mesh = scene._meshMap.get('agent-staff-5');
  mesh.position.set(4.125, 0.24, -3.75);
  mesh.rotation.y = 1.41;
  scene._selectedAgentMesh = mesh;
  scene._zoomFrame = 99;
  const selected = scene.selectedAgent;
  const view = cameraState(scene);
  for (const style of ['atrium', 'command', 'studio']) {
    assert.equal(scene.setPresentationStyle(style), true);
    assert.equal(scene.selectedAgent, selected);
    assert.notEqual(scene._selectedAgentMesh, mesh);
    assert.equal(scene._selectedAgentMesh, scene._meshMap.get('agent-staff-5'));
    assert.deepEqual(scene._selectedAgentMesh.position.toArray(), [4.125, 0.24, -3.75]);
    assert.equal(scene._selectedAgentMesh.rotation.y, 1.41);
    assert.deepEqual(cameraState(scene), view);
    assert.equal(scene._meshMap.size, 8);
    assert.deepEqual([...scene._meshMap.values()].map(/** 读取实际图形关联的角色类型。 Read the role type associated with each actual figure. */ figure => figure.userData.agent.bodyType), scene.agents.map(/** 读取原始角色类型。 Read the original role type. */ agent => agent.bodyType));
  }
  assert.deepEqual(scene.context.cancelled, [99]);
});

/** 重复切换释放旧资源和标签，每个共享对象仅释放一次。 Repeated switches release old resources and labels exactly once per shared object. */
test('repeated switching releases old geometry, shared materials, textures and labels without disposing retained ground', () => {
  const scene = makeScene();
  let groundDisposals = 0;
  scene._ground.material.addEventListener('dispose', /** 检测不应发生的地面释放。 Detect unexpected disposal of retained ground. */ () => groundDisposals++);
  const counts = new Map();
  for (const style of ['atrium', 'command', 'studio', 'atrium', 'command', 'studio']) {
    const resources = watchResources(scene);
    const labels = scene._labelEls.map(/** 保存旧标签引用。 Retain old label references. */ item => item.el);
    assert.equal(scene.setPresentationStyle(style), true);
    for (const count of resources.values()) assert.equal(count, 1);
    for (const label of labels) assert.equal(label.removed, true);
    assert.equal(scene.labelOverlay.children.length, 8);
    const count = [...scene._sceneMaterials.values()].length;
    if (counts.has(style)) assert.equal(count, counts.get(style)); else counts.set(style, count);
  }
  assert.equal(groundDisposals, 0);
});

/** 无效、重复或已释放场景上的切换不能产生副作用。 Invalid, duplicate and disposed-scene switches must not have side effects. */
test('invalid and unchanged presentation values do not rebuild, dispose or mutate the scene', () => {
  const scene = makeScene();
  const meshes = scene._meshMap;
  const resources = watchResources(scene);
  for (const value of [null, undefined, '', 'STUDIO', '../command', {}, ['atrium'], 'unknown']) assert.equal(scene.setPresentationStyle(value), false);
  assert.equal(scene.setPresentationStyle('studio'), true);
  assert.equal(scene._meshMap, meshes);
  assert.equal(scene.getPresentationStyle(), 'studio');
  for (const count of resources.values()) assert.equal(count, 0);
  scene._disposed = true;
  assert.equal(scene.setPresentationStyle('atrium'), false);
  assert.equal(scene._meshMap, meshes);
});

/** 新风格构建失败应回滚至完整旧场景并释放临时资源。 A failed style build must restore the complete old scene and release staged resources. */
test('failed presentation construction retains prior selection, geometry, labels and camera', () => {
  const scene = makeScene();
  scene.selectedAgent = scene.agents[1];
  scene._selectedAgentMesh = scene._meshMap.get('agent-staff-1');
  const previous = { scene: scene.scene, meshes: scene._meshMap, labels: scene._labelEls, materials: scene._sceneMaterials, selection: scene._selectionRing, selectedMesh: scene._selectedAgentMesh, bounds: scene._viewBounds };
  const resources = watchResources(scene);
  const camera = cameraState(scene);
  const build = scene._buildFloorView;
  let staged;
  /** 在真实新几何生成后注入失败，验证原子替换边界。 Inject failure after real geometry construction to verify the atomic replacement boundary. */
  scene._buildFloorView = function failAfterBuild(id) { build.call(this, id); staged = watchResources(this); throw new Error('Expected staged construction failure'); };
  assert.equal(scene.setPresentationStyle('command'), false);
  assert.equal(scene.getPresentationStyle(), 'studio');
  assert.equal(scene.scene, previous.scene);
  assert.equal(scene._meshMap, previous.meshes);
  assert.equal(scene._labelEls, previous.labels);
  assert.equal(scene._sceneMaterials, previous.materials);
  assert.equal(scene._selectionRing, previous.selection);
  assert.equal(scene._selectedAgentMesh, previous.selectedMesh);
  assert.equal(scene._viewBounds, previous.bounds);
  assert.deepEqual(cameraState(scene), camera);
  assert.equal(scene.labelOverlay.children.length, 8);
  for (const count of resources.values()) assert.equal(count, 0);
  for (const count of staged.values()) assert.equal(count, 1);
});

/** 公开快照必须只含白名单字段，并明确旧布局并非物理测量。 Public snapshots must contain only allowlisted fields and identify legacy layouts as unmeasured. */
test('public snapshots expose only bounded presentation fields and explicitly unmeasured legacy coordinates', () => {
  for (const level of [0, 1, 2]) {
    const scene = makeScene(level);
    const originalData = JSON.stringify([scene.workspaces, scene.projects, scene.agents]);
    let priorEntities;
    for (const style of ['studio', 'atrium', 'command']) {
      assert.equal(scene.setPresentationStyle(style), true);
      const snapshot = JSON.parse(JSON.stringify(scene.getSpatialSnapshot()));
      assert.deepEqual(Object.keys(snapshot).sort(), ['schema', 'schemaVersion', 'style', 'coordinateSystem', 'level', 'workspaceId', 'projectId', 'entities'].sort());
      assert.equal(snapshot.schema, 'openxnet.enterprise-spatial-snapshot.v1');
      assert.equal(snapshot.schemaVersion, 1);
      assert.equal(snapshot.style, style);
      assert.equal(snapshot.level, level);
      assert.deepEqual(snapshot.coordinateSystem, { units: 'meters', upAxis: 'Y', handedness: 'right', frameId: 'openxnet-enterprise-local', source: 'legacy_layout', metersPerLegacyUnit: 1, measured: false });
      assert.equal(snapshot.entities.length, [1, 7, 8][level]);
      assert.equal(snapshot.entities.filter(entity => entity.type === 'workspace').length, level === 0 ? 1 : 0);
      assert.equal(snapshot.entities.filter(entity => entity.type === 'project').length, level === 1 ? 1 : 0);
      assert.equal(snapshot.entities.filter(entity => entity.type === 'staff').length, [0, 6, 8][level]);
      for (const entity of snapshot.entities) {
        assert.deepEqual(Object.keys(entity).sort(), ['id', 'type', 'name', 'parentId', 'position'].sort());
        assert.equal(entity.parentId, { workspace: null, project: 'workspace-a', staff: 'project-a' }[entity.type]);
        assert.deepEqual(Object.keys(entity.position).sort(), ['x', 'y', 'z']);
        for (const value of Object.values(entity.position)) assert.ok(Number.isFinite(value));
      }
      assert.doesNotMatch(JSON.stringify(snapshot), /PRIVATE-|system_prompt|api_key|\/private\/path|description|task/);
      if (priorEntities) assert.deepEqual(snapshot.entities, priorEntities); else priorEntities = snapshot.entities;
    }
    assert.equal(JSON.stringify([scene.workspaces, scene.projects, scene.agents]), originalData);
  }
});

/** 快照仅返回当前可见有效实体，调用方不能反向改写业务数据。 Snapshots return only visible valid entities and cannot mutate business records through returned references. */
test('snapshot rejects hidden or invalid entities and returns detached public positions', () => {
  const scene = makeScene();
  const selected = scene._meshMap.get('agent-staff-5');
  selected.position.set(6.25, 0.24, -2.5);
  const first = scene.getSpatialSnapshot();
  const publicSelected = first.entities.find(/** 查找实际移动的员工。 Find the staff member that actually moved. */ entity => entity.id === 'staff-5');
  assert.deepEqual(JSON.parse(JSON.stringify(publicSelected.position)), { x: 6.25, y: 0.24, z: -2.5 });
  publicSelected.position.x = 900;
  publicSelected.name = 'changed by recipient';
  assert.equal(selected.position.x, 6.25);
  assert.equal(scene.agents[5].name, '成员 5');
  scene._meshMap.get('agent-staff-0').visible = false;
  scene._meshMap.get('agent-staff-1').position.x = NaN;
  scene.agents[2].id = 'invalid\u0000id';
  scene.agents[3].name = '名字\n' + '长'.repeat(300);
  const filtered = scene.getSpatialSnapshot();
  assert.equal(filtered.entities.length, 5);
  const ids = Array.from(filtered.entities, /** 返回公开标识。 Return the public identifier. */ entity => entity.id);
  assert.equal(ids.includes('staff-0'), false);
  assert.equal(ids.includes('staff-1'), false);
  assert.equal(ids.includes('invalid\u0000id'), false);
  const named = filtered.entities.find(/** 查找已规范的公开名称。 Find the normalized public name. */ entity => entity.id === 'staff-3');
  assert.equal(named.name.length, 160);
  assert.doesNotMatch(named.name, /[\u0000-\u001f\u007f]/);
  selected.parent.visible = false;
  assert.equal(scene.getSpatialSnapshot().entities.length, 0);
  selected.parent.visible = true;
  scene._disposed = true;
  assert.equal(scene.getSpatialSnapshot().entities.length, 0);
});
