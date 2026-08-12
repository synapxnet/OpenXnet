/**
 * OpenXnet Enterprise Sandbox 3D — Three.js 企业沙盘渲染引擎
 *
 * 基于角色卡数据渲染 3D Agent 化身，支持:
 *   - 办公场景 (办公桌、服务器架、会议桌)
 *   - Agent 胶囊人 (颜色来自角色卡)
 *   - 状态动画 (idle抖动/working键盘/thinking旋转/walk移动)
 *   - Raycaster 点击交互
 *   - 自动相机轨道控制
 *
 * 灵感: ralv.ai "Starcraft for AI Agents"
 *
 * @version 1.0.0
 * @author maoyo
 * @copyright 2026 Synapxnet
 */

(function () {
  'use strict';

  // 缓存 Three.js 模块
  let THREE = null;
  let OrbitControls = null;

  /**
   * 初始化 3D 沙盘场景
   * @param {HTMLCanvasElement} canvas - 画布元素
   * @param {Array} agents - Agent 数据数组
   * @param {Function} onAgentClick - Agent 点击回调
   * @returns {Object} 场景控制器
   */
  window.initSandbox3D = async function (canvas, agents, onAgentClick) {
    // 动态加载 Three.js
    if (!THREE) {
      try {
        THREE = await import('../libs/three/build/three.module.js');
        const orbitModule = await import('../libs/three/examples/jsm/controls/OrbitControls.js');
        OrbitControls = orbitModule.OrbitControls;
      } catch (e) {
        console.error('[Sandbox3D] Failed to load Three.js:', e);
        return null;
      }
    }

    // ═══════════════════════════════════════════
    // 场景基础设施
    // ═══════════════════════════════════════════
    const container = canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    const scene = new THREE.Scene();

    // 渐变背景 (深蓝 → 暗紫)
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 2;
    bgCanvas.height = 512;
    const bgCtx = bgCanvas.getContext('2d');
    const gradient = bgCtx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0a0a1a');
    gradient.addColorStop(0.5, '#12122a');
    gradient.addColorStop(1, '#1a1a3e');
    bgCtx.fillStyle = gradient;
    bgCtx.fillRect(0, 0, 2, 512);
    const bgTexture = new THREE.CanvasTexture(bgCanvas);
    scene.background = bgTexture;

    // 雾效
    scene.fog = new THREE.FogExp2(0x12122a, 0.02);

    // 相机
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(10, 12, 16);
    camera.lookAt(7, 0, 5);

    // 轨道控制
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 5;
    controls.maxDistance = 35;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.target.set(7, 0, 5);

    // ═══════════════════════════════════════════
    // 灯光系统
    // ═══════════════════════════════════════════
    const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xfff0dd, 1.2);
    directionalLight.position.set(12, 20, 8);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(2048, 2048);
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    // 点光源 (暖色氛围)
    const pointLight1 = new THREE.PointLight(0x409EFF, 0.8, 15);
    pointLight1.position.set(3, 4, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x9C27B0, 0.6, 15);
    pointLight2.position.set(11, 4, 10);
    scene.add(pointLight2);

    // ═══════════════════════════════════════════
    // 地面
    // ═══════════════════════════════════════════
    const floorGeo = new THREE.PlaneGeometry(20, 15);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.8,
      metalness: 0.2,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // 网格地面线条
    const gridHelper = new THREE.GridHelper(20, 40, 0x2a2a4e, 0x1e1e3a);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // ═══════════════════════════════════════════
    // 办公家具
    // ═══════════════════════════════════════════
    const furnitureMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a4e,
      roughness: 0.6,
      metalness: 0.3,
    });

    function createDesk(x, z) {
      const group = new THREE.Group();
      // 桌面
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.06, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x3a3a5e, roughness: 0.5, metalness: 0.4 })
      );
      top.position.set(0, 0.7, 0);
      top.castShadow = true;
      top.receiveShadow = true;
      group.add(top);
      // 桌腿
      const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x555577 });
      [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, 0.35, lz);
        leg.castShadow = true;
        group.add(leg);
      });
      // 显示器
      const monitor = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x111122, emissive: 0x223355, emissiveIntensity: 0.3 })
      );
      monitor.position.set(0, 1.05, -0.2);
      monitor.castShadow = true;
      group.add(monitor);
      // 屏幕发光
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x3366aa, transparent: true, opacity: 0.7 })
      );
      screen.position.set(0, 1.05, -0.18);
      group.add(screen);

      group.position.set(x, 0, z);
      scene.add(group);
      return group;
    }

    function createServerRack(x, z) {
      const group = new THREE.Group();
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 2.0, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.4, metalness: 0.6 })
      );
      rack.position.y = 1.0;
      rack.castShadow = true;
      group.add(rack);
      // LED 指示灯
      for (let i = 0; i < 6; i++) {
        const led = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 8, 8),
          new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x00ff00 : 0x409EFF })
        );
        led.position.set(-0.2, 0.4 + i * 0.25, 0.26);
        group.add(led);
      }
      group.position.set(x, 0, z);
      scene.add(group);
      return group;
    }

    function createMeetingTable(x, z) {
      const group = new THREE.Group();
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.08, 32),
        new THREE.MeshStandardMaterial({ color: 0x3a3a5e, roughness: 0.5, metalness: 0.4 })
      );
      table.position.y = 0.7;
      table.castShadow = true;
      table.receiveShadow = true;
      group.add(table);
      // 中央桌柱
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 0.7, 16),
        new THREE.MeshStandardMaterial({ color: 0x555577 })
      );
      pillar.position.y = 0.35;
      pillar.castShadow = true;
      group.add(pillar);
      group.position.set(x, 0, z);
      scene.add(group);
      return group;
    }

    // 放置家具
    const deskPositions = [
      [2, 2], [5, 2], [8, 2], [11, 2],
      [2, 6], [5, 6], [8, 6], [11, 6],
    ];
    deskPositions.forEach(([x, z]) => createDesk(x, z));
    createMeetingTable(7, 10);
    createServerRack(14, 1);
    createServerRack(14, 2.5);

    // ═══════════════════════════════════════════
    // Agent 胶囊人渲染
    // ═══════════════════════════════════════════
    const agentMeshes = new Map(); // agent.id → THREE.Group
    const raycasterTargets = [];

    function hexToInt(hex) {
      return parseInt(hex.replace('#', ''), 16);
    }

    function createAgentMesh(agent) {
      const group = new THREE.Group();
      group.userData.agentId = agent.id;
      group.userData.agentData = agent;

      const color = hexToInt(agent.avatar_color || '#409EFF');

      // 身体 (胶囊)
      const bodyGeo = new THREE.CapsuleGeometry(0.2, 0.5, 8, 16);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.4,
        metalness: 0.3,
        emissive: color,
        emissiveIntensity: 0.1,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.65;
      body.castShadow = true;
      group.add(body);

      // 头部
      const headGeo = new THREE.SphereGeometry(0.18, 16, 16);
      const headMat = new THREE.MeshStandardMaterial({
        color: 0xffddbb,
        roughness: 0.6,
      });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 1.15;
      head.castShadow = true;
      group.add(head);

      // 名牌 (Sprite)
      const nameCanvas = document.createElement('canvas');
      nameCanvas.width = 256;
      nameCanvas.height = 64;
      const ctx = nameCanvas.getContext('2d');
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.roundRect(4, 4, 248, 56, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const displayName = agent.name.length > 8 ? agent.name.slice(0, 8) + '…' : agent.name;
      ctx.fillText(displayName, 128, 32);

      const nameTex = new THREE.CanvasTexture(nameCanvas);
      const nameSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: nameTex, transparent: true })
      );
      nameSprite.scale.set(1.2, 0.3, 1);
      nameSprite.position.y = 1.55;
      group.add(nameSprite);

      // 状态指示环
      const statusRingGeo = new THREE.RingGeometry(0.25, 0.3, 32);
      const statusColor = agent.status === 'working' ? 0x67C23A :
                          agent.status === 'error' ? 0xF56C6C :
                          agent.status === 'thinking' ? 0xE6A23C : 0x909399;
      const statusRingMat = new THREE.MeshBasicMaterial({
        color: statusColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const statusRing = new THREE.Mesh(statusRingGeo, statusRingMat);
      statusRing.rotation.x = -Math.PI / 2;
      statusRing.position.y = 0.02;
      group.add(statusRing);
      group._statusRing = statusRing;
      group._body = body;

      // 位置
      const pos = agent.position || { x: 0, z: 0 };
      group.position.set(pos.x, 0, pos.z);

      scene.add(group);
      agentMeshes.set(agent.id, group);
      raycasterTargets.push(body, head);

      return group;
    }

    // 初始化所有 Agent
    (agents || []).forEach(a => createAgentMesh(a));

    // ═══════════════════════════════════════════
    // 动画循环
    // ═══════════════════════════════════════════
    const clock = new THREE.Clock();
    let animationId = null;

    function animate() {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const delta = clock.getDelta();

      // Agent 动画
      agentMeshes.forEach((group) => {
        const agent = group.userData.agentData;
        if (!agent) return;

        const body = group._body;
        const statusRing = group._statusRing;

        // 状态动画
        switch (agent.animation || agent.status) {
          case 'typing':
          case 'working':
            // 轻微上下抖动模拟打字
            if (body) body.position.y = 0.65 + Math.sin(elapsed * 8) * 0.015;
            break;
          case 'thinking':
            // 缓慢旋转
            group.rotation.y = Math.sin(elapsed * 0.5) * 0.3;
            if (body) body.position.y = 0.65 + Math.sin(elapsed * 2) * 0.03;
            break;
          case 'walk':
            // 走路摇摆
            group.rotation.y = Math.sin(elapsed * 3) * 0.1;
            if (body) body.position.y = 0.65 + Math.abs(Math.sin(elapsed * 6)) * 0.05;
            break;
          default: // idle
            // 微弱呼吸效果
            if (body) body.position.y = 0.65 + Math.sin(elapsed * 1.5) * 0.008;
            break;
        }

        // 状态环脉动
        if (statusRing) {
          const pulse = 0.6 + Math.sin(elapsed * 2) * 0.2;
          statusRing.material.opacity = pulse;
        }
      });

      // LED 闪烁 (服务器架)
      scene.traverse(obj => {
        if (obj.isMesh && obj.geometry?.type === 'SphereGeometry' &&
            obj.geometry.parameters?.radius === 0.02) {
          obj.material.opacity = 0.5 + Math.random() * 0.5;
          obj.material.transparent = true;
        }
      });

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // ═══════════════════════════════════════════
    // Raycaster 点击交互
    // ═══════════════════════════════════════════
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(raycasterTargets, false);

      if (intersects.length > 0) {
        // 找到对应的 Agent
        let target = intersects[0].object;
        while (target && !target.userData?.agentId) {
          target = target.parent;
        }
        if (target && target.userData?.agentData && onAgentClick) {
          onAgentClick(target.userData.agentData);
        }
      }
    });

    // ═══════════════════════════════════════════
    // 窗口自适应
    // ═══════════════════════════════════════════
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // ═══════════════════════════════════════════
    // 返回控制器 API
    // ═══════════════════════════════════════════
    return {
      /**
       * 更新所有 Agent 数据并刷新 3D 渲染
       */
      updateAgents(newAgents) {
        const existingIds = new Set(agentMeshes.keys());
        const newIds = new Set((newAgents || []).map(a => a.id));

        // 删除不存在的
        existingIds.forEach(id => {
          if (!newIds.has(id)) {
            const mesh = agentMeshes.get(id);
            if (mesh) {
              scene.remove(mesh);
              agentMeshes.delete(id);
            }
          }
        });

        // 新增或更新
        (newAgents || []).forEach(agent => {
          if (agentMeshes.has(agent.id)) {
            // 更新位置和状态
            const group = agentMeshes.get(agent.id);
            group.userData.agentData = agent;
            const pos = agent.position || { x: 0, z: 0 };
            group.position.set(pos.x, 0, pos.z);

            // 更新状态环颜色
            if (group._statusRing) {
              const statusColor = agent.status === 'working' ? 0x67C23A :
                                  agent.status === 'error' ? 0xF56C6C :
                                  agent.status === 'thinking' ? 0xE6A23C : 0x909399;
              group._statusRing.material.color.setHex(statusColor);
            }
          } else {
            createAgentMesh(agent);
          }
        });
      },

      /**
       * 销毁场景，释放资源
       */
      dispose() {
        if (animationId) cancelAnimationFrame(animationId);
        resizeObserver.disconnect();
        controls.dispose();
        renderer.dispose();

        // 清理所有几何体和材质
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      },
    };
  };
})();
