// 在页面加载完成后添加 content-loaded 类
window.openxnetStartup?.mark('renderer-script-start');
document.addEventListener('DOMContentLoaded', function() {
  // 设置一个短暂的延迟，确保所有资源都已加载
  setTimeout(function() {
    document.body.classList.add('content-loaded');
  }, 100);
});

/**
 * Mark the Vue workspace as hydrated and notify the Electron window lifecycle.
 */
function markWorkspaceReady() {
  document.body.classList.add('content-loaded', 'app-hydrated');
  window.electronAPI?.notifyWorkspaceReady?.();
  const bootSplash = document.getElementById('boot-splash');
  if (bootSplash && !bootSplash.dataset.dismissed) {
    bootSplash.dataset.dismissed = 'true';
    window.setTimeout(function() {
      if (bootSplash.parentNode) {
        bootSplash.remove();
      }
    }, 320);
  }
}

/**
 * Apply a serialized Desktop Core snapshot to reactive Vue state.
 *
 * @param {object} viewModel Mounted OpenXnet Vue instance.
 * @param {object} snapshot Desktop Core snapshot received through Preload.
 */
function applyDesktopCoreState(viewModel, snapshot) {
  viewModel.desktopCoreState = snapshot && typeof snapshot === 'object' ? snapshot : null;
}

/**
 * Connect the mounted Vue application to Desktop Core lifecycle updates.
 *
 * @param {object} viewModel Mounted OpenXnet Vue instance.
 * @returns {Promise<void>} Completion after the initial state request.
 */
async function connectDesktopCoreState(viewModel) {
  if (!window.openxnetDesktop?.getState || !window.openxnetDesktop?.onStateChanged) {
    return;
  }
  try {
    const bootstrap = await (window.openxnetBootstrapPromise || Promise.resolve(null));
    if (bootstrap?.systemSettings?.settings) {
      viewModel.systemSettings = {
        ...viewModel.systemSettings,
        ...bootstrap.systemSettings.settings,
        network: 'local',
      };
      document.documentElement.setAttribute(
        'data-theme',
        resolveOpenXnetDomTheme(viewModel.systemSettings.theme),
      );
      document.documentElement.setAttribute(
        'data-theme-choice',
        viewModel.systemSettings.theme || 'party',
      );
      persistThemePreference(viewModel.systemSettings.theme);
    }
    applyDesktopCoreState(
      viewModel,
      bootstrap?.core || await window.openxnetDesktop.getState(),
    );
    viewModel.desktopCoreUnsubscribe?.();
    viewModel.desktopCoreUnsubscribe = window.openxnetDesktop.onStateChanged((snapshot) => {
      applyDesktopCoreState(viewModel, snapshot);
    });
  } catch (error) {
    console.error('Connect Desktop Core state failed:', error);
  }
}

/**
 * Connect the mounted task surfaces to Core-owned execution snapshot events.
 *
 * @param {object} viewModel Mounted OpenXnet Vue instance.
 */
function connectTaskExecutionState(viewModel) {
  if (typeof window.openxnetDesktop?.onTaskExecutionChanged !== 'function') return;
  viewModel.taskExecutionUnsubscribe?.();
  viewModel.taskExecutionUnsubscribe = window.openxnetDesktop.onTaskExecutionChanged((snapshot) => {
    viewModel.applyApplicationTaskSnapshot?.(snapshot);
    if (!viewModel.viewingTaskDetail) return;
    const updated = viewModel.taskList.find((task) => (
      task.task_id === viewModel.viewingTaskDetail.task_id
    ));
    if (updated) {
      viewModel.viewingTaskDetail = { ...viewModel.viewingTaskDetail, ...updated };
    }
  });
}

function persistThemePreference(theme) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('openxnet-theme', String(theme || 'party'));
    }
  } catch (error) {
    console.warn('Failed to persist theme preference:', error);
  }
}

function resolveOpenXnetDomTheme(theme) {
  const normalized = String(theme || 'party').trim().toLowerCase();
  if (typeof window !== 'undefined' && typeof window.normalizeOpenXnetThemeForDom === 'function') {
    return window.normalizeOpenXnetThemeForDom(normalized);
  }
  return normalized === 'party' ? 'light' : normalized;
}

function formatAcceleratorLabel(accelerator, isMac) {
  const raw = String(accelerator || '').trim();
  if (!raw) return '';

  const aliasMap = {
    CommandOrControl: isMac ? 'Cmd' : 'Ctrl',
    Command: 'Cmd',
    Control: 'Ctrl',
    Ctrl: 'Ctrl',
    Alt: 'Alt',
    Option: 'Alt',
    Shift: 'Shift',
    Space: 'Space',
  };

  return raw.split('+').map((part) => aliasMap[part] || part).join('+');
}

function normalizeDesktopSceneRect(rect, fallback = {}) {
  const left = Number(rect?.left ?? rect?.x ?? fallback.left ?? 0);
  const top = Number(rect?.top ?? rect?.y ?? fallback.top ?? 0);
  const widthValue = Number(rect?.width ?? fallback.width ?? 0);
  const heightValue = Number(rect?.height ?? fallback.height ?? 0);
  const rightCandidate = Number(rect?.right ?? (left + widthValue));
  const bottomCandidate = Number(rect?.bottom ?? (top + heightValue));
  const width = widthValue > 0 ? widthValue : Math.max(0, rightCandidate - left);
  const height = heightValue > 0 ? heightValue : Math.max(0, bottomCandidate - top);

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function buildDesktopSceneStyle(rect, viewport, extras = {}) {
  if (!rect || !viewport || viewport.width <= 0 || viewport.height <= 0) {
    return { display: 'none' };
  }

  return {
    left: `${((rect.left - viewport.left) / viewport.width) * 100}%`,
    top: `${((rect.top - viewport.top) / viewport.height) * 100}%`,
    width: `${(rect.width / viewport.width) * 100}%`,
    height: `${(rect.height / viewport.height) * 100}%`,
    ...extras,
  };
}

function buildDesktopSceneInsetStyle(rect, containerRect) {
  if (!rect || !containerRect || containerRect.width <= 0 || containerRect.height <= 0) {
    return { display: 'none' };
  }

  return {
    left: `${((rect.left - containerRect.left) / containerRect.width) * 100}%`,
    top: `${((rect.top - containerRect.top) / containerRect.height) * 100}%`,
    width: `${(rect.width / containerRect.width) * 100}%`,
    height: `${(rect.height / containerRect.height) * 100}%`,
  };
}

// ==========================================
// 1. 定义 A2UI 渲染组件 (支持 Markdown 渲染)
// ==========================================
const A2UIRendererComponent = {
  name: 'A2UIRenderer',
  components: {}, 
  template: `
    <div :class="['a2ui-root', isSelfContained ? 'a2ui-root-clean' : 'a2ui-root-boxed']">
      
      <!-- 根标题 -->
      <div v-if="uiConfig.props && uiConfig.props.title && !isSelfContained" class="a2ui-title">
        {{ uiConfig.props.title }}
      </div>
      <!-- 根描述 (也支持 MD) -->
      <div 
        v-if="uiConfig.props && uiConfig.props.description && !isSelfContained" 
        class="a2ui-text-content markdown-body" 
        style="color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 15px;"
        v-html="renderMarkdown(uiConfig.props.description)"
      ></div>

      <el-form :model="formData" label-position="top" size="default" @submit.prevent>
        
        <div :class="containerClass">
          
          <template v-for="(item, index) in normalizedChildren" :key="index">
            
            <!-- 1. Input -->
            <el-form-item 
              v-if="item.type === 'Input'" 
              :label="item.props.label" 
              style="margin-bottom: 15px; flex: 1; min-width: 200px;"
            >
              <el-input 
                v-model="formData[item.props.key || ('input_'+index)]" 
                :placeholder="item.props.placeholder || '请输入...'"
                size="large"
              >
                <template #append v-if="item.props.action === 'search'">
                  <el-button @click="handleAction(item, formData[item.props.key || ('input_'+index)])">
                    <i class="fa-solid fa-magnifying-glass"></i>
                  </el-button>
                </template>
              </el-input>
            </el-form-item>

            <!-- 2. Select -->
            <el-form-item 
              v-if="item.type === 'Select'" 
              :label="item.props.label"
              style="margin-bottom: 15px; flex: 1;"
            >
              <el-select 
                v-model="formData[item.props.key]" 
                :placeholder="item.props.placeholder || '请选择'" 
                style="width: 100%"
                size="large"
              >
                <el-option 
                  v-for="(opt, oIdx) in item.props.options" 
                  :key="oIdx" 
                  :label="isObj(opt) ? opt.label : opt" 
                  :value="isObj(opt) ? opt.value : opt" 
                />
              </el-select>
            </el-form-item>

            <!-- 3. Text (★ 修复点：使用 v-html + Markdown) -->
            <!-- 添加 markdown-body 类以复用你的全局 MD 样式 -->
            <div 
              v-if="item.type === 'Text'" 
              class="a2ui-text-content markdown-body"
              v-html="renderMarkdown(item.props.content)"
            ></div>

            <!-- 4. Divider -->
            <el-divider 
              v-if="item.type === 'Divider'" 
              style="margin: 18px 0; border-color: var(--el-border-color-lighter);" 
            />

            <!-- 5. Group -->
            <div v-if="item.type === 'Group'" class="a2ui-group-container">
               <div v-if="item.props && item.props.title" style="width: 100%; font-weight: bold; margin-bottom: 8px; font-size: 14px;">
                  {{ item.props.title }}
               </div>
              <!-- ★ 修改点：添加 :shared-form-data="formData" -->
              <a2-u-i-renderer 
                v-for="(child, cIdx) in item.children" 
                :key="cIdx" 
                :config="child"
                :shared-form-data="formData" 
                @action="relayAction"
                style="flex: 1; min-width: auto;" 
              />
            </div>

            <!-- 6. List -->
            <div v-if="item.type === 'List'" class="a2ui-list">
              <div 
                v-for="(listItem, lIdx) in item.props.items" 
                :key="lIdx" 
                class="a2ui-list-item"
                @click="handleManualAction('点击条目', listItem.title)"
              >
                <div class="a2ui-list-title">{{ listItem.title }}</div>
                <div class="a2ui-list-desc">{{ listItem.description }}</div>
                <div class="a2ui-list-meta">
                  <span v-if="listItem.source" class="tag">{{ listItem.source }}</span>
                  <span class="time">{{ listItem.timestamp }}</span>
                </div>
              </div>
            </div>

            <!-- 7. Card -->
            <el-card 
              v-if="item.type === 'Card'" 
              shadow="hover" 
              class="a2ui-inner-card"
            >
              <template #header v-if="item.props.title">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-weight: bold; font-size: 16px;">{{ item.props.title }}</span>
                  <span v-if="item.props.subtitle" style="font-size: 12px; color: #909399; font-weight: normal;">{{ item.props.subtitle }}</span>
                </div>
              </template>
              
              <!-- ★ 修复点 1：独立渲染 Card 的 content，不再使用 v-else -->
              <!-- 这样，无论有没有 children，只要 content 存在就会显示 -->
              <div 
                v-if="item.props.content || item.props.description" 
                class="a2ui-card-desc markdown-body"
                style="margin-bottom: 15px;"
              >
                <div v-if="Array.isArray(item.props.content)">
                    <div v-for="(line, lIdx) in item.props.content" :key="lIdx" v-html="renderMarkdown(line)"></div>
                </div>
                <div v-else-if="item.props.content" v-html="renderMarkdown(item.props.content)"></div>
                <div v-else-if="item.props.description" v-html="renderMarkdown(item.props.description)"></div>
              </div>

              <!-- ★ 修复点 2：独立渲染 Card 的 children -->
              <div v-if="item.children && item.children.length > 0">
                 <!-- ★ 修改点：添加 :shared-form-data="formData" -->
                 <a2-u-i-renderer 
                    v-for="(child, ccIdx) in item.children" 
                    :key="ccIdx" 
                    :config="child"
                    :shared-form-data="formData"
                    @action="relayAction"
                 />
              </div>

              <div class="tags" v-if="item.props.tags" style="margin-top: 12px;">
                <el-tag v-for="tag in item.props.tags" :key="tag" size="default" effect="plain" style="margin-right: 6px;">
                  {{ tag }}
                </el-tag>
              </div>

              <div v-if="item.props.actions" class="a2ui-card-actions">
                <el-button 
                    v-for="(btn, bIdx) in item.props.actions"
                    :key="bIdx"
                    :type="bIdx === item.props.actions.length - 1 ? 'primary' : ''"
                    size="default"
                    @click="handleManualAction(btn.label, item.props.title)"
                >
                    {{ btn.label }}
                </el-button>
              </div>
            </el-card>

            <!-- 8. Button (Description 也支持 Markdown) -->
            <div 
              v-if="item.type === 'Button'" 
              :style="buttonStyle"
            >
              <el-button 
                v-if="item.props.description"
                :type="resolveBtnType(item.props)"
                @click="handleAction(item)" 
                :disabled="isSubmitted"
                size="large"
                style="height: auto; padding: 12px 20px; text-align: left; display: inline-flex; flex-direction: column; align-items: flex-start; line-height: 1.4; width: 100%;"
              >
                <span style="font-weight: 600; font-size: 15px;">{{ item.props.label }}</span>
                <span style="font-size: 12px; opacity: 0.8; font-weight: normal; margin-top: 4px;" v-html="renderMarkdown(item.props.description)"></span>
              </el-button>

              <el-button 
                v-else
                :type="resolveBtnType(item.props)" 
                @click="handleAction(item)" 
                :disabled="isSubmitted"
                size="large" 
                style="width: 100%; font-weight: 500;"
              >
                {{ item.props.label }}
              </el-button>
            </div>

            <!-- 9. Slider (滑块) -->
            <el-form-item 
              v-if="item.type === 'Slider'" 
              :label="item.props.label"
              style="margin-bottom: 15px; flex: 1; min-width: 200px;"
            >
              <div style="display: flex; align-items: center; width: 100%;">
                <el-slider 
                  v-model="formData[item.props.key]" 
                  :min="item.props.min || 0" 
                  :max="item.props.max || 100"
                  :step="item.props.step || 1"
                  show-input
                  size="default"
                  style="flex: 1; margin-right: 10px;"
                />
                <span v-if="item.props.unit" style="font-size: 12px; color: #909399;">{{ item.props.unit }}</span>
              </div>
            </el-form-item>

            <!-- 10. Switch (开关) -->
            <el-form-item 
              v-if="item.type === 'Switch'" 
              :label="item.props.label"
              style="margin-bottom: 15px;"
            >
              <el-switch 
                v-model="formData[item.props.key]" 
                :active-text="item.props.activeText || '开'"
                :inactive-text="item.props.inactiveText || '关'"
              />
            </el-form-item>

            <!-- 11. Radio (单选组) -->
            <el-form-item 
              v-if="item.type === 'Radio'" 
              :label="item.props.label"
              style="margin-bottom: 15px;"
            >
              <el-radio-group v-model="formData[item.props.key]">
                <el-radio 
                  v-for="(opt, oIdx) in item.props.options" 
                  :key="oIdx" 
                  :label="isObj(opt) ? opt.value : opt"
                  border
                >
                  {{ isObj(opt) ? opt.label : opt }}
                </el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 12. Checkbox (多选组) -->
            <el-form-item 
              v-if="item.type === 'Checkbox'" 
              :label="item.props.label"
              style="margin-bottom: 15px;"
            >
              <el-checkbox-group v-model="formData[item.props.key]">
                <el-checkbox 
                  v-for="(opt, oIdx) in item.props.options" 
                  :key="oIdx" 
                  :label="isObj(opt) ? opt.value : opt"
                >
                  {{ isObj(opt) ? opt.label : opt }}
                </el-checkbox>
              </el-checkbox-group>
            </el-form-item>

            <!-- 13. DatePicker (日期选择) -->
            <el-form-item 
              v-if="item.type === 'DatePicker'" 
              :label="item.props.label"
              style="margin-bottom: 15px;"
            >
              <el-date-picker
                v-model="formData[item.props.key]"
                :type="item.props.subtype || 'date'" 
                :placeholder="item.props.placeholder || '选择日期'"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%;"
              />
            </el-form-item>
            
            <!-- 14. Rate (评分) -->
            <el-form-item 
              v-if="item.type === 'Rate'" 
              :label="item.props.label"
              style="margin-bottom: 15px;"
            >
              <el-rate 
                v-model="formData[item.props.key]" 
                allow-half 
                show-text
                :texts="['极差', '失望', '一般', '满意', '惊喜']"
              />
            </el-form-item>

             <!-- 15. Alert (提示条) -->
             <div v-if="item.type === 'Alert'" style="margin-bottom: 15px; width: 100%;">
                <el-alert
                    :title="item.props.title"
                    :type="item.props.variant || 'info'"
                    :show-icon="item.props.showIcon !== false"
                    :closable="false"
                >
                    <template #default v-if="item.props.content">
                        <div v-html="renderMarkdown(item.props.content)"></div>
                    </template>
                </el-alert>
             </div>

            <!-- 16. Code (代码块 - 独立渲染，无额外 wrapper) -->
            <div 
              v-if="item.type === 'Code'" 
              class="a2ui-code-block"
            >
              <div class="code-header">
                <span class="lang-tag">{{ item.props.language || 'text' }}</span>
                <div class="copy-btn" @click="copyToClipboard(item.props.content, $event)">
                  <i class="fa-regular fa-copy"></i>
                  <span>copy</span>
                </div>
              </div>
              <div class="code-body">
                <pre><code>{{ item.props.content }}</code></pre>
              </div>
            </div>

            <!-- 17. Table (表格组件) -->
            <div 
              v-if="item.type === 'Table'" 
              class="a2ui-table-wrapper"
            >
              <div class="a2ui-table-scroll">
                <table class="a2ui-table">
                  <thead>
                    <tr>
                      <th v-for="(head, hIdx) in item.props.headers" :key="hIdx">
                        {{ head }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rIdx) in item.props.rows" :key="rIdx">
                      <!-- 支持简单 HTML 或纯文本 -->
                      <td v-for="(cell, cIdx) in row" :key="cIdx" v-html="renderMarkdown(String(cell))"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 18. 朗读文本块 -->
            <div 
              v-if="item.type === 'TTSBlock'" 
              class="a2ui-tts-block"
              @click="handleTTS(item.props.content, item.props.voice)"
              title="点击播放语音"
            >
              <div class="tts-icon">
                <i class="fa-solid fa-volume-high"></i>
              </div>
              <div class="tts-body">
                <div class="tts-label" v-if="item.props.label">{{ item.props.label }}</div>
                <div class="tts-content markdown-body" v-html="renderMarkdown(item.props.content)"></div>
              </div>
              <div class="tts-action-hint">
                <i class="fa-solid fa-play"></i>
              </div>
            </div>

            <div 
              v-if="item.type === 'Audio'" 
              class="a2ui-audio-player"
              style="margin-bottom: 15px; width: 100%;"
            >
              <div v-if="item.props.title" style="font-weight: bold; margin-bottom: 5px; font-size: 14px;">
                {{ item.props.title }}
              </div>
              <audio controls style="width: 100%; height: 40px;" :src="item.props.src">
                您的浏览器不支持音频元素。
              </audio>
              <div v-if="item.props.description" style="font-size: 12px; color: #909399; margin-top: 4px;">
                {{ item.props.description }}
              </div>
            </div>

          </template>
        </div>
      </el-form>
    </div>
  `,
  props: {
    config: { type: Object, required: true, default: () => ({}) },
    sharedFormData: { type: Object, default: null } 
  },
  data() {
    return { internalFormData: {}, isSubmitted: false };
  },
  computed: {
    activeDownloadCount() {
        return this.downloads.filter(d => d.state === 'progressing').length;
    },
    formData() {
      return this.sharedFormData || this.internalFormData;
    },
    uiConfig() {
      if (Array.isArray(this.config)) return { children: this.config };
      return this.config || {};
    },
    isSelfContained() {
      return ['Card', 'Group', 'List', 'Divider'].includes(this.uiConfig.type);
    },
    normalizedChildren() {
        const conf = this.uiConfig;
        if (conf.children && Array.isArray(conf.children)) {
            return conf.children;
        }
        if (conf.type) {
            return [conf];
        }
        return [];
    },
    containerClass() {
      if (this.uiConfig.type === 'Group') {
        return 'a2ui-group-container';
      }
      return 'a2ui-form-container';
    },
    buttonStyle() {
      if (this.uiConfig.type === 'Group') {
        return { margin: '0 5px', flex: '1' };
      }
      return { textAlign: 'right', marginTop: '10px', width: '100%' };
    }
  },
  created() {
    this.normalizedChildren.forEach((child, idx) => {
      // 需要绑定数据的组件列表
      const formComponents = ['Input', 'Select', 'Slider', 'Switch', 'Radio', 'Checkbox', 'DatePicker', 'Rate'];
      
      if (formComponents.includes(child.type)) {
         const key = (child.props && child.props.key) || (child.type.toLowerCase() + '_' + idx);
         
         if (this.formData[key] === undefined) {
            // 根据组件类型初始化默认值
            if (child.type === 'Checkbox') {
                this.formData[key] = []; // 多选必须初始化为数组
            } else if (child.type === 'Slider' || child.type === 'Rate') {
                this.formData[key] = child.props.min || 0; // 数字类型
            } else if (child.type === 'Switch') {
                this.formData[key] = child.props.defaultValue || false; // 布尔类型
            } else {
                this.formData[key] = ''; // 字符串类型
            }
         }
      }
    });
  },
  methods: {
    resetForm() {
      // 定义递归函数：遍历所有层级寻找表单项
      const traverseAndReset = (items) => {
        if (!Array.isArray(items)) return;

        items.forEach(item => {
          // 递归：如果是容器组件 (Group, Card 等)，继续深入查找
          if (item.children && Array.isArray(item.children)) {
            traverseAndReset(item.children);
          }

          // 处理：如果是表单组件，执行重置
          const formComponents = ['Input', 'Select', 'Slider', 'Switch', 'Radio', 'Checkbox', 'DatePicker', 'Rate'];
          
          if (formComponents.includes(item.type)) {
             // 获取绑定的 key
             const key = (item.props && item.props.key);
             if (!key) return; // 忽略无 key 的组件
             
             // 根据组件类型恢复默认值
             if (item.type === 'Checkbox') {
                 this.formData[key] = []; // 多选 -> 空数组
             } else if (item.type === 'Slider' || item.type === 'Rate') {
                 this.formData[key] = item.props.min || 0; // 数字 -> 0
             } else if (item.type === 'Switch') {
                 this.formData[key] = item.props.defaultValue || false; // 开关 -> false
             } else {
                 this.formData[key] = ''; // 其他文本类 -> 空字符串
             }
          }
        });
      };

      // 从当前组件的根子节点开始递归
      traverseAndReset(this.normalizedChildren);

      // 重置提交状态
      this.isSubmitted = false;
      
      // 界面反馈
      if (typeof showNotification === 'function') {
          showNotification('已重置所有选项', 'success');
      }
    },
    handleTTS(text, voice) {
      // 尝试调用根组件的 ClickToListen 方法
      if (this.$root && typeof this.$root.ClickToListen === 'function') {
        this.$root.ClickToListen(text, voice);
      } else {
        console.warn('A2UI: 根实例上未找到 ClickToListen 方法。');
        this.$emit('action', `TTS播放请求: ${text}`); // 降级处理
      }
    },

    async copyToClipboard(text, event) {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        
        // 简单的交互反馈：修改按钮文字
        const btn = event.currentTarget;
        const originalHtml = btn.innerHTML;
        const span = btn.querySelector('span');
        if(span) span.innerText = 'Copied!';
        
        setTimeout(() => {
          btn.innerHTML = originalHtml;
        }, 2000);
        
        // 如果你有全局提示组件，也可以用：
        // showNotification('代码已复制', 'success');
      } catch (err) {
        console.error('复制失败:', err);
      }
    },

    // 渲染 Markdown 的核心方法
    renderMarkdown(text) {
        if (!text) return '';
        // 尝试使用全局定义的 md 对象
        if (typeof md !== 'undefined' && md.render) {
            return md.render(text);
        }
        // 兜底：如果没有 md，简单的换行处理
        return text.replace(/\n/g, '<br>');
    },
    isObj(val) {
      return val && typeof val === 'object';
    },
    resolveBtnType(props) {
        if (props.variant === 'primary') return 'primary';
        if (props.variant === 'danger') return 'danger';
        return props.type || 'default';
    },
handleAction(item, extraValue) {
      // ... (保留之前的 Clear/Reset 拦截逻辑) ...
      if (item.props.action === 'clear' || item.props.action === 'reset') {
          if (this.sharedFormData) {
              this.$emit('action', '_A2UI_RESET_ALL_'); 
          } else {
              this.resetForm();
          }
          return; 
      }

      // ---------------------------------------------------------
      // ★ 常规业务逻辑 (Submit / Search)
      // ---------------------------------------------------------
      this.isSubmitted = true;
      let payload = item.props.label;
      
      if (item.props.action === 'search' && extraValue) {
          payload = `搜索：${extraValue}`;
      }
      else if (item.props.action === 'submit') {
        const formDataKeys = Object.keys(this.formData);
        
        // 场景A: 单字段表单，直接发送 "标签：值"
        if (formDataKeys.length === 1 && this.formData[formDataKeys[0]]) {
            const singleValue = this.formData[formDataKeys[0]];
            payload = `${item.props.label}：${singleValue}`;
        } 
        // 场景B: 多字段表单，发送汇总详情
        else {
            let details = [];
            const findFieldLabel = (nodes, targetKey) => {
                for (const node of nodes) {
                    if (node.props && node.props.key === targetKey) return node.props.label;
                    if (node.children) {
                        const found = findFieldLabel(node.children, targetKey);
                        if (found) return found;
                    }
                }
                return targetKey; 
            };

            for (const [key, val] of Object.entries(this.formData)) {
                 if (val === undefined || val === '' || val === null || (Array.isArray(val) && val.length === 0)) continue;
                 
                 const label = findFieldLabel(this.normalizedChildren, key);
                 let displayVal = val;
                 details.push(`${label}：${displayVal}`);
            }
            
            if (details.length > 0) {
                // ============================================================
                // ★ 修复重点在此处 ★
                // 原代码：payload = `表单提交：\n${details.join('\n')}`;
                // 修改为：将按钮名称 (item.props.label) 明确拼接到消息头部
                // ============================================================
                payload = `提交操作：${item.props.label}\n表单数据：\n${details.join('\n')}`;
            } else {
                // 如果表单全是空的，保留按钮名称
                payload = `${item.props.label} (空表单提交)`;
            }
        }
      } 
      else if (item.props.data) {
          payload = `选择操作：${item.props.label} (ID:${item.props.data})`;
      }
      
      // 发送最终 payload 给父级
      this.$emit('action', payload);
    },

    handleManualAction(actionName, title) {
        this.$emit('action', `选择了：${title} - ${actionName}`);
    },
    relayAction(payload) {
        // ★ 拦截特殊信号：_A2UI_RESET_ALL_
        if (payload === '_A2UI_RESET_ALL_') {
            if (this.sharedFormData) {
                // 我还是子组件，继续像接力棒一样往上传
                this.$emit('action', '_A2UI_RESET_ALL_');
            } else {
                // 我是根组件！终于传到我这了，执行清空
                this.resetForm();
            }
            return; // ★ 拦截结束，不触发 sendMessage
        }

        // 普通消息：直接透传给上一层，最终触发 handleA2UIAction
        this.$emit('action', payload);
    }
  }
};

// ==========================================
// 2. 创建 Vue 应用
// ==========================================
const app = Vue.createApp({
  render: window.openxnetCompiledRender,
  data() {
    return vue_data
  },
  // 在组件销毁时清除定时器
  beforeDestroy() {
    this.stopDesktopControlFollowPolling();
    this.stopEdgeScroll();
    this.stopVRMStatusPolling();
    this.stopTTSWebSocket();
    if (this.behaviorTimeTimer)   clearInterval(this.behaviorTimeTimer)
    if (this.behaviorNoInputTimer) clearInterval(this.behaviorNoInputTimer)
    clearInterval(this.behaviorCycleTimer);
    this.cycleTimers.forEach(timer => {
      if (timer) clearInterval(timer);
    });
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('resize', this.checkMobile);
    if (this._disposeHomeCommandShortcutListener) {
      this._disposeHomeCommandShortcutListener();
      this._disposeHomeCommandShortcutListener = null;
    }
    if (this._pendingRecallLaunchStorageListener) {
      window.removeEventListener('storage', this._pendingRecallLaunchStorageListener);
      this._pendingRecallLaunchStorageListener = null;
    }
    if (this._pendingRecallLaunchChannel) {
      this._pendingRecallLaunchChannel.close();
      this._pendingRecallLaunchChannel = null;
    }
    if (this._pendingHomeCurrentFlowLaunchStorageListener) {
      window.removeEventListener('storage', this._pendingHomeCurrentFlowLaunchStorageListener);
      this._pendingHomeCurrentFlowLaunchStorageListener = null;
    }
    if (this._pendingHomeCurrentFlowLaunchChannel) {
      this._pendingHomeCurrentFlowLaunchChannel.close();
      this._pendingHomeCurrentFlowLaunchChannel = null;
    }
    if (this._pendingTaskDetailLaunchStorageListener) {
      window.removeEventListener('storage', this._pendingTaskDetailLaunchStorageListener);
      this._pendingTaskDetailLaunchStorageListener = null;
    }
    if (this._pendingTaskDetailLaunchChannel) {
      this._pendingTaskDetailLaunchChannel.close();
      this._pendingTaskDetailLaunchChannel = null;
    }
    if (this.smsState?.timerId) {
      clearInterval(this.smsState.timerId);
      this.smsState.timerId = null;
    }
    if (this.purchaseState?.pollTimer) {
      clearInterval(this.purchaseState.pollTimer);
      this.purchaseState.pollTimer = null;
    }
    this.shouldReconnectWs = false; // 设置标志位
    this.stopDanmuProcessor(); // 停止弹幕处理器
    this.stopApprovalCenterStatusRefresh();
    this.disconnectWebSocket();
  },
  async mounted() {
    await window.openxnetStartup?.whenWorkspaceReady?.();
    window.openxnetStartup?.mark('deferred-mounted-start');
    console.log('[Startup] Deferred mounted hook started.');
    this.syncAccessDialogScrollLock();
    try {
      if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer.on('trigger-search', (text) => {
              // 1. 将选中的文本填入地址栏变量
              this.urlInput = text;
              
              // 2. 直接调用你现有的回车处理逻辑
              // 这样就会完全复用你的正则判断、Google/Bing/Party 引擎选择逻辑
              this.handleUrlEnter();
          });
      }
    } catch (e) {
      console.error('初始化 Renderer IPC 监听失败:', e);
    }

    window.handleToolApproval = (toolCallId, action) => {
        console.log('Global approval triggered:', toolCallId, action); // 调试日志
        this.processToolApproval(toolCallId, action);
    };
    // ★ 监听主进程发来的“开新标签”指令
    if (window.electronAPI && window.electronAPI.onNewTab) {
        window.electronAPI.onNewTab((url) => {
            console.log('收到新标签页请求:', url);
            this.openUrlInNewTab(url);
        });
    }
    const loadGlobalShortcutStatus = async () => {
      if (!window.electronAPI?.getGlobalShortcutStatus) return;
      try {
        const shortcutStatus = await window.electronAPI.getGlobalShortcutStatus();
        if (shortcutStatus && typeof shortcutStatus === 'object') {
          this.globalShortcutStatus = shortcutStatus;
        }
      } catch (error) {
        console.error('Load global shortcut status failed:', error);
      }
    };
    loadGlobalShortcutStatus();
    setTimeout(() => {
      loadGlobalShortcutStatus();
    }, 1200);
    if (window.electronAPI?.onOpenHomeCommandPanel) {
      this._disposeHomeCommandShortcutListener = window.electronAPI.onOpenHomeCommandPanel(() => {
        this.openHomeCommandPanel();
      });
    }
    await this.initializeMockAccessState();
    console.log('[Startup] Desktop access state initialized.');
    if (!isElectron) {
      this.loadAccessPlans({ silent: true }).catch((error) => {
        console.error('Load access plans failed:', error);
      });
      this.syncAccessSession({ silent: true }).catch((error) => {
        console.error('Sync access session failed:', error);
      });
    }
    this._pendingRecallLaunchStorageListener = (event) => {
      if (event.key !== 'openxnet-recall-center-launch' || !event.newValue) {
        return;
      }
      this.consumePendingRecallCenterLaunch().catch((error) => {
        console.error('Consume recall center launch failed:', error);
      });
    };
    window.addEventListener('storage', this._pendingRecallLaunchStorageListener);
    if (typeof BroadcastChannel === 'function') {
      this._pendingRecallLaunchChannel = new BroadcastChannel('openxnet-recall-center-launch');
      this._pendingRecallLaunchChannel.onmessage = (event) => {
        const request = event && event.data && typeof event.data === 'object'
          ? event.data
          : null;
        if (!request || !request.id || request.type === 'ack') {
          return;
        }
        this.consumePendingRecallCenterLaunch(request).then((consumed) => {
          if (consumed && this._pendingRecallLaunchChannel) {
            this._pendingRecallLaunchChannel.postMessage({ type: 'ack', id: request.id });
          }
        }).catch((error) => {
          console.error('Consume recall center launch via channel failed:', error);
        });
      };
    }
    this.consumePendingRecallCenterLaunch().catch((error) => {
      console.error('Initial recall center launch consume failed:', error);
    });
    this._pendingHomeCurrentFlowLaunchStorageListener = (event) => {
      if (event.key !== 'openxnet-home-current-flow-launch' || !event.newValue) {
        return;
      }
      this.consumePendingHomeCurrentFlowLaunch().catch((error) => {
        console.error('Consume home current flow launch failed:', error);
      });
    };
    window.addEventListener('storage', this._pendingHomeCurrentFlowLaunchStorageListener);
    if (typeof BroadcastChannel === 'function') {
      this._pendingHomeCurrentFlowLaunchChannel = new BroadcastChannel('openxnet-home-current-flow-launch');
      this._pendingHomeCurrentFlowLaunchChannel.onmessage = (event) => {
        const request = event && event.data && typeof event.data === 'object'
          ? event.data
          : null;
        if (!request || !request.id || request.type === 'ack') {
          return;
        }
        this.consumePendingHomeCurrentFlowLaunch(request).then((consumed) => {
          if (consumed && this._pendingHomeCurrentFlowLaunchChannel) {
            this._pendingHomeCurrentFlowLaunchChannel.postMessage({ type: 'ack', id: request.id });
          }
        }).catch((error) => {
          console.error('Consume home current flow launch via channel failed:', error);
        });
      };
    }
    this.consumePendingHomeCurrentFlowLaunch().catch((error) => {
      console.error('Initial home current flow launch consume failed:', error);
    });
    this._pendingTaskDetailLaunchStorageListener = (event) => {
      if (event.key !== 'openxnet-task-detail-launch' || !event.newValue) {
        return;
      }
      this.consumePendingTaskDetailLaunch().catch((error) => {
        console.error('Consume task detail launch failed:', error);
      });
    };
    window.addEventListener('storage', this._pendingTaskDetailLaunchStorageListener);
    if (typeof BroadcastChannel === 'function') {
      this._pendingTaskDetailLaunchChannel = new BroadcastChannel('openxnet-task-detail-launch');
      this._pendingTaskDetailLaunchChannel.onmessage = (event) => {
        const request = event && event.data && typeof event.data === 'object'
          ? event.data
          : null;
        if (!request || !request.id || request.type === 'ack') {
          return;
        }
        this.consumePendingTaskDetailLaunch(request).then((consumed) => {
          if (consumed && this._pendingTaskDetailLaunchChannel) {
            this._pendingTaskDetailLaunchChannel.postMessage({ type: 'ack', id: request.id });
          }
        }).catch((error) => {
          console.error('Consume task detail launch via channel failed:', error);
        });
      };
    }
    this.consumePendingTaskDetailLaunch().catch((error) => {
      console.error('Initial task detail launch consume failed:', error);
    });
    // 监听下载事件
    if (window.downloadAPI) {
        window.downloadAPI.onDownloadStarted((data) => {
            // 新增下载项放到最前面
            this.downloads.unshift({
                ...data,
                state: 'progressing',
                receivedBytes: 0,
                progress: 0
            });
            // 自动打开下拉框提示用户 (可选)
            // this.showDownloadDropdown = true; 
        });

        window.downloadAPI.onDownloadUpdated((data) => {
            const item = this.downloads.find(d => d.id === data.id);
            if (item) {
                Object.assign(item, data); // 更新状态和进度
            }
        });

        window.downloadAPI.onDownloadDone((data) => {
            const item = this.downloads.find(d => d.id === data.id);
            if (item) {
                item.state = data.state;

                if (data.path) {
                    item.path = data.path; 
                }
                if (data.state === 'completed') {
                    item.progress = 1;
                    item.receivedBytes = item.totalBytes;
                }
            }
        });
    }
    this.checkMobile();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('resize', this.checkMobile);
    if (isElectron) {
      this.isMac = window.electron.isMac;
      this.isWindows = window.electron.isWindows;
    }
    await this.initializeLegacyRendererState();
    window.openxnetStartup?.mark('legacy-renderer-state-ready');
    window.aiBrowser = this;
    this.scheduleGlobalIdleInitialization().catch(() => null);
    this.scheduleMenuOwnedInitialization(this.activeMenu).catch(() => null);
    window.openxnetStartup?.mark('deferred-mounted-critical-ready');
    console.log('[Startup] Deferred mounted critical state completed.');
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.highlightCode();
    this.initDownloadButtons();
    if (isElectron) {
      if (window.electronAPI?.getAppVersion) {
        window.electronAPI.getAppVersion().then((version) => {
          if (version) this.updateCurrentVersion = String(version);
        }).catch(() => {});
      }
      // 监听更新事件
      if (window.electronAPI.onCheckingForUpdate) {
        window.electronAPI.onCheckingForUpdate(() => {
          this.updateChecking = true;
          this.updateStatus = 'checking';
          this.updateMessage = this.isCurrentLanguageZh() ? '正在检查更新...' : 'Checking for updates...';
        });
      }
      window.electronAPI.onUpdateAvailable((info) => {
        this.updateAvailable = true;
        this.updateInfo = info;
        this.updateDownloaded = false;
        this.updateChecking = false;
        this.updateStatus = 'available';
        this.updateMessage = this.isCurrentLanguageZh()
          ? `发现新版本 ${info?.version || ''}`
          : `New version ${info?.version || ''} is available`;
        this.updateIcon = 'fa-solid fa-cloud-arrow-down';
        showNotification(this.isCurrentLanguageZh() ? '发现可用更新。' : 'Update available.', 'info');
      });
      window.electronAPI.onUpdateNotAvailable(() => {
        this.updateAvailable = false;
        this.updateInfo = null;
        this.updateDownloaded = false;
        this.updateChecking = false;
        this.updateStatus = 'current';
        this.updateMessage = this.isCurrentLanguageZh() ? '当前已是最新版本。' : 'You are up to date.';
        this.updateIcon = 'fa-solid fa-circle-check';
      });
      window.electronAPI.onUpdateError((err) => {
        const message = typeof err === 'string' ? err : (err?.message || 'Update failed');
        const details = (typeof err === 'object' && err?.details) ? err.details : '';
        this.updateChecking = false;
        this.updateStatus = 'error';
        this.updateError = details ? `${message}\n[${details}]` : message;
        this.updateMessage = this.updateError;
        this.updateIcon = 'fa-solid fa-triangle-exclamation';
        showNotification(message, 'error');
      });
      window.electronAPI.onDownloadProgress((progress) => {
        this.downloadProgress = Number(progress.percent || 0);
        this.updateStatus = 'downloading';
        this.updateMessage = this.isCurrentLanguageZh()
          ? `正在下载更新 ${this.downloadProgress}%`
          : `Downloading update ${this.downloadProgress}%`;
        this.updateIcon = 'fa-solid fa-spinner fa-spin';
      });
      window.electronAPI.onUpdateDownloaded((info) => {
        this.updateDownloaded = true;
        this.updateAvailable = true;
        this.updateInfo = info || this.updateInfo;
        this.updateStatus = 'downloaded';
        this.updateMessage = this.isCurrentLanguageZh() ? '更新已下载，重启后完成安装。' : 'Update downloaded. Restart to install.';
        this.updateIcon = 'fa-solid fa-rocket';
      });
    }
    this.$nextTick(() => {
      this.initPreviewButtons();
    });
    this.$nextTick(() => {               // 保证 DOM 已渲染
      document.addEventListener('click', this._toggleHighlight, false);
    });
    document.documentElement.setAttribute('data-theme', resolveOpenXnetDomTheme(this.systemSettings.theme));
    document.documentElement.setAttribute('data-theme-choice', this.systemSettings.theme || 'party');
    persistThemePreference(this.systemSettings.theme);
    if (isElectron) {
      window.stopQQBotHandler = this.requestStopQQBotIfRunning;
      window.stopFeishuBotHandler = this.requestFeishuBotStopIfRunning;
      window.stopDingtalkBotHandler = this.requestDingtalkBotStopIfRunning;
      window.stopDiscordBotHandler = this.requestDiscordBotStopIfRunning;
      window.stopTelegramBotHandler = this.requestTelegramBotStopIfRunning;
      window.stopSlackBotHandler = this.requestSlackBotStopIfRunning;
      if (window.electronAPI?.getWindowState) {
        window.electronAPI.getWindowState().then((payload) => {
          this.syncWindowStateFromPayload(payload);
        }).catch(() => {});
      }
      window.electronAPI.onWindowState((payload) => {
        this.syncWindowStateFromPayload(payload);
      });
    }
    // 1. 时间触发器（每秒扫一次）
    this.behaviorTimeTimer = setInterval(() => {
      if (!this.behaviorSettings.enabled) return
      const now = new Date()
      const hm = now.toLocaleTimeString('zh-CN', { hour12: false }) // HH:mm:ss
      const d  = now.getDay() // 0=周日
      this.behaviorSettings.behaviorList.forEach(b => {
        if (!b.enabled || b.trigger.type !== 'time' || b.platform !== "chat") return
        const tv = b.trigger.time.timeValue
        const ds = b.trigger.time.days
        if (tv === hm) {
          if (ds.length === 0 || ds.includes(d)) {
            this.runBehavior(b)
            this.disableOnceBehavior(b)
          }
        }
      })
    }, 1000)

    // 2. 无-input 触发器（每 1s 检查一次）
    this.noInputSec = 0 // 连续无输入秒数
    this.behaviorNoInputTimer = setInterval(() => {
      if (!this.behaviorSettings.enabled) return
      this.behaviorSettings.behaviorList.forEach(b => {
        if (!b.enabled || b.trigger.type !== 'noInput'|| b.platform !== "chat" ) return
        const need = b.trigger.noInput.latency
        if (this.noInputFlag) {
          this.noInputSec++
          if (this.noInputSec >= need) {
            this.runBehavior(b)
            this.noInputSec = 0 // 触发后重置
          }
        } else {
          this.noInputSec = 0
        }
      })
    }, 1000)

   // 在 mounted() 函数中添加以下代码
  this.cycleTimers = []; // 存储所有周期触发器的定时器

  // 3. 周期触发器（每1秒检查一次）
  this.behaviorCycleTimer = setInterval(() => {
    if (!this.behaviorSettings.enabled) return;
    
    const now = new Date();
    this.behaviorSettings.behaviorList.forEach((b, index) => {
      if (!b.enabled || b.trigger.type !== 'cycle' || b.platform !== "chat") return;
      // 检查是否已有定时器
      if (!this.cycleTimers[index]) {
        this.initCycleTimer(b, index);
      }
    });
  }, 1000); 
    document.addEventListener('click', (e) => {
        const selector = document.querySelector('.engine-selector');
        if (selector && !selector.contains(e.target)) {
            this.showEngineDropdown = false;
        }
    });
    if (this.activeMenu === 'deploy-bot' && typeof this.ensureDeployBotReady === 'function') {
      this.ensureDeployBotReady('table_pet');
    }

const handleRemoteInstall = (data) => {
  // 1. 根据 type 自动切换菜单和子菜单
  if (data.type === 'mcp') {
      this.handleRemoteMCPInstall(data);
      return;
  }
  const { repo, type } = data;
  if (!repo) return;
  if (type === 'skill') {
    this.activeMenu = 'toolkit';
    this.subMenu = 'skills';
    this.activeSkillCenterTab = 'transform';
    this.newSkillUrl = repo;
  } else {
    this.activeMenu = 'api-group';
    this.subMenu = 'extension';
    this.newExtensionUrl = repo;
  }

  // 2. 确认弹窗
  const confirmMsg = type === 'skill' 
    ? `${this.t('confirmInstallSkillFrom')}：\n${repo}`
    : `${this.t('confirmInstallExtensionFrom')}：\n${repo}`;

  this.$confirm(
    confirmMsg, 
    this.t('confirmInstall'), 
    { 
      confirmButtonText: this.t('confirm'), 
      cancelButtonText: this.t('cancel'),
      type: 'info' 
    }
  ).then(() => {
    // 3. 执行对应的安装方法
    if (type === 'skill') {
      this.installSkillFromGithub();
    } else {
      this.addExtension(); // 执行安装 Extension 的方法
    }
  }).catch(() => {
    console.log('用户取消了安装');
  });
};

  // --- 挂载监听 ---
  if (window.electronAPI) {
    // 软件运行中触发
    window.electronAPI.onRemoteInstall((payload) => {
      // 这里的 payload 包含 { repo, type }
      handleRemoteInstall(payload);
    });

    // 软件启动时检查
    setTimeout(async () => {
      const pendingData = await window.electronAPI.checkPendingInstall();
      if (pendingData) {
        handleRemoteInstall(pendingData);
      }
    }, 1000);
  }

  if (this.activeMenu === 'api-group' && this.subMenu === 'develop') {
    this.loadDevWorkbench();
  }


  },
  beforeUnmount() {
    this.desktopCoreUnsubscribe?.();
    this.desktopCoreUnsubscribe = null;
    this.taskExecutionUnsubscribe?.();
    this.taskExecutionUnsubscribe = null;
    this.syncAccessDialogScrollLock(true);
    this.stopDesktopControlFollowPolling();
    this.stopEdgeScroll();
    this.stopSkillsPolling();
    this.stopExtensionsPolling();
    this.stopApprovalCenterStatusRefresh();
    this.stopVRMStatusPolling();
    this.closeEnterpriseChat?.();
    this.stopTTSWebSocket();
    clearInterval(this.nodeTimer);
    clearInterval(this.uvTimer); 
    if (isElectron) {
      delete window.stopQQBotHandler;
      delete window.stopFeishuBotHandler;
      delete window.stopDingtalkBotHandler;
      delete window.stopDiscordBotHandler;
      delete window.stopTelegramBotHandler;
      delete window.stopSlackBotHandler;
    }
    if (this._disposeHomeCommandShortcutListener) {
      this._disposeHomeCommandShortcutListener();
      this._disposeHomeCommandShortcutListener = null;
    }
    if (this._pendingRecallLaunchStorageListener) {
      window.removeEventListener('storage', this._pendingRecallLaunchStorageListener);
      this._pendingRecallLaunchStorageListener = null;
    }
    if (this._pendingRecallLaunchChannel) {
      this._pendingRecallLaunchChannel.close();
      this._pendingRecallLaunchChannel = null;
    }
    if (this._pendingHomeCurrentFlowLaunchStorageListener) {
      window.removeEventListener('storage', this._pendingHomeCurrentFlowLaunchStorageListener);
      this._pendingHomeCurrentFlowLaunchStorageListener = null;
    }
    if (this._pendingHomeCurrentFlowLaunchChannel) {
      this._pendingHomeCurrentFlowLaunchChannel.close();
      this._pendingHomeCurrentFlowLaunchChannel = null;
    }
    if (this._pendingTaskDetailLaunchStorageListener) {
      window.removeEventListener('storage', this._pendingTaskDetailLaunchStorageListener);
      this._pendingTaskDetailLaunchStorageListener = null;
    }
    if (this._pendingTaskDetailLaunchChannel) {
      this._pendingTaskDetailLaunchChannel.close();
      this._pendingTaskDetailLaunchChannel = null;
    }
    document.removeEventListener('click', this._toggleHighlight, false);
    window.removeEventListener('resize', this.handleResize);
  },
  watch: {
    showLoginDialog: {
      handler() {
        this.$nextTick(() => {
          this.syncAccessDialogScrollLock();
        });
      },
      immediate: true,
    },
    showAccessLegalDialog: {
      handler() {
        this.$nextTick(() => {
          this.syncAccessDialogScrollLock();
        });
      },
      immediate: true,
    },
    showPersonalCenterDialog: {
      handler() {
        this.$nextTick(() => {
          this.syncAccessDialogScrollLock();
        });
      },
      immediate: true,
    },
    showUnlockDialog: {
      handler() {
        this.$nextTick(() => {
          this.syncAccessDialogScrollLock();
        });
      },
      immediate: true,
    },
    showFakeQrDialog: {
      handler() {
        this.$nextTick(() => {
          this.syncAccessDialogScrollLock();
        });
      },
      immediate: true,
    },
    sidePanelOpen(val) {
        if (this.activeMenu === 'task-center') {
            return;
        }
        if (!val && this.taskRefreshTimer) {
            clearInterval(this.taskRefreshTimer);
            this.taskRefreshTimer = null;
        } else if (val && this.activeSideView === 'tasks') {
            if (this.taskRefreshTimer) {
                clearInterval(this.taskRefreshTimer);
            }
            this.fetchTasks();
            this.taskRefreshTimer = setInterval(() => this.fetchTasks(), 3000);
        }
    },
    'tempBehavior.trigger.cycle.cycleValue'(newVal) {
      if (newVal === '00:00:00') {
        this.tempBehavior.trigger.cycle.cycleValue = '00:00:01';
      }
    },
    /** Load the selected Vite surface after Vue applies its visibility update. */
    activeMenu(newVal) {
      this.$nextTick(() => {
        this.scheduleMenuOwnedInitialization(newVal).catch(() => null);
        window.openxnetRuntime?.ensureSurfaceRuntime?.(newVal).catch((error) => {
          console.error(`Load '${newVal}' surface failed:`, error);
        });
      });
      this.handleExtensionsPolling(newVal, this.subMenu);
      this.handleSkillsPolling(newVal, this.subMenu, this.activeCLITab);
      if (newVal !== 'task-center' && this.taskRefreshTimer) {
        clearInterval(this.taskRefreshTimer);
        this.taskRefreshTimer = null;
      }
      if (newVal === 'api-group' && typeof this.refreshDevPrototypePanel === 'function') {
        this.refreshDevPrototypePanel(this.subMenu);
      }
      if (newVal === 'ai-browser' && typeof this.ensureBrowserState === 'function') {
        this.ensureBrowserState();
      }
      if (newVal === 'deploy-bot' && typeof this.ensureDeployBotReady === 'function') {
        this.ensureDeployBotReady('table_pet');
      }
      this.syncDesktopControlFollowPolling();
    },
    // 监听子菜单
    subMenu(newVal) {
      this.handleExtensionsPolling(this.activeMenu, newVal);
      this.handleSkillsPolling(this.activeMenu, newVal, this.activeCLITab);
      if (this.activeMenu === 'api-group' && typeof this.refreshDevPrototypePanel === 'function') {
        this.refreshDevPrototypePanel(newVal);
      }
      if (this.activeMenu === 'deploy-bot' && typeof this.ensureDeployBotReady === 'function') {
        this.ensureDeployBotReady('table_pet');
      }
      this.syncDesktopControlFollowPolling();
    },
    desktopControlFollowActiveWindow(newVal) {
      this.syncDesktopControlFollowPolling();
      if (newVal) {
        this.loadDesktopControlActiveWindow({ silent: true, syncSelection: true });
      }
    },
    // 监听 CLI 内部的 Tab
    activeCLITab(newVal) {
      this.handleSkillsPolling(this.activeMenu, this.subMenu, newVal);
    },
    /** Refresh project skill state only while a skill-management surface owns it. */
    'CLISettings.cc_path': function(newPath) {
      const normalizedPath = String(newPath || '').trim();
      const skillsSurfaceActive = this.activeMenu === 'skills'
        || (
          this.activeMenu === 'toolkit'
          && (
            this.subMenu === 'skills'
            || (this.subMenu === 'CLI' && this.activeCLITab === 'skills')
          )
        );
      if (normalizedPath && skillsSurfaceActive) {
        this.fetchProjectSkillsStatus();
      }
    },
    'searchEngine': function(newVal) {
      if (newVal === 'party') {
        this.searchEngineplaceholder = this.t('searchWithParty')
      }else if (newVal === 'bing') {
        this.searchEngineplaceholder = this.t('searchWithBing')
      }else if (newVal === 'google') {
        this.searchEngineplaceholder = this.t('searchWithGoogle')
      }
    },
    currentTheme: {
      handler(newVal) {
        // 等待 DOM 更新，确保 CSS 变量已变更
        this.$nextTick(() => {
          // 遍历所有标签页，更新样式
          this.browserTabs.forEach(tab => {
            this.updateWebviewTheme(tab.id);
          });
        });
      },
      immediate: false // 初始化时不需要立即执行，因为 dom-ready 会处理
    },
    'ttsSettings.engine': function(newVal) {
      if (newVal === 'systemtts') {
        // 如果列表为空，则去获取
        if (this.systemVoices.length === 0) {
          this.fetchSystemVoices();
        }
      }
    },
    'readConfig.longText': {
      immediate: true,
      async handler(val) {          // ← 加 async
        await this.$nextTick();     // ← 保证组件完成上一轮渲染
        if (!val?.trim()) {
          this.clearSegments();
          return;
        }
        this.reSegment();
      }
    },
    selectedCodeLang() {
      this.highlightCode();
    },
    modelProviders: {
      deep: true,
      handler(newProviders) {
        const existingIds = new Set(newProviders.map(p => p.id));
        let configurationChanged = false;
        // 自动清理无效的 selectedProvider
        [this.settings, this.reasonerSettings,this.visionSettings,
          this.KBSettings,this.text2imgSettings,this.ccSettings,
          this.qcSettings,this.ocSettings,this.fastSettings
        ].forEach(config => {
          if (config.selectedProvider && !existingIds.has(config.selectedProvider)) {
            config.selectedProvider = null;
            // 可选项：同时重置相关字段
            config.model = '';
            config.base_url = '';
            config.api_key = '';
            if (Object.prototype.hasOwnProperty.call(config, 'api_key_configured')) {
              config.api_key_configured = false;
            }
            configurationChanged = true;
          }
          if (!config.selectedProvider && newProviders.length > 0) {
            config.selectedProvider = newProviders[0].id;
            configurationChanged = true;
          }
        });
        [this.settings, this.reasonerSettings,this.visionSettings,
          this.KBSettings,this.text2imgSettings,this.ccSettings,
          this.qcSettings,this.ocSettings,this.fastSettings
        ].forEach(config => {
          if (config.selectedProvider) {
            configurationChanged = this.syncProviderConfig(config) || configurationChanged;
          }
        });
        if (configurationChanged) this.autoSaveSettings().catch(() => null);
      }
    },
    'systemSettings.theme': {
      handler(newVal) {
        document.documentElement.setAttribute('data-theme', resolveOpenXnetDomTheme(newVal));
        document.documentElement.setAttribute('data-theme-choice', newVal || 'party');
        persistThemePreference(newVal);
        
        // Update Mermaid only after the optional diagram runtime has loaded.
        if (window.mermaid) {
          window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme : ['dark','midnight','neon'].includes(newVal) ? 'dark' : 'default'
          });
        }

        // 完整的主题色映射
        const themeColors = {
          light: '#21859c',      // 默认
          dark: '#ee7e00',       // 橙色
          midnight: '#21859c',   // 午夜蓝
          desert: '#d98236',     // 沙漠黄
          neon: '#ff2d95' ,       // 霓虹粉
          marshmallow: '#f5a5c3',  // Marshmallow 粉色
          ink: '#2c3e50',        // 墨水蓝
          party: '#5BA3C5',        // 默认主题
          rainbow: '#845ec2',        // 彩虹
        };

        // 获取当前主题色
        const themeColor = themeColors[newVal] || themeColors.light;
        const root = document.documentElement;

        // 设置主色及其衍生色（Element Plus 需要完整的色系）
        root.style.setProperty('--el-color-primary', themeColor);
        root.style.setProperty('--el-color-primary-light-9', this.colorBlend(themeColor, '#ffffff', 0.1));
        root.style.setProperty('--el-color-primary-light-8', this.colorBlend(themeColor, '#ffffff', 0.2));
        root.style.setProperty('--el-color-primary-light-7', this.colorBlend(themeColor, '#ffffff', 0.3));
        root.style.setProperty('--el-color-primary-light-6', this.colorBlend(themeColor, '#ffffff', 0.4));
        root.style.setProperty('--el-color-primary-light-5', this.colorBlend(themeColor, '#ffffff', 0.5));
        root.style.setProperty('--el-color-primary-light-4', this.colorBlend(themeColor, '#ffffff', 0.6));
        root.style.setProperty('--el-color-primary-light-3', this.colorBlend(themeColor, '#ffffff', 0.7));
        root.style.setProperty('--el-color-primary-light-2', this.colorBlend(themeColor, '#ffffff', 0.8));
        root.style.setProperty('--el-color-primary-light-1', this.colorBlend(themeColor, '#ffffff', 0.9));
        root.style.setProperty('--el-color-primary-dark-1', this.colorBlend(themeColor, '#000000', 0.3));
        root.style.setProperty('--el-color-primary-dark-2', this.colorBlend(themeColor, '#000000', 0.2));
        root.style.setProperty('--el-color-primary-dark-3', this.colorBlend(themeColor, '#000000', 0.1));

        // 强制刷新 Element Plus 主题
        if (window.__ELEMENT_PLUS_INSTANCE__) {
          window.__ELEMENT_PLUS_INSTANCE__.config.globalProperties.$ELEMENT.reload();
        }
      },
      immediate: true
    },
    'systemSettings.language': {
      handler(newVal) {
        if (this.isElectron) {
          window.electronAPI.sendLanguage(newVal);
        }
      },
      immediate: true
    },
  },
  computed: {
    computedSkillsList() {
      const decorateSkill = (skill = {}, flags = {}) => {
        const merged = {
          ...skill,
          isGlobal: Boolean(flags.isGlobal ?? skill?.isGlobal),
          isProject: Boolean(flags.isProject ?? skill?.isProject),
        };
        if (typeof this.getSkillPresentation === 'function') {
          return {
            ...merged,
            ...this.getSkillPresentation(merged),
          };
        }
        return merged;
      };
      const skillMap = new Map();
      
      // 1. 灌入全局技能
      this.skillsList.forEach(skill => {
        skillMap.set(skill.id, decorateSkill(skill, {
          isGlobal: true,
          isProject: false
        }));
      });

      // 2. 灌入项目技能 (补充全局没有的，或者标记项目存在的)
      this.projectSkillsDetails.forEach(skill => {
        if (skillMap.has(skill.id)) {
          const existing = skillMap.get(skill.id) || {};
          skillMap.set(skill.id, decorateSkill({
            ...existing,
            ...skill,
          }, {
            isGlobal: existing.isGlobal,
            isProject: true
          }));
        } else {
          skillMap.set(skill.id, decorateSkill(skill, {
            isGlobal: false,
            isProject: true
          }));
        }
      });

      return Array.from(skillMap.values()).map((skill) => decorateSkill(skill));
    },
    activeSkillPreviewMeta() {
      if (!this.activeSkillPreviewId) {
        return null;
      }
      if (typeof this.getSkillPresentation !== 'function') {
        return null;
      }
      return this.getSkillPresentation(this.activeSkillPreviewId);
    },
    hasWorkspacePath() {
        return this.CLISettings && 
               this.CLISettings.cc_path && 
               this.CLISettings.cc_path.trim() !== '';
    },
    dynamicUserAgent() {
      // 1. 定义一个较新的 Chrome 版本号 (定期更新这个版本号可以保持最佳兼容性)
      // 目前 Chrome 124+ 是比较通用的
      const chromeVersion = '124.0.0.0'; 
      
      // 2. 基础模板
      const baseUA = `Mozilla/5.0 ({os_info}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
      
      // 3. 获取当前平台
      // 在 Electron Renderer 中，通常可以通过 global.process 或 navigator 判断
      let platform = '';
      
      // 尝试使用 node 的 process.platform (最准确)
      if (typeof window.process !== 'undefined' && window.process.platform) {
        platform = window.process.platform;
      } else {
        // 降级方案：分析 navigator.userAgent
        const navUA = navigator.userAgent.toLowerCase();
        if (navUA.indexOf('mac') > -1) platform = 'darwin';
        else if (navUA.indexOf('win') > -1) platform = 'win32';
        else platform = 'linux';
      }

      // 4. 根据平台设置对应的 OS 信息
      let osInfo = '';
      switch (platform) {
        case 'darwin': // macOS
          // 模拟 macOS Intel/M1 通用标识
          osInfo = 'Macintosh; Intel Mac OS X 10_15_7';
          break;
        case 'win32': // Windows
          // 模拟 Windows 10/11 64位
          osInfo = 'Windows NT 10.0; Win64; x64';
          break;
        case 'linux': // Linux
          // 模拟标准 Linux x64
          osInfo = 'X11; Linux x86_64';
          break;
        default:
          // 默认回退到 Windows
          osInfo = 'Windows NT 10.0; Win64; x64';
      }

      // 5. 返回替换后的完整字符串
      return baseUA.replace('{os_info}', osInfo);
    },

    isCurrentTabFavorite() {
        // 如果没有当前标签或当前标签没有URL（比如是新标签页），返回 false
        if (!this.currentTab || !this.currentTab.url) return false;
        // 检查当前 URL 是否存在于收藏列表中
        return this.favorites.some(f => f.url === this.currentTab.url);
    },

    sidePanelText() {
      if (this.messages.length === 0) {
        return '';
      }
      
      // 过滤出所有助手消息并按时间倒序排列
      const assistantMessages = this.messages
        .filter(msg => msg.role === 'assistant')
        .reverse();
      
      // 找到第一个非空消息
      for (const msg of assistantMessages) {
        const pureContent = String(msg?.pure_content || '').trim();
        if (!pureContent) {
          continue;
        }
        if (pureContent.toLowerCase() === 'response error') {
          continue;
        }
        if (pureContent) {
          return pureContent;
        }
      }
      
      // 如果没有找到符合条件的消息
      return '';
    },
    homeCommandShortcutLabel() {
      return this.isMac ? 'Cmd+K' : 'Ctrl+K';
    },
    homeCommandGlobalShortcutLabel() {
      return formatAcceleratorLabel(
        this.globalShortcutStatus?.homeCommand?.accelerator || 'CommandOrControl+Alt+K',
        this.isMac
      ) || (this.isMac ? 'Cmd+Alt+K' : 'Ctrl+Alt+K');
    },
    dynamicIslandGlobalShortcutLabel() {
      return formatAcceleratorLabel(
        this.globalShortcutStatus?.dynamicIsland?.accelerator || 'CommandOrControl+Alt+D',
        this.isMac
      ) || (this.isMac ? 'Cmd+Alt+D' : 'Ctrl+Alt+D');
    },
    floatingTaskHudGlobalShortcutLabel() {
      return formatAcceleratorLabel(
        this.globalShortcutStatus?.floatingTaskHud?.accelerator || 'CommandOrControl+Alt+H',
        this.isMac
      ) || (this.isMac ? 'Cmd+Alt+H' : 'Ctrl+Alt+H');
    },
    homeCommandGlobalShortcutReady() {
      return Boolean(this.globalShortcutStatus?.homeCommand?.registered);
    },
    homeCommandGlobalShortcutStatusLabel() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      return this.homeCommandGlobalShortcutReady
        ? (isZh ? '全局热键已注册' : 'Global hotkey ready')
        : (isZh ? '全局热键未注册' : 'Global hotkey unavailable');
    },
    homeCommandShortcutSummary() {
      return `${this.homeCommandShortcutLabel} / ${this.homeCommandGlobalShortcutLabel}`;
    },
    homeChatCopy() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      if (isZh) {
        return {
          bandKicker: 'OpenXnet Control Deck',
          modelFallback: '未选择模型',
          workspaceFallback: '未设置工作区',
          defaultSummary: '把对话、任务、工作区和模型状态收拢成一个更清晰的操作面，从这里可以继续聊天、排查任务或快速跳到其它核心页面。',
          quickPanel: '快速面板',
          quickPanelHint: '全局入口',
          flightDeckKicker: 'Mission Lanes',
          flightDeckTitle: '一屏判断下一步',
          flightDeckSummary: '把工作区、桌控、悬浮层和记忆入口压缩成一个可直接执行的飞行甲板，避免在首页、侧栏和弹窗之间来回切换。',
          taskCenter: '任务中心',
          developerWorkbench: '开发工作台',
          latestDesktopAction: '最新桌控动作',
          latestDesktopActionEmpty: '桌面窗口动作会在这里形成轻量前台回显。',
          desktopRecall: '桌控召回',
          desktopRecallEmptyTitle: '等待最近桌控动作',
          desktopRecallEmpty: '最近的桌控窗口会显示在这里，可直接重新聚焦或继续调整。',
          desktopRecallEmptyMeta: '打开桌面控制后，最近动作会在这里形成可召回入口。',
          desktopRecallPrimaryAction: '重新聚焦窗口',
          desktopRecallPreviousAction: '送到上一显示器',
          desktopRecallNextAction: '送到下一显示器',
          desktopRecallSnapLeftAction: '左半屏',
          desktopRecallSnapMaximizeAction: '铺满工作区',
          desktopRecallSnapRightAction: '右半屏',
          desktopRecallLayouts: '布局预设',
          desktopRecallSecondaryAction: '打开灵动岛',
          desktopRecallUnavailable: '当前窗口暂不可直接召回，可先打开桌面控制继续处理。',
          desktopRecallCommandPrefix: '召回窗口',
          openDesktopControl: '打开桌面控制',
          desktopScene: '桌面场景地图',
          desktopSceneTitleEmpty: '等待桌面窗口同步',
          desktopSceneSummaryEmpty: '这里会显示可点击的显示器与窗口地图，单击选中、双击聚焦。',
          desktopSceneMetaEmpty: '刷新桌面场景后即可切换目标窗口',
          desktopSceneDisplays: '显示器',
          desktopSceneWindows: '窗口',
          desktopScenePrimaryAction: '聚焦当前目标',
          desktopSceneWorkbench: '完整桌控',
          desktopSceneRefresh: '刷新场景',
          desktopSceneQuickLayouts: '当前目标布局',
          desktopSceneStateForeground: '前台窗口',
          desktopSceneStateMinimized: '已最小化',
          desktopSceneStatePrimaryDisplay: '主显示器',
          currentFlow: {
            kicker: 'Current Flow',
            emptyTitle: '等待 Recall 观察流',
            emptySummary: '在 Recall Center 选中一条搜索结果或时间线后，这里会直接同步当前执行观察，并可继续推送到桌面悬浮层。',
            syncedSummary: '当前执行观察已同步到首页，可直接继续进入 Recall Center、灵动岛或任务 HUD。',
            recallAction: '继续到 Recall Center',
            taskDetailAction: '打开任务详情',
            dynamicIslandAction: '发送到灵动岛',
            taskHudAction: '发送到任务 HUD',
            observationLabel: '观察点',
            idleMeta: '先在 Recall Center 里选中一条流，再回到首页继续联动。',
            syncedMeta: '当前观察流已同步到首页',
            syncBadge: '已同步'
          },
          commandPanelTitle: 'OpenXnet Control Deck',
          commandPanelLead: '按场景整理工作区、桌控、悬浮层和记忆 / 模型入口，既能直接搜索，也能快速判断当前最适合继续推进哪条路径。',
          commandPanelPlaceholder: '搜索功能、页面或操作...',
          commandPanelEmpty: '没有找到匹配的功能入口',
          sections: {
            workspace: {
              kicker: 'Workspace Flow',
              label: '工作区与执行流',
              summary: '聊天输入、新建会话、任务中心与开发工作台入口都集中在这一组。'
            },
            desktop: {
              kicker: 'Desktop Mission Control',
              label: '桌面控制与召回',
              summary: '最近桌控动作、显示器切换、布局召回与完整桌控入口。'
            },
            overlay: {
              kicker: 'Live Surfaces',
              label: '悬浮层与状态面板',
              summary: '灵动岛与任务 HUD 等常驻桌面的状态反馈入口。'
            },
            memory: {
              kicker: 'Continuity',
              label: '记忆与模型',
              summary: 'Recall Center、会话恢复与当前模型切换入口。'
            }
          },
          deckStats: {
            workspace: {
              label: '工作区通道',
              idle: 'CLI 工作区尚未接入',
              ready: 'CLI 工作区与项目上下文已连通'
            },
            tasks: {
              label: '活跃任务',
              idle: '当前没有排队中的任务',
              active: '仍有任务在排队或执行中'
            },
            desktop: {
              label: '桌面态势',
              idle: '等待新的桌控动作或窗口场景同步',
              ready: '最近桌控动作可直接继续处理'
            },
            overlay: {
              label: '常驻浮层',
              idle: '灵动岛与任务 HUD 可随时拉起',
              ready: '桌面浮层热键已部分或全部就绪',
              meta: '灵动岛 · 任务 HUD'
            }
          },
          commands: {
            focusInput: {
              label: '聚焦输入框',
              description: '回到首页聊天输入区，准备继续下达指令。'
            },
            newChat: {
              label: '新建对话',
              description: '清空当前会话并开启新的聊天上下文。'
            },
            taskCenter: {
              label: '打开任务中心',
              description: '查看计划任务、执行状态和最新投递结果。'
            },
            developerWorkbench: {
              label: '打开开发工作台',
              description: '跳转到 Plan / Review / Diff / Patch 工作流入口。'
            },
            desktopControl: {
              label: '打开桌面控制',
              description: '直达开发工作台中的桌面窗口控制面板。'
            },
            desktopMovePrevious: {
              label: '送到上一显示器',
              description: '把最近桌控窗口送到上一显示器，并保持窗口尺寸。'
            },
            desktopMoveNext: {
              label: '送到下一显示器',
              description: '把最近桌控窗口送到下一显示器，并保持窗口尺寸。'
            },
            desktopSnapLeft: {
              label: '左半屏召回',
              description: '将最近桌控窗口贴靠到当前显示器左半屏。'
            },
            desktopSnapMaximize: {
              label: '铺满工作区召回',
              description: '将最近桌控窗口铺满到当前显示器工作区。'
            },
            desktopSnapRight: {
              label: '右半屏召回',
              description: '将最近桌控窗口贴靠到当前显示器右半屏。'
            },
            dynamicIsland: {
              label: '打开灵动岛',
              description: '显示桌面悬浮灵动岛，查看系统级任务反馈。'
            },
            floatingTaskHud: {
              label: '打开任务 HUD',
              description: '显示右侧悬浮任务 HUD，持续跟踪任务投递与桌控反馈。'
            },
            recallCenter: {
              label: '打开 Recall Center',
              description: '查看中断恢复、历史快照和记忆检索时间线。'
            },
            modelSelector: {
              label: '选择当前模型',
              description: '直接打开首页模型选择器，调整当前会话模型。'
            }
          },
          metrics: {
            dialogue: {
              label: '对话轮次',
              idle: '还没有开始新的会话',
              active: '当前上下文已进入活跃状态'
            },
            tasks: {
              label: '运行任务',
              idle: '侧边任务中心可继续跟进',
              active: '仍有任务在等待或执行中'
            },
            capabilities: {
              label: '已启用能力',
              idle: '当前是轻量聊天模式'
            },
            workspace: {
              label: '当前工作区',
              idle: 'CLI 工作区尚未启用',
              ready: 'CLI 工作区与项目上下文已接入'
            }
          }
        };
      }

      return {
        bandKicker: 'OpenXnet Control Deck',
        modelFallback: 'No model selected',
        workspaceFallback: 'Workspace not set',
        defaultSummary: 'Chat, tasks, workspace context, and model state are now gathered into one cleaner surface so we can keep moving from a single control deck.',
        quickPanel: 'Quick Panel',
        quickPanelHint: 'Global launchpad',
        flightDeckKicker: 'Mission Lanes',
        flightDeckTitle: 'Pick The Next Move From One Screen',
        flightDeckSummary: 'Workspace flow, desktop control, overlays, and continuity paths are compressed into one actionable flight deck so we can move without bouncing between the home page, side panels, and popovers.',
        taskCenter: 'Task Center',
        developerWorkbench: 'Developer Workbench',
        latestDesktopAction: 'Latest Desktop Action',
        latestDesktopActionEmpty: 'Recent desktop window actions will surface here for quick follow-up.',
        desktopRecall: 'Desktop Recall',
        desktopRecallEmptyTitle: 'Waiting For A Desktop Action',
        desktopRecallEmpty: 'Recent desktop window actions will appear here so we can refocus or continue from Quick Panel.',
        desktopRecallEmptyMeta: 'Open Desktop Control once and the latest window context will surface here.',
        desktopRecallPrimaryAction: 'Focus Window Again',
        desktopRecallPreviousAction: 'Send To Previous Display',
        desktopRecallNextAction: 'Send To Next Display',
        desktopRecallSnapLeftAction: 'Left Half',
        desktopRecallSnapMaximizeAction: 'Fill Work Area',
        desktopRecallSnapRightAction: 'Right Half',
        desktopRecallLayouts: 'Layout Presets',
        desktopRecallSecondaryAction: 'Open Dynamic Island',
        desktopRecallUnavailable: 'This window cannot be recalled directly right now. Open Desktop Control to continue.',
        desktopRecallCommandPrefix: 'Recall Window',
        openDesktopControl: 'Open Desktop Control',
        desktopScene: 'Desktop Scene Map',
        desktopSceneTitleEmpty: 'Waiting For Desktop Windows',
        desktopSceneSummaryEmpty: 'Clickable displays and windows will appear here. Click to select and double-click to focus.',
        desktopSceneMetaEmpty: 'Refresh the desktop scene to switch target windows here.',
        desktopSceneDisplays: 'Displays',
        desktopSceneWindows: 'Windows',
        desktopScenePrimaryAction: 'Focus Current Target',
        desktopSceneWorkbench: 'Full Desktop Control',
        desktopSceneRefresh: 'Refresh Scene',
        desktopSceneQuickLayouts: 'Current Target Layouts',
        desktopSceneStateForeground: 'Foreground',
        desktopSceneStateMinimized: 'Minimized',
        desktopSceneStatePrimaryDisplay: 'Primary Display',
        currentFlow: {
          kicker: 'Current Flow',
          emptyTitle: 'Waiting For Recall Flow',
          emptySummary: 'Once we select a search result or timeline item in Recall Center, the live execution flow will sync here and stay ready for desktop overlays.',
          syncedSummary: 'The active execution flow is now synced on Home, so we can keep moving from Recall Center, Dynamic Island, or Task HUD without another hop.',
          recallAction: 'Continue In Recall Center',
          taskDetailAction: 'Open Task Detail',
          dynamicIslandAction: 'Send To Dynamic Island',
          taskHudAction: 'Send To Task HUD',
          observationLabel: 'Observations',
          idleMeta: 'Select a Recall flow first, then come back here for cross-surface follow-up.',
          syncedMeta: 'The current flow is synced on Home',
          syncBadge: 'Synced'
        },
        commandPanelTitle: 'OpenXnet Control Deck',
        commandPanelLead: 'Everything is now grouped by scenario so we can search instantly and also see the best next surface for workspace flow, desktop control, overlays, and continuity.',
        commandPanelPlaceholder: 'Search features, pages, or actions...',
        commandPanelEmpty: 'No matching destination was found',
        sections: {
          workspace: {
            kicker: 'Workspace Flow',
            label: 'Workspace Flow',
            summary: 'Chat input, fresh threads, task routing, and workbench entry points live here.'
          },
          desktop: {
            kicker: 'Desktop Mission Control',
            label: 'Desktop Control',
            summary: 'Recent desktop recall, display routing, layout recalls, and the full control surface.'
          },
          overlay: {
            kicker: 'Live Surfaces',
            label: 'Overlay Surfaces',
            summary: 'Floating surfaces that keep system feedback visible on the desktop.'
          },
          memory: {
            kicker: 'Continuity',
            label: 'Memory / Model',
            summary: 'Recall context, recovery lanes, and model switching for the current session.'
          }
        },
        deckStats: {
          workspace: {
            label: 'Workspace Lane',
            idle: 'CLI workspace is not connected yet',
            ready: 'CLI workspace and project context are connected'
          },
          tasks: {
            label: 'Active Tasks',
            idle: 'No queued tasks right now',
            active: 'Tasks are still queued or running'
          },
          desktop: {
            label: 'Desktop State',
            idle: 'Waiting for a fresh desktop action or scene sync',
            ready: 'The latest desktop action can be resumed instantly'
          },
          overlay: {
            label: 'Live Surfaces',
            idle: 'Dynamic Island and Task HUD are ready to launch',
            ready: 'Overlay shortcuts are partially or fully ready',
            meta: 'Dynamic Island · Task HUD'
          }
        },
        commands: {
          focusInput: {
            label: 'Focus Composer',
            description: 'Return to the main chat input and keep typing.'
          },
          newChat: {
            label: 'New Chat',
            description: 'Clear the current thread and start a fresh conversation.'
          },
          taskCenter: {
            label: 'Open Task Center',
            description: 'Inspect schedules, execution state, and recent deliveries.'
          },
          developerWorkbench: {
            label: 'Open Workbench',
            description: 'Jump to the Plan / Review / Diff / Patch workflows.'
          },
          desktopControl: {
            label: 'Open Desktop Control',
            description: 'Jump straight to the desktop window control panel.'
          },
          desktopMovePrevious: {
            label: 'Send To Previous Display',
            description: 'Move the latest desktop window to the previous display while keeping its size.'
          },
          desktopMoveNext: {
            label: 'Send To Next Display',
            description: 'Move the latest desktop window to the next display while keeping its size.'
          },
          desktopSnapLeft: {
            label: 'Recall To Left Half',
            description: 'Snap the latest desktop window to the left half of its current display.'
          },
          desktopSnapMaximize: {
            label: 'Recall To Fill Work Area',
            description: 'Expand the latest desktop window to fill the current display work area.'
          },
          desktopSnapRight: {
            label: 'Recall To Right Half',
            description: 'Snap the latest desktop window to the right half of its current display.'
          },
          dynamicIsland: {
            label: 'Open Dynamic Island',
            description: 'Open the floating overlay surface for system feedback.'
          },
          floatingTaskHud: {
            label: 'Open Task HUD',
            description: 'Open the floating task HUD to monitor deliveries and desktop feedback.'
          },
          recallCenter: {
            label: 'Open Recall Center',
            description: 'Review interrupted runs, snapshots, and recovery context.'
          },
          modelSelector: {
            label: 'Choose Model',
            description: 'Open the home model selector for this conversation.'
          }
        },
        metrics: {
          dialogue: {
            label: 'Conversation Turns',
            idle: 'A fresh conversation is ready to begin',
            active: 'The current chat context is active'
          },
          tasks: {
            label: 'Running Tasks',
            idle: 'Task Center is ready when you need it',
            active: 'Tasks are still queued or running'
          },
          capabilities: {
            label: 'Enabled Capabilities',
            idle: 'Lightweight chat mode is active'
          },
          workspace: {
            label: 'Current Workspace',
            idle: 'CLI workspace is not enabled yet',
            ready: 'CLI workspace and project context are connected'
          }
        }
      };
    },
    homeChatConversationTitle() {
      return this.generateConversationTitle(Array.isArray(this.messages) ? this.messages : []);
    },
    homeChatWorkspaceName() {
      const rawPath = String(this.CLISettings?.cc_path || '').trim();
      const normalizedPath = rawPath.replace(/\\/g, '/').toLowerCase();
      const hasVisibleWorkspace = Boolean(this.CLISettings?.enabled && rawPath);
      const looksBundledWorkspace = normalizedPath.startsWith('d:/openxnet/github-clone/')
        || normalizedPath.startsWith('d:/openxnet/cc-source/');
      if (!hasVisibleWorkspace || looksBundledWorkspace) {
        return this.homeChatCopy.workspaceFallback;
      }
      const parts = rawPath.split(/[/\\]/).filter(Boolean);
      return parts.length > 0 ? parts[parts.length - 1] : rawPath;
    },
    homeChatEnabledCapabilities() {
      const capabilities = [];
      if (this.fastSettings?.enabled) capabilities.push(this.t('fastResponseButton'));
      if (this.reasonerSettings?.enabled) capabilities.push(this.t('deepThinking'));
      if (this.toolsSettings?.deepsearch?.enabled) capabilities.push(this.t('deepResearch'));
      if (this.visionSettings?.enabled) capabilities.push(this.t('vision'));
      if (this.visionSettings?.desktopVision) capabilities.push(this.t('desktopVisionButton'));
      if (this.webSearchSettings?.enabled) capabilities.push(this.t('webSearch'));
      if (this.memorySettings?.is_memory) capabilities.push(this.t('memory'));
      if (this.codeSettings?.enabled) capabilities.push(this.t('interpreter'));
      if (this.CLISettings?.enabled) capabilities.push(this.t('CLItool'));
      if (this.chromeMCPSettings?.enabled) capabilities.push(this.t('browserControl'));
      if (this.hasEnabledKnowledgeBases) capabilities.push(this.t('knowledgeBase'));
      if (this.hasEnabledLLMTools) capabilities.push(this.t('llmTools'));
      if (this.hasEnabledMCPServers) capabilities.push(this.t('mcpServers'));
      return capabilities;
    },
    homeChatStatusSummary() {
      const latestInsight = String(this.sidePanelText || '').replace(/\s+/g, ' ').trim();
      if (!latestInsight || latestInsight.toLowerCase() === 'response error') {
        return this.homeChatCopy.defaultSummary;
      }
      return latestInsight.length > 160 ? `${latestInsight.slice(0, 160)}...` : latestInsight;
    },
    homeChatLatestDesktopAction() {
      return Array.isArray(this.desktopControlRecentActions) && this.desktopControlRecentActions.length > 0
        ? this.desktopControlRecentActions[0]
        : null;
    },
    homeChatLatestDesktopActionTitle() {
      const actionItem = this.homeChatLatestDesktopAction;
      if (!actionItem) {
        return this.homeChatCopy.latestDesktopActionEmpty;
      }
      const actionLabel = String(actionItem.action_label || actionItem.title || 'Desktop Action').trim();
      const targetLabel = typeof this.desktopControlActionTargetLabel === 'function'
        ? this.desktopControlActionTargetLabel(actionItem)
        : String(actionItem?.window?.title || '').trim();
      return [actionLabel, targetLabel].filter(Boolean).join(' · ');
    },
    homeChatLatestDesktopActionSummary() {
      const actionItem = this.homeChatLatestDesktopAction;
      if (!actionItem) {
        return this.homeChatCopy.latestDesktopActionEmpty;
      }
      const summary = String(actionItem.summary || '').trim();
      if (!summary) {
        return this.homeChatCopy.latestDesktopActionEmpty;
      }
      return summary.length > 140 ? `${summary.slice(0, 140)}...` : summary;
    },
    homeCommandLatestDesktopActionHwnd() {
      const actionItem = this.homeChatLatestDesktopAction;
      const targetHwnd = Number(actionItem?.hwnd || actionItem?.window?.hwnd || 0);
      return Number.isFinite(targetHwnd) && targetHwnd > 0 ? targetHwnd : 0;
    },
    homeCommandLatestDesktopActionAvailable() {
      const actionItem = this.homeChatLatestDesktopAction;
      if (!actionItem) {
        return false;
      }
      const status = String(actionItem.status || '').trim().toLowerCase();
      return this.homeCommandLatestDesktopActionHwnd > 0 && status !== 'failed';
    },
    homeCommandDesktopRecallTitle() {
      return this.homeChatLatestDesktopAction
        ? this.homeChatLatestDesktopActionTitle
        : this.homeChatCopy.desktopRecallEmptyTitle;
    },
    homeCommandDesktopRecallSummary() {
      if (!this.homeChatLatestDesktopAction) {
        return this.homeChatCopy.desktopRecallEmpty;
      }
      if (!this.homeCommandLatestDesktopActionAvailable) {
        return this.homeChatCopy.desktopRecallUnavailable;
      }
      return this.homeChatLatestDesktopActionSummary;
    },
    homeCommandLatestDesktopActionMeta() {
      const actionItem = this.homeChatLatestDesktopAction;
      if (!actionItem) {
        return this.homeChatCopy.desktopRecallEmptyMeta;
      }
      const parts = [];
      const relativeTime = typeof this.formatDesktopControlRelativeTime === 'function'
        ? this.formatDesktopControlRelativeTime(actionItem.timestamp)
        : '';
      const statusLabel = String(actionItem.status_label || '').trim();
      const contextLabel = typeof this.desktopControlActionContextLabel === 'function'
        ? this.desktopControlActionContextLabel(actionItem)
        : '';
      if (relativeTime && relativeTime !== '--') {
        parts.push(relativeTime);
      }
      if (statusLabel) {
        parts.push(statusLabel);
      }
      if (contextLabel && contextLabel !== 'Click to sync selection') {
        parts.push(contextLabel);
      }
      return parts.join(' · ') || this.homeChatCopy.desktopRecallEmptyMeta;
    },
    homeDesktopSceneReady() {
      return this.desktopControlSceneMonitors.length > 0 || this.desktopControlSceneWindows.length > 0;
    },
    homeDesktopScenePrimaryWindow() {
      return this.selectedDesktopControlWindow
        || (this.desktopControlActiveWindow?.hwnd ? this.desktopControlActiveWindow : null)
        || (Array.isArray(this.desktopControlWindows) && this.desktopControlWindows.length > 0 ? this.desktopControlWindows[0] : null)
        || null;
    },
    homeDesktopScenePrimaryHwnd() {
      const hwnd = Number(this.homeDesktopScenePrimaryWindow?.hwnd || 0);
      return Number.isFinite(hwnd) && hwnd > 0 ? hwnd : 0;
    },
    homeDesktopSceneActionAvailable() {
      return this.homeDesktopScenePrimaryHwnd > 0;
    },
    homeDesktopScenePrimaryWindowTitle() {
      if (!this.homeDesktopSceneActionAvailable) {
        return this.homeChatCopy.desktopSceneTitleEmpty;
      }

      const fallbackTitle = String(
        this.homeDesktopScenePrimaryWindow?.process_name
        || this.homeDesktopScenePrimaryWindow?.class_name
        || `HWND ${this.homeDesktopScenePrimaryHwnd}`
      ).trim();
      const title = String(this.homeDesktopScenePrimaryWindow?.title || fallbackTitle).trim() || fallbackTitle;
      return title.length > 72 ? `${title.slice(0, 71)}…` : title;
    },
    homeDesktopScenePrimaryWindowSummary() {
      if (!this.homeDesktopSceneReady) {
        return this.homeChatCopy.desktopSceneSummaryEmpty;
      }
      if (!this.homeDesktopSceneActionAvailable) {
        return this.homeChatCopy.desktopSceneMetaEmpty;
      }

      const parts = [];
      const monitorLabel = String(this.selectedDesktopControlMonitor?.label || '').trim();
      const processName = String(
        this.homeDesktopScenePrimaryWindow?.process_name
        || this.homeDesktopScenePrimaryWindow?.class_name
        || ''
      ).trim();

      if (monitorLabel) {
        parts.push(monitorLabel);
      }
      if (processName) {
        parts.push(processName);
      }
      if (this.selectedDesktopControlWindowIsActive) {
        parts.push(this.homeChatCopy.desktopSceneStateForeground);
      }
      if (this.homeDesktopScenePrimaryWindow?.is_minimized) {
        parts.push(this.homeChatCopy.desktopSceneStateMinimized);
      }

      return parts.join(' · ') || this.homeChatCopy.desktopSceneMetaEmpty;
    },
    homeDesktopScenePrimaryWindowMeta() {
      if (!this.homeDesktopSceneActionAvailable) {
        return this.homeChatCopy.desktopSceneMetaEmpty;
      }

      const parts = [];
      if (this.homeDesktopScenePrimaryHwnd > 0) {
        parts.push(`HWND ${this.homeDesktopScenePrimaryHwnd}`);
      }

      const rect = this.homeDesktopScenePrimaryWindow?.rect || null;
      const width = Number(rect?.width || 0);
      const height = Number(rect?.height || 0);
      if (width > 0 && height > 0) {
        parts.push(`${width} × ${height}`);
      }

      if (this.selectedDesktopControlMonitor?.is_primary) {
        parts.push(this.homeChatCopy.desktopSceneStatePrimaryDisplay);
      }

      return parts.join(' · ') || this.homeChatCopy.desktopSceneMetaEmpty;
    },
    homeDesktopSceneMonitorTargets() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      return this.desktopControlSceneMonitors.map((sceneMonitor) => ({
        ...sceneMonitor,
        kicker: sceneMonitor.is_primary
          ? (isZh ? '主显示器' : 'Primary Display')
          : (isZh ? '显示器' : 'Display'),
      }));
    },
    homeDesktopSceneTargetWindows() {
      return this.desktopControlSceneWindows.slice(0, 6).map((sceneWindow) => ({
        ...sceneWindow,
      }));
    },
    homeDesktopSceneQuickPresets() {
      const desiredOrder = ['maximize', 'left', 'right', 'center'];
      const presets = Array.isArray(this.homeDesktopRecallLayoutPresets)
        ? this.homeDesktopRecallLayoutPresets
        : [];
      return desiredOrder
        .map((presetId) => presets.find((preset) => preset.id === presetId))
        .filter(Boolean);
    },
    homeChatSurfaceMetrics() {
      const copy = this.homeChatCopy.metrics;
      const dialogueTurns = (this.messages || []).filter((message) => ['user', 'assistant'].includes(message.role)).length;
      const runningTasks = (this.taskList || []).filter((task) => {
        const status = String(task?.status || '').toLowerCase();
        return ['queued', 'running', 'retrying', 'pending', 'scheduled'].includes(status);
      }).length;
      const enabledCapabilities = this.homeChatEnabledCapabilities;
      return [
        {
          key: 'dialogue',
          label: copy.dialogue.label,
          value: dialogueTurns,
          meta: dialogueTurns > 0 ? copy.dialogue.active : copy.dialogue.idle
        },
        {
          key: 'tasks',
          label: copy.tasks.label,
          value: runningTasks,
          meta: runningTasks > 0 ? copy.tasks.active : copy.tasks.idle
        },
        {
          key: 'capabilities',
          label: copy.capabilities.label,
          value: enabledCapabilities.length,
          meta: enabledCapabilities.length > 0 ? enabledCapabilities.slice(0, 3).join(' · ') : copy.capabilities.idle
        },
        {
          key: 'workspace',
          label: copy.workspace.label,
          value: this.homeChatWorkspaceName,
          meta: this.CLISettings?.enabled && String(this.CLISettings?.cc_path || '').trim()
            ? copy.workspace.ready
            : copy.workspace.idle
        }
      ];
    },
    homeCommandItems() {
      const copy = this.homeChatCopy.commands;
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const badges = isZh
        ? {
            recall: '召回',
            display: '显示器',
            layout: '布局',
            chat: '聊天',
            reset: '重置',
            tasks: '任务',
            workbench: '工作台',
            desktop: '桌面',
            overlay: '悬浮层',
            model: '模型',
          }
        : {
            recall: 'Recall',
            display: 'Display',
            layout: 'Layout',
            chat: 'Chat',
            reset: 'Reset',
            tasks: 'Tasks',
            workbench: 'Workbench',
            desktop: 'Desktop',
            overlay: 'Overlay',
            model: 'Model',
          };
      const latestDesktopTargetLabel = typeof this.desktopControlActionTargetLabel === 'function'
        ? this.desktopControlActionTargetLabel(this.homeChatLatestDesktopAction)
        : '';
      const items = [
        this.homeCommandLatestDesktopActionAvailable
          ? {
              id: 'desktop-recall-focus',
              icon: 'fa-solid fa-crosshairs',
              group: 'desktop',
              badge: badges.recall,
              emphasis: 'strong',
              label: [
                this.homeChatCopy.desktopRecallCommandPrefix,
                latestDesktopTargetLabel,
              ].filter(Boolean).join(' · '),
              description: this.homeCommandLatestDesktopActionMeta,
              keywords: [
                'desktop',
                'recall',
                'window',
                'focus',
                '桌面',
                '召回',
                '窗口',
                '聚焦',
                this.homeCommandLatestDesktopActionHwnd ? String(this.homeCommandLatestDesktopActionHwnd) : '',
              ].filter(Boolean),
            }
          : null,
        this.homeCommandLatestDesktopActionAvailable
          ? {
              id: 'desktop-recall-previous-monitor',
              icon: 'fa-solid fa-backward-step',
              group: 'desktop',
              badge: badges.display,
              label: [
                copy.desktopMovePrevious.label,
                latestDesktopTargetLabel,
              ].filter(Boolean).join(' · '),
              description: copy.desktopMovePrevious.description,
              keywords: [
                'desktop',
                'display',
                'monitor',
                'previous',
                'window',
                '桌面',
                '显示器',
                '上一显示器',
                '窗口',
                this.homeCommandLatestDesktopActionHwnd ? String(this.homeCommandLatestDesktopActionHwnd) : '',
              ].filter(Boolean),
            }
          : null,
        this.homeCommandLatestDesktopActionAvailable
          ? {
              id: 'desktop-recall-next-monitor',
              icon: 'fa-solid fa-forward-step',
              group: 'desktop',
              badge: badges.display,
              label: [
                copy.desktopMoveNext.label,
                latestDesktopTargetLabel,
              ].filter(Boolean).join(' · '),
              description: copy.desktopMoveNext.description,
              keywords: [
                'desktop',
                'display',
                'monitor',
                'next',
                'window',
                '桌面',
                '显示器',
                '下一显示器',
                '窗口',
                this.homeCommandLatestDesktopActionHwnd ? String(this.homeCommandLatestDesktopActionHwnd) : '',
              ].filter(Boolean),
            }
          : null,
        this.homeCommandLatestDesktopActionAvailable
          ? {
              id: 'desktop-recall-snap-left',
              icon: 'fa-solid fa-table-columns',
              group: 'desktop',
              badge: badges.layout,
              label: [
                copy.desktopSnapLeft.label,
                latestDesktopTargetLabel,
              ].filter(Boolean).join(' · '),
              description: copy.desktopSnapLeft.description,
              keywords: [
                'desktop',
                'window',
                'snap',
                'left',
                'half',
                '桌面',
                '窗口',
                '左半屏',
                '贴靠',
                this.homeCommandLatestDesktopActionHwnd ? String(this.homeCommandLatestDesktopActionHwnd) : '',
              ].filter(Boolean),
            }
          : null,
        this.homeCommandLatestDesktopActionAvailable
          ? {
              id: 'desktop-recall-snap-maximize',
              icon: 'fa-solid fa-expand',
              group: 'desktop',
              badge: badges.layout,
              label: [
                copy.desktopSnapMaximize.label,
                latestDesktopTargetLabel,
              ].filter(Boolean).join(' · '),
              description: copy.desktopSnapMaximize.description,
              keywords: [
                'desktop',
                'window',
                'snap',
                'maximize',
                'fill',
                'work area',
                '桌面',
                '窗口',
                '铺满',
                '工作区',
                this.homeCommandLatestDesktopActionHwnd ? String(this.homeCommandLatestDesktopActionHwnd) : '',
              ].filter(Boolean),
            }
          : null,
        this.homeCommandLatestDesktopActionAvailable
          ? {
              id: 'desktop-recall-snap-right',
              icon: 'fa-solid fa-table-columns fa-flip-horizontal',
              group: 'desktop',
              badge: badges.layout,
              label: [
                copy.desktopSnapRight.label,
                latestDesktopTargetLabel,
              ].filter(Boolean).join(' · '),
              description: copy.desktopSnapRight.description,
              keywords: [
                'desktop',
                'window',
                'snap',
                'right',
                'half',
                '桌面',
                '窗口',
                '右半屏',
                '贴靠',
                this.homeCommandLatestDesktopActionHwnd ? String(this.homeCommandLatestDesktopActionHwnd) : '',
              ].filter(Boolean),
            }
          : null,
        {
          id: 'focus-input',
          icon: 'fa-solid fa-feather-pointed',
          group: 'workspace',
          badge: badges.chat,
          label: copy.focusInput.label,
          description: copy.focusInput.description,
          keywords: ['input', 'chat', 'compose', '输入', '聊天', 'composer']
        },
        {
          id: 'new-chat',
          icon: 'fa-solid fa-comment-medical',
          group: 'workspace',
          badge: badges.reset,
          label: copy.newChat.label,
          description: copy.newChat.description,
          keywords: ['new', 'clear', 'conversation', '新建', '清空', '对话']
        },
        {
          id: 'task-center',
          icon: 'fa-solid fa-list-check',
          group: 'workspace',
          badge: badges.tasks,
          emphasis: 'strong',
          label: copy.taskCenter.label,
          description: copy.taskCenter.description,
          keywords: ['task', 'schedule', 'delivery', '任务', '调度', '投递']
        },
        {
          id: 'developer-workbench',
          icon: 'fa-solid fa-screwdriver-wrench',
          group: 'workspace',
          badge: badges.workbench,
          label: copy.developerWorkbench.label,
          description: copy.developerWorkbench.description,
          keywords: ['develop', 'workbench', 'plan', 'review', '开发', '工作台']
        },
        {
          id: 'desktop-control',
          icon: 'fa-solid fa-window-restore',
          group: 'desktop',
          badge: badges.desktop,
          emphasis: 'strong',
          label: copy.desktopControl.label,
          description: copy.desktopControl.description,
          keywords: ['desktop', 'window', 'shell', 'control', '桌面', '窗口', '置顶', '移动']
        },
        {
          id: 'dynamic-island',
          icon: 'fa-solid fa-wave-square',
          group: 'overlay',
          badge: badges.overlay,
          label: copy.dynamicIsland.label,
          description: copy.dynamicIsland.description,
          shortcut: this.dynamicIslandGlobalShortcutLabel,
          keywords: ['dynamic', 'island', 'overlay', 'hud', '灵动岛', '悬浮', '浮层', this.dynamicIslandGlobalShortcutLabel]
        },
        {
          id: 'floating-task-hud',
          icon: 'fa-solid fa-chart-line',
          group: 'overlay',
          badge: badges.overlay,
          emphasis: 'strong',
          label: copy.floatingTaskHud.label,
          description: copy.floatingTaskHud.description,
          shortcut: this.floatingTaskHudGlobalShortcutLabel,
          keywords: ['task', 'hud', 'overlay', 'feed', 'desktop', '任务', '悬浮', '投递', '雷达', this.floatingTaskHudGlobalShortcutLabel]
        },
        {
          id: 'recall-center',
          icon: 'fa-solid fa-clock-rotate-left',
          group: 'memory',
          badge: badges.recall,
          emphasis: 'strong',
          label: copy.recallCenter.label,
          description: copy.recallCenter.description,
          keywords: ['recall', 'memory', 'resume', 'snapshot', '恢复', '记忆', '时间线']
        },
        {
          id: 'model-selector',
          icon: 'fa-solid fa-microchip',
          group: 'memory',
          badge: badges.model,
          label: copy.modelSelector.label,
          description: copy.modelSelector.description,
          keywords: ['model', 'provider', '配置', '模型', '服务商']
        }
      ];
      return items.filter(Boolean);
    },
    filteredHomeCommandItems() {
      const query = String(this.homeCommandQuery || '').trim().toLowerCase();
      if (!query) {
        return this.homeCommandItems;
      }
      return this.homeCommandItems.filter((item) => {
        const haystack = [item.label, item.description, ...(item.keywords || [])].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    },
    homeCommandSections() {
      const order = ['workspace', 'desktop', 'overlay', 'memory'];
      const sectionCopy = this.homeChatCopy.sections || {};
      return order.map((sectionId) => {
        const items = this.homeCommandItems.filter((item) => item.group === sectionId);
        const copy = sectionCopy[sectionId] || {};
        return {
          id: sectionId,
          kicker: copy.kicker || '',
          label: copy.label || sectionId,
          summary: copy.summary || '',
          count: items.length,
          items,
        };
      }).filter((section) => section.items.length > 0);
    },
    filteredHomeCommandSections() {
      const query = String(this.homeCommandQuery || '').trim().toLowerCase();
      if (!query) {
        return this.homeCommandSections;
      }
      return this.homeCommandSections.map((section) => {
        const items = section.items.filter((item) => {
          const haystack = [item.label, item.description, item.shortcut || '', ...(item.keywords || [])].join(' ').toLowerCase();
          return haystack.includes(query);
        });
        return {
          ...section,
          count: items.length,
          items,
        };
      }).filter((section) => section.items.length > 0);
    },
    homeCommandDeckStats() {
      const copy = this.homeChatCopy.deckStats || {};
      const runningTasks = (this.taskList || []).filter((task) => {
        const status = String(task?.status || '').toLowerCase();
        return ['queued', 'running', 'retrying', 'pending', 'scheduled'].includes(status);
      }).length;
      const workspaceReady = Boolean(this.CLISettings?.enabled && String(this.CLISettings?.cc_path || '').trim());
      const desktopDisplays = Array.isArray(this.desktopControlSceneMonitors) ? this.desktopControlSceneMonitors.length : 0;
      const desktopWindows = Array.isArray(this.desktopControlSceneWindows) ? this.desktopControlSceneWindows.length : 0;
      const overlayShortcutReadyCount = ['dynamicIsland', 'floatingTaskHud'].filter((key) => this.globalShortcutStatus?.[key]?.registered).length;
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const desktopSceneValue = isZh
        ? `${desktopDisplays} 屏 / ${desktopWindows} 窗口`
        : `${desktopDisplays} displays / ${desktopWindows} windows`;
      return [
        {
          key: 'workspace',
          icon: 'fa-solid fa-folder-tree',
          tone: workspaceReady ? 'ready' : 'default',
          label: copy.workspace?.label || 'Workspace',
          value: this.homeChatWorkspaceName,
          meta: workspaceReady ? copy.workspace?.ready : copy.workspace?.idle,
        },
        {
          key: 'tasks',
          icon: 'fa-solid fa-list-check',
          tone: runningTasks > 0 ? 'active' : 'default',
          label: copy.tasks?.label || 'Tasks',
          value: String(runningTasks),
          meta: runningTasks > 0 ? copy.tasks?.active : copy.tasks?.idle,
        },
        {
          key: 'desktop',
          icon: 'fa-solid fa-display',
          tone: this.homeCommandLatestDesktopActionAvailable ? 'ready' : 'default',
          label: copy.desktop?.label || 'Desktop',
          value: this.homeCommandLatestDesktopActionAvailable ? this.homeCommandDesktopRecallTitle : desktopSceneValue,
          meta: this.homeCommandLatestDesktopActionAvailable ? this.homeCommandLatestDesktopActionMeta : (desktopWindows > 0 ? desktopSceneValue : copy.desktop?.idle),
        },
        {
          key: 'overlay',
          icon: 'fa-solid fa-layer-group',
          tone: overlayShortcutReadyCount > 0 ? 'active' : 'default',
          label: copy.overlay?.label || 'Overlay',
          value: `${overlayShortcutReadyCount}/2`,
          meta: overlayShortcutReadyCount > 0
            ? `${copy.overlay?.ready || ''} · ${copy.overlay?.meta || ''}`.replace(/^ · | · $/g, '')
            : (copy.overlay?.idle || copy.overlay?.meta || ''),
        },
      ];
    },
    homeChatFlightSignals() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const capabilityCount = Array.isArray(this.homeChatEnabledCapabilities)
        ? this.homeChatEnabledCapabilities.length
        : 0;
      return [
        {
          key: 'model',
          icon: 'fa-solid fa-microchip',
          text: this.settings?.model || this.homeChatCopy.modelFallback,
        },
        {
          key: 'capabilities',
          icon: 'fa-solid fa-sparkles',
          text: isZh ? `已启用能力 ${capabilityCount}` : `${capabilityCount} capabilities online`,
        },
        {
          key: 'shortcut',
          icon: 'fa-solid fa-keyboard',
          text: this.homeCommandShortcutSummary,
        },
        {
          key: 'workspace',
          icon: 'fa-solid fa-folder-tree',
          text: this.homeChatWorkspaceName,
        },
        this.homeCurrentRecallFlow.hasTarget
          ? {
              key: 'current-flow',
              icon: 'fa-solid fa-wave-square',
              text: this.homeCurrentRecallFlow.observationCountText,
            }
          : null,
      ].filter((item) => String(item?.text || '').trim());
    },
    homeCurrentRecallFlow() {
      const copy = this.homeChatCopy.currentFlow || {};
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const context = this.recallObservationContext && typeof this.recallObservationContext === 'object'
        ? this.recallObservationContext
        : {};
      const observations = Array.isArray(this.recallObservationItems)
        ? this.recallObservationItems.filter(Boolean)
        : [];
      const latest = observations[0] || {};
      const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const taskId = normalizeText(context.task_id || latest.task_id);
      const sessionId = normalizeText(context.session_id || latest.session_id);
      const digest = normalizeText(context.digest || latest.digest);
      const source = normalizeText(context.source || latest.source);
      const title = normalizeText(context.title || context.task_title || latest.title || latest.task_title);
      const hasTarget = Boolean(taskId || sessionId || digest || title);
      const fallbackTaskTitle = taskId ? `Task ${taskId}` : '';
      const displayTitle = hasTarget
        ? (title || fallbackTaskTitle || copy.kicker || 'Current Flow')
        : (copy.emptyTitle || 'Waiting For Recall Flow');
      const latestSummary = normalizeText(latest.summary || latest.detail || context.summary);
      const summary = latestSummary || (hasTarget
        ? (copy.syncedSummary || 'The active execution flow is synced on Home.')
        : (copy.emptySummary || 'Select a Recall flow to sync it here.'));
      const stageRaw = normalizeText(latest.stage || context.stage);
      const stageLabel = stageRaw && typeof this.formatRecallLabel === 'function'
        ? this.formatRecallLabel(stageRaw)
        : stageRaw;
      const statusLabel = normalizeText(latest.status || context.status);
      const timestampValue = latest.timestamp || latest.created_at || context.timestamp || '';
      const relativeTime = typeof this.formatDesktopControlRelativeTime === 'function'
        ? this.formatDesktopControlRelativeTime(timestampValue)
        : '';
      const noteParts = [
        stageLabel,
        statusLabel,
        relativeTime && relativeTime !== '--' ? relativeTime : '',
      ].filter(Boolean);
      const note = noteParts.join(' · ') || (hasTarget
        ? (copy.syncedMeta || 'The current flow is synced on Home')
        : (copy.idleMeta || 'Select a Recall flow first'));
      const observationCount = observations.length;
      const observationCountText = typeof this.formatObservationCount === 'function'
        ? this.formatObservationCount(observationCount)
        : `${copy.observationLabel || (isZh ? '观察点' : 'Observations')} ${observationCount}`;
      const tags = [
        {
          key: 'observations',
          label: observationCountText,
          type: 'warning',
          effect: 'plain',
        },
        taskId
          ? {
              key: 'task',
              label: `Task ${taskId}`,
              type: 'danger',
              effect: 'plain',
            }
          : null,
        sessionId
          ? {
              key: 'session',
              label: `Session ${sessionId}`,
              type: '',
              effect: 'plain',
            }
          : null,
        source
          ? {
              key: 'source',
              label: source,
              type: '',
              effect: 'plain',
            }
          : null,
        hasTarget
          ? {
              key: 'synced',
              label: copy.syncBadge || (isZh ? '已同步' : 'Synced'),
              type: 'success',
              effect: 'plain',
            }
          : null,
      ].filter(Boolean);
      const previewItems = observations.slice(0, 3).map((item, index) => {
        const previewStageRaw = normalizeText(item.stage);
        const previewStage = previewStageRaw && typeof this.formatRecallLabel === 'function'
          ? this.formatRecallLabel(previewStageRaw)
          : previewStageRaw;
        const previewTypeRaw = normalizeText(item.item_type);
        const previewType = previewTypeRaw && typeof this.formatRecallItemType === 'function'
          ? this.formatRecallItemType(previewTypeRaw)
          : previewTypeRaw;
        const previewTitle = normalizeText(item.summary || item.title || item.task_title || item.detail)
          || `${copy.observationLabel || (isZh ? '观察点' : 'Observation')} ${index + 1}`;
        const previewDetail = normalizeText(item.detail);
        return {
          key: normalizeText(item.observation_id || item.digest || `${taskId || sessionId || 'flow'}-${index}`),
          kicker: [previewStage, previewType].filter(Boolean).join(' · '),
          title: previewTitle,
          detail: previewDetail && previewDetail !== previewTitle ? previewDetail : '',
        };
      });
      const tone = hasTarget
        ? (['running', 'queued', 'retrying', 'pending', 'scheduled', 'active'].includes(statusLabel.toLowerCase()) ? 'active' : 'ready')
        : 'default';
      return {
        hasTarget,
        tone,
        title: displayTitle,
        summary,
        note,
        observationCount,
        observationCountText,
        taskId,
        sessionId,
        source,
        stageLabel,
        statusLabel,
        relativeTime,
        tags,
        previewItems,
      };
    },
    homeChatPreviewSections() {
      const preferredOrder = {
        workspace: ['task-center', 'developer-workbench', 'focus-input', 'new-chat'],
        desktop: ['desktop-control', 'desktop-recall-focus', 'desktop-recall-snap-maximize', 'desktop-recall-next-monitor'],
        overlay: ['dynamic-island', 'floating-task-hud'],
        memory: ['recall-center', 'model-selector'],
      };
      const previewLimit = {
        workspace: 3,
        desktop: 3,
        overlay: 2,
        memory: 2,
      };
      return (this.homeCommandSections || []).map((section) => {
        const items = Array.isArray(section?.items) ? section.items : [];
        const desiredIds = preferredOrder[section.id] || [];
        const selectedItems = desiredIds
          .map((commandId) => items.find((item) => item.id === commandId))
          .filter(Boolean);
        const fallbackItems = items.filter((item) => !selectedItems.some((selected) => selected.id === item.id));
        const limit = previewLimit[section.id] || 2;
        return {
          ...section,
          previewItems: [...selectedItems, ...fallbackItems].slice(0, limit),
        };
      }).filter((section) => Array.isArray(section.previewItems) && section.previewItems.length > 0);
    },
    selectedDesktopControlWindow() {
      return (this.desktopControlWindows || []).find((item) => item.hwnd === this.desktopControlSelectedHwnd) || null;
    },
    selectedDesktopControlMonitor() {
      const monitors = Array.isArray(this.desktopControlMonitors) ? this.desktopControlMonitors : [];
      return monitors.find((item) => item.index === this.desktopControlSelectedMonitorIndex) || monitors[0] || null;
    },
    selectedDesktopControlWindowIsActive() {
      return Boolean(
        this.selectedDesktopControlWindow?.hwnd
        && this.desktopControlActiveWindow?.hwnd
        && this.selectedDesktopControlWindow.hwnd === this.desktopControlActiveWindow.hwnd
      );
    },
    desktopControlActiveWindowSyncAvailable() {
      return Boolean(
        this.desktopControlActiveWindow?.hwnd
        && this.desktopControlActiveWindow?.supported !== false
        && this.desktopControlActiveWindow.hwnd !== this.desktopControlSelectedHwnd
      );
    },
    desktopControlWindowStateCounts() {
      const activeHwnd = Number(this.desktopControlActiveWindow?.hwnd || 0);
      return (this.desktopControlWindows || []).reduce((counts, windowItem) => {
        const isMinimized = Boolean(windowItem?.minimized || windowItem?.is_minimized);
        const isTopmost = Boolean(windowItem?.always_on_top);
        const isActive = Boolean(windowItem?.is_active || (activeHwnd > 0 && Number(windowItem?.hwnd || 0) === activeHwnd));

        counts.all += 1;
        if (isActive) {
          counts.foreground += 1;
        }
        if (isMinimized) {
          counts.minimized += 1;
        } else {
          counts.visible += 1;
        }
        if (isTopmost) {
          counts.topmost += 1;
        }
        return counts;
      }, {
        all: 0,
        foreground: 0,
        visible: 0,
        minimized: 0,
        topmost: 0,
      });
    },
    desktopControlWindowFilterOptions() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const counts = this.desktopControlWindowStateCounts;
      return [
        {
          id: 'all',
          label: isZh ? '全部' : 'All',
          description: isZh ? '所有可操作窗口' : 'All actionable windows',
          count: counts.all,
        },
        {
          id: 'foreground',
          label: isZh ? '前台' : 'Foreground',
          description: isZh ? '当前活动窗口' : 'Current foreground window',
          count: counts.foreground,
        },
        {
          id: 'visible',
          label: isZh ? '可见' : 'Visible',
          description: isZh ? '未最小化窗口' : 'Windows not minimized',
          count: counts.visible,
        },
        {
          id: 'minimized',
          label: isZh ? '最小化' : 'Minimized',
          description: isZh ? '已最小化窗口' : 'Minimized windows',
          count: counts.minimized,
        },
        {
          id: 'topmost',
          label: isZh ? '置顶' : 'TopMost',
          description: isZh ? '置顶中的窗口' : 'Always-on-top windows',
          count: counts.topmost,
        },
      ];
    },
    desktopControlFilteredWindows() {
      const normalizedFilter = String(this.desktopControlWindowFilter || 'all').trim().toLowerCase() || 'all';
      const query = String(this.desktopControlWindowQuery || '').trim().toLowerCase();
      const activeHwnd = Number(this.desktopControlActiveWindow?.hwnd || 0);

      return (this.desktopControlWindows || [])
        .filter((windowItem) => {
          const isMinimized = Boolean(windowItem?.minimized || windowItem?.is_minimized);
          const isTopmost = Boolean(windowItem?.always_on_top);
          const isActive = Boolean(windowItem?.is_active || (activeHwnd > 0 && Number(windowItem?.hwnd || 0) === activeHwnd));

          if (normalizedFilter === 'foreground' && !isActive) {
            return false;
          }
          if (normalizedFilter === 'visible' && isMinimized) {
            return false;
          }
          if (normalizedFilter === 'minimized' && !isMinimized) {
            return false;
          }
          if (normalizedFilter === 'topmost' && !isTopmost) {
            return false;
          }

          if (!query) {
            return true;
          }

          const haystack = [
            windowItem?.title,
            windowItem?.process_name,
            windowItem?.class_name,
            `HWND ${windowItem?.hwnd || ''}`,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(query);
        })
        .sort((leftWindow, rightWindow) => {
          const leftIsMinimized = Boolean(leftWindow?.minimized || leftWindow?.is_minimized);
          const rightIsMinimized = Boolean(rightWindow?.minimized || rightWindow?.is_minimized);
          const leftScore = (Number(leftWindow?.hwnd || 0) === Number(this.desktopControlSelectedHwnd || 0) ? 100 : 0)
            + (Number(leftWindow?.hwnd || 0) === activeHwnd ? 50 : 0)
            + (leftWindow?.always_on_top ? 20 : 0)
            + (leftIsMinimized ? 0 : 10);
          const rightScore = (Number(rightWindow?.hwnd || 0) === Number(this.desktopControlSelectedHwnd || 0) ? 100 : 0)
            + (Number(rightWindow?.hwnd || 0) === activeHwnd ? 50 : 0)
            + (rightWindow?.always_on_top ? 20 : 0)
            + (rightIsMinimized ? 0 : 10);
          if (rightScore !== leftScore) {
            return rightScore - leftScore;
          }

          const leftTitle = String(leftWindow?.title || leftWindow?.process_name || leftWindow?.class_name || leftWindow?.hwnd || '').trim();
          const rightTitle = String(rightWindow?.title || rightWindow?.process_name || rightWindow?.class_name || rightWindow?.hwnd || '').trim();
          return leftTitle.localeCompare(rightTitle, undefined, { sensitivity: 'base' });
        });
    },
    desktopControlWindowListSummary() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const total = Array.isArray(this.desktopControlWindows) ? this.desktopControlWindows.length : 0;
      const visible = this.desktopControlFilteredWindows.length;
      const filterItem = this.desktopControlWindowFilterOptions.find((item) => item.id === this.desktopControlWindowFilter)
        || this.desktopControlWindowFilterOptions[0]
        || null;
      const parts = [
        isZh
          ? `显示 ${visible} / ${total} 个窗口`
          : `Showing ${visible} of ${total} windows`,
      ];

      if (filterItem && filterItem.id !== 'all') {
        parts.push(isZh ? `筛选 ${filterItem.label}` : `Filter ${filterItem.label}`);
      }
      if (String(this.desktopControlWindowQuery || '').trim()) {
        parts.push(isZh ? `搜索 ${this.desktopControlWindowQuery.trim()}` : `Search ${this.desktopControlWindowQuery.trim()}`);
      }

      return parts.join(' · ');
    },
    desktopControlSelectedWindowStateSummary() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const selectedWindow = this.selectedDesktopControlWindow;
      if (!selectedWindow) {
        return isZh ? '从左侧窗口雷达选择目标后，这里会给出当前执行姿态。' : 'Pick a target from Window Radar to see its current execution posture.';
      }

      const rect = selectedWindow.rect || {};
      const parts = [];
      const monitorLabel = String(this.selectedDesktopControlMonitor?.label || '').trim();
      if (monitorLabel) {
        parts.push(monitorLabel);
      }
      parts.push(`${Number(rect.width || 0)} × ${Number(rect.height || 0)}`);
      if (this.selectedDesktopControlWindowIsActive) {
        parts.push(isZh ? '前台窗口' : 'Foreground');
      }
      if (Boolean(selectedWindow?.minimized || selectedWindow?.is_minimized)) {
        parts.push(isZh ? '已最小化' : 'Minimized');
      } else {
        parts.push(isZh ? '可见' : 'Visible');
      }
      if (selectedWindow?.always_on_top) {
        parts.push(isZh ? '置顶中' : 'TopMost');
      }
      return parts.join(' · ');
    },
    desktopControlMissionMetrics() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const selectedWindow = this.selectedDesktopControlWindow;
      if (!selectedWindow) {
        return [];
      }

      const rect = selectedWindow.rect || {};
      const positionValue = `(${Number(rect.left || 0)}, ${Number(rect.top || 0)})`;
      const canvasValue = `${Number(rect.width || 0)} × ${Number(rect.height || 0)}`;
      const processLabel = String(
        selectedWindow.process_name
        || selectedWindow.class_name
        || `HWND ${selectedWindow.hwnd || '--'}`
      ).trim();
      const monitorLabel = String(this.selectedDesktopControlMonitor?.label || '').trim()
        || (isZh ? '等待显示器数据' : 'Waiting for display data');
      const workspaceMode = this.desktopControlUseWorkArea !== false
        ? (isZh ? '工作区边界' : 'Work area bounds')
        : (isZh ? '整屏边界' : 'Full display bounds');
      const posturePrimary = this.selectedDesktopControlWindowIsActive
        ? (isZh ? '前台中' : 'Foreground')
        : (isZh ? '待命中' : 'Standing by');
      const postureMeta = [
        Boolean(selectedWindow?.minimized || selectedWindow?.is_minimized)
          ? (isZh ? '已最小化' : 'Minimized')
          : (isZh ? '可见' : 'Visible'),
        selectedWindow?.always_on_top
          ? (isZh ? '置顶层' : 'TopMost')
          : (isZh ? '普通层级' : 'Normal layer'),
      ].join(' · ');

      return [
        {
          id: 'process',
          label: isZh ? '进程' : 'Process',
          value: processLabel,
          meta: `HWND ${selectedWindow.hwnd}`,
        },
        {
          id: 'canvas',
          label: isZh ? '尺寸' : 'Canvas',
          value: canvasValue,
          meta: positionValue,
        },
        {
          id: 'display',
          label: isZh ? '显示器目标' : 'Display Target',
          value: monitorLabel,
          meta: workspaceMode,
        },
        {
          id: 'posture',
          label: isZh ? '执行姿态' : 'Execution Posture',
          value: posturePrimary,
          meta: postureMeta,
        },
      ];
    },
    desktopControlActionRecipes() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const selectedMonitorLabel = String(this.selectedDesktopControlMonitor?.label || '').trim()
        || (isZh ? '当前显示器' : 'current display');
      const workAreaLabel = this.desktopControlUseWorkArea !== false
        ? (isZh ? '工作区' : 'work area')
        : (isZh ? '整屏' : 'full display');

      return [
        {
          id: 'solo_focus',
          icon: 'fa-solid fa-expand',
          accent: 'emerald',
          title: isZh ? '专注铺满' : 'Solo Focus',
          description: isZh
            ? `恢复并聚焦窗口，然后铺满 ${selectedMonitorLabel} 的${workAreaLabel}。`
            : `Restore, focus, and fill the ${workAreaLabel} on ${selectedMonitorLabel}.`,
          stepsLabel: isZh ? '聚焦 -> 铺满' : 'Focus -> Fill',
        },
        {
          id: 'compare_left',
          icon: 'fa-solid fa-table-columns',
          accent: 'blue',
          title: isZh ? '左侧对照' : 'Compare Left',
          description: isZh
            ? `恢复窗口并贴靠到 ${selectedMonitorLabel} 左半区，方便并排对照。`
            : `Restore the window and snap it to the left half of ${selectedMonitorLabel} for side-by-side work.`,
          stepsLabel: isZh ? '聚焦 -> 左半屏' : 'Focus -> Left Half',
        },
        {
          id: 'reference_rail',
          icon: 'fa-solid fa-thumbtack',
          accent: 'amber',
          title: isZh ? '参考轨道' : 'Reference Rail',
          description: isZh
            ? `聚焦后压缩到右侧三分之一，并自动置顶，适合作为参考窗。`
            : 'Focus, compress to the right third, and pin it on top as a live reference rail.',
          stepsLabel: isZh ? '聚焦 -> 右 1/3 -> 置顶' : 'Focus -> Right Third -> Pin',
        },
        {
          id: 'center_stage',
          icon: 'fa-solid fa-crosshairs',
          accent: 'slate',
          title: isZh ? '中场交接' : 'Center Stage',
          description: isZh
            ? `送到 ${selectedMonitorLabel} 并重新居中，保留常规层级，适合继续接管。`
            : `Send the window to ${selectedMonitorLabel}, re-center it, and keep a normal layer for handoff work.`,
          stepsLabel: isZh ? '迁移显示器 -> 居中' : 'Send -> Center',
        },
      ];
    },
    desktopControlSnapPresets() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      if (isZh) {
        return [
          { id: 'maximize', label: '铺满工作区', compactLabel: '铺满', icon: 'fa-solid fa-expand' },
          { id: 'left', label: '左半屏', compactLabel: '左半', icon: 'fa-solid fa-table-columns' },
          { id: 'right', label: '右半屏', compactLabel: '右半', icon: 'fa-solid fa-table-columns fa-flip-horizontal' },
          { id: 'top', label: '上半屏', compactLabel: '上半', icon: 'fa-solid fa-up-long' },
          { id: 'bottom', label: '下半屏', compactLabel: '下半', icon: 'fa-solid fa-down-long' },
          { id: 'center', label: '居中布局', compactLabel: '居中', icon: 'fa-solid fa-bullseye' },
          { id: 'top_left', label: '左上角', compactLabel: '左上', icon: 'fa-solid fa-arrow-up-left-from-circle' },
          { id: 'top_right', label: '右上角', compactLabel: '右上', icon: 'fa-solid fa-arrow-up-right-from-circle' },
          { id: 'bottom_left', label: '左下角', compactLabel: '左下', icon: 'fa-solid fa-arrow-down-left-from-circle' },
          { id: 'bottom_right', label: '右下角', compactLabel: '右下', icon: 'fa-solid fa-arrow-down-right-from-circle' },
          { id: 'left_third', label: '左侧三分之一', compactLabel: '左1/3', icon: 'fa-solid fa-align-left' },
          { id: 'center_third', label: '中间三分之一', compactLabel: '中1/3', icon: 'fa-solid fa-align-center' },
          { id: 'right_third', label: '右侧三分之一', compactLabel: '右1/3', icon: 'fa-solid fa-align-right' },
        ];
      }

      return [
        { id: 'maximize', label: 'Fill Work Area', compactLabel: 'Fill', icon: 'fa-solid fa-expand' },
        { id: 'left', label: 'Left Half', compactLabel: 'Left', icon: 'fa-solid fa-table-columns' },
        { id: 'right', label: 'Right Half', compactLabel: 'Right', icon: 'fa-solid fa-table-columns fa-flip-horizontal' },
        { id: 'top', label: 'Top Half', compactLabel: 'Top', icon: 'fa-solid fa-up-long' },
        { id: 'bottom', label: 'Bottom Half', compactLabel: 'Bottom', icon: 'fa-solid fa-down-long' },
        { id: 'center', label: 'Center', compactLabel: 'Center', icon: 'fa-solid fa-bullseye' },
        { id: 'top_left', label: 'Top Left', compactLabel: 'Top L', icon: 'fa-solid fa-arrow-up-left-from-circle' },
        { id: 'top_right', label: 'Top Right', compactLabel: 'Top R', icon: 'fa-solid fa-arrow-up-right-from-circle' },
        { id: 'bottom_left', label: 'Bottom Left', compactLabel: 'Bot L', icon: 'fa-solid fa-arrow-down-left-from-circle' },
        { id: 'bottom_right', label: 'Bottom Right', compactLabel: 'Bot R', icon: 'fa-solid fa-arrow-down-right-from-circle' },
        { id: 'left_third', label: 'Left Third', compactLabel: 'Left 1/3', icon: 'fa-solid fa-align-left' },
        { id: 'center_third', label: 'Center Third', compactLabel: 'Mid 1/3', icon: 'fa-solid fa-align-center' },
        { id: 'right_third', label: 'Right Third', compactLabel: 'Right 1/3', icon: 'fa-solid fa-align-right' },
      ];
    },
    homeDesktopRecallLayoutPresets() {
      return Array.isArray(this.desktopControlSnapPresets)
        ? this.desktopControlSnapPresets
        : [];
    },
    desktopControlSceneViewport() {
      const monitorRects = (this.desktopControlMonitors || [])
        .map((monitorItem) => normalizeDesktopSceneRect(monitorItem?.bounds))
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const windowRects = (this.desktopControlWindows || [])
        .map((windowItem) => normalizeDesktopSceneRect(windowItem?.rect))
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const sourceRects = monitorRects.length > 0 ? monitorRects : windowRects;

      if (sourceRects.length === 0) {
        return { left: 0, top: 0, width: 1, height: 1, right: 1, bottom: 1 };
      }

      const left = Math.min(...sourceRects.map((rect) => rect.left));
      const top = Math.min(...sourceRects.map((rect) => rect.top));
      const right = Math.max(...sourceRects.map((rect) => rect.right));
      const bottom = Math.max(...sourceRects.map((rect) => rect.bottom));
      const width = Math.max(1, right - left);
      const height = Math.max(1, bottom - top);
      const paddingX = Math.max(120, width * 0.08);
      const paddingY = Math.max(90, height * 0.1);

      return {
        left: left - paddingX,
        top: top - paddingY,
        width: width + paddingX * 2,
        height: height + paddingY * 2,
        right: right + paddingX,
        bottom: bottom + paddingY,
      };
    },
    desktopControlSceneMonitors() {
      const viewport = this.desktopControlSceneViewport;
      const selectedMonitorIndex = this.selectedDesktopControlMonitor?.index;

      return (this.desktopControlMonitors || [])
        .map((monitorItem) => {
          const boundsRect = normalizeDesktopSceneRect(monitorItem?.bounds);
          const workAreaRect = normalizeDesktopSceneRect(monitorItem?.work_area || monitorItem?.bounds);
          if (boundsRect.width <= 0 || boundsRect.height <= 0) {
            return null;
          }

          return {
            ...monitorItem,
            raw: monitorItem,
            boundsRect,
            workAreaRect,
            isSelected: selectedMonitorIndex === monitorItem.index,
            style: buildDesktopSceneStyle(boundsRect, viewport),
            workAreaStyle: buildDesktopSceneInsetStyle(workAreaRect, boundsRect),
          };
        })
        .filter(Boolean);
    },
    desktopControlSceneWindows() {
      const viewport = this.desktopControlSceneViewport;
      const selectedHwnd = this.desktopControlSelectedHwnd;
      const activeHwnd = this.desktopControlActiveWindow?.hwnd;

      return (this.desktopControlWindows || [])
        .map((windowItem) => {
          const rect = normalizeDesktopSceneRect(windowItem?.rect);
          if (rect.width <= 0 || rect.height <= 0) {
            return null;
          }

          const fallbackTitle = windowItem?.process_name || windowItem?.class_name || `HWND ${windowItem?.hwnd || '--'}`;
          const title = String(windowItem?.title || fallbackTitle).trim() || fallbackTitle;
          const shortTitle = title.length > 32 ? `${title.slice(0, 31)}…` : title;
          const processLabel = String(windowItem?.process_name || windowItem?.class_name || `HWND ${windowItem?.hwnd || '--'}`).trim();
          const isSelected = selectedHwnd === windowItem.hwnd;
          const isActive = activeHwnd === windowItem.hwnd;
          const zIndex = isSelected ? 5 : (isActive ? 4 : (windowItem?.always_on_top ? 3 : 2));

          return {
            raw: windowItem,
            hwnd: windowItem.hwnd,
            shortTitle,
            processLabel,
            isSelected,
            isActive,
            isMinimized: Boolean(windowItem?.is_minimized),
            style: buildDesktopSceneStyle(rect, viewport, { zIndex: String(zIndex) }),
          };
        })
        .filter(Boolean)
        .sort((leftWindow, rightWindow) => {
          const leftScore = (leftWindow.isSelected ? 100 : 0) + (leftWindow.isActive ? 50 : 0) + (leftWindow.raw?.always_on_top ? 10 : 0);
          const rightScore = (rightWindow.isSelected ? 100 : 0) + (rightWindow.isActive ? 50 : 0) + (rightWindow.raw?.always_on_top ? 10 : 0);
          return rightScore - leftScore;
        });
    },
    desktopControlSceneSummary() {
      const isZh = String(this.currentLanguage || '').toLowerCase().startsWith('zh');
      const monitorCount = this.desktopControlSceneMonitors.length;
      const windowCount = this.desktopControlSceneWindows.length;
      return isZh
        ? `${monitorCount} 个显示器 · ${windowCount} 个窗口 · 单击选中 · 双击聚焦`
        : `${monitorCount} displays · ${windowCount} windows · Click to select · Double-click to focus`;
    },
    currentViewName() {
      return this.currentExtension ? this.currentExtension.name : this.t('defaultView');
    },
    /* 计算属性：默认模板 */
    defaultSidePanelHTML() {
      // 如果用户已给出自定义模板，就直接用
      if (this.sidePanelHTML) return this.sidePanelHTML;

      return `
        <div class="side-panel-default">
          <div class="side-panel-content markdown-body" v-data-mjx-disabled="true">
            ${this.formatMessage(this.sidePanelText)}
          </div>
        </div>`;
    },
    noInputFlag() {
      return !this.TTSrunning &&
             !this.ASRrunning &&
             !this.isInputting &&
             !this.isTyping &&
             !this.isOmniPlaying
    },
    // 计算处理百分比
    processingPercentage() {
      if (this.totalChunksCount === 0) return 0;
      return Math.round((this.audioChunksCount / this.totalChunksCount) * 100);
    },
    
    // 生成进度文本
    processingProgressText() {
      if (this.totalChunksCount === 0) return this.t('waiting');
      
      return `${this.audioChunksCount} / ${this.totalChunksCount} (${this.processingPercentage}%)`;
    },
    
    // 根据状态设置进度条颜色
    progressStatus() {
      if (this.isReadRunning || this.isConvertingAudio) {
        if (this.processingPercentage >= 90) return 'success';
        if (this.processingPercentage >= 50) return '';
        return 'exception';
      }
      return 'success';
    },

    allChecked: {
      get() {
        return this.textFiles.length > 0 && this.selectedFiles.length === this.textFiles.length;
      },
      set(val) {
        this.selectedFiles = val ? this.textFiles.map(f => f.unique_filename) : [];
      }
    },
    indeterminate() {
      return (
        this.selectedFiles.length > 0 &&
        this.selectedFiles.length < this.textFiles.length
      );
    },
    // 图片全选状态
    allImagesChecked: {
      get() {
        return this.imageFiles.length > 0 && 
              this.selectedImages.length === this.imageFiles.length
      },
      set(val) {
        this.selectedImages = val 
          ? this.imageFiles.map(i => i.unique_filename) 
          : []
      }
    },
    
    // 视频全选状态
    allVideosChecked: {
      get() {
        return this.videoFiles.length > 0 && 
              this.selectedVideos.length === this.videoFiles.length
      },
      set(val) {
        this.selectedVideos = val 
          ? this.videoFiles.map(v => v.unique_filename) 
          : []
      }
    },
    sidebarStyle() {
      if (this.isMobile) {
        return { width: this.sidebarVisible ? '200px' : '0' };
      }
      // 桌面态：紧凑 56px，扩展态 200px
      return { width: this.sidebarRailExpanded ? '200px' : '56px' };
    },
    filteredSeparators() {
      const current = this.qqBotConfig.separators;
      const defaults = this.defaultSeparators;
      const custom = current
        .filter(s => !defaults.some(d => d.value === s))
        .map(s => ({
          label: `(${this.formatSeparator(s)})`,
          value: s
        }));
      return [...this.defaultSeparators, ...custom];
    },
    filteredClaudeModelProviders() {
      let vendors = ["Anthropic", "Deepseek", "siliconflow", "ZhipuAI", "moonshot", "aliyun", "modelscope","302.AI","MiMo","newapi","Ollama"];
      // this.modelProviders中，vendor在vendors中的，添加到filteredClaudeModelProviders
      return this.modelProviders.filter((item) => vendors.includes(item.vendor));
    },

    /** Return whether QQ public metadata and its Main-owned secret are configured. */
    isQQBotConfigValid() {
        return Boolean(
          this.qqBotConfig.appid
          && this.isApplicationConnectorCredentialConfigured('qq', 'secret'),
        );
    },
    /** Return whether Feishu public metadata and its Main-owned secret are configured. */
    isfeishuBotConfigValid() {
      return Boolean(
        this.feishuBotConfig.appid
        && this.isApplicationConnectorCredentialConfigured('feishu', 'secret'),
      );
    },
    filteredFeishuSeparators() {
      const current = this.feishuBotConfig.separators;
      const defaults = this.defaultSeparators;
      const custom = current
        .filter(s => !defaults.some(d => d.value === s))
        .map(s => ({
          label: `(${this.formatSeparator(s)})`,
          value: s
        }));
      return [...this.defaultSeparators, ...custom];
    },
  /** Return whether Dingtalk public metadata and its Main-owned secret are configured. */
  isdingtalkBotConfigValid() {
    return Boolean(
      this.dingtalkBotConfig.appKey
      && this.isApplicationConnectorCredentialConfigured('dingtalk', 'appSecret'),
    );
  },
  
  // 处理分隔符列表展示
  filteredDingtalkSeparators() {
    const current = this.dingtalkBotConfig.separators || [];
    const defaults = this.defaultSeparators || []; // 假设你有默认分隔符定义
    const custom = current
      .filter(s => !defaults.some(d => d.value === s))
      .map(s => ({
        label: `(${this.formatSeparator(s)})`,
        value: s
      }));
    return [...defaults, ...custom];
  },
    /** Return whether the Main-owned Telegram Bot token is configured. */
    isTelegramBotConfigValid() {
      return this.isApplicationTelegramCredentialConfigured();
    },
    filteredTelegramSeparators() {
      const current = this.telegramBotConfig.separators;
      const defaults = this.defaultSeparators;
      const custom = current
        .filter(s => !defaults.some(d => d.value === s))
        .map(s => ({
          label: `(${this.formatSeparator(s)})`,
          value: s
        }));
      return [...this.defaultSeparators, ...custom];
    },
    /** Return whether the Main-owned Discord bot token is configured. */
    isDiscordBotConfigValid() {
      return this.isApplicationConnectorCredentialConfigured('discord', 'token');
    },
    filteredDiscordSeparators() {
      const current = this.discordBotConfig.separators;
      const defaults = this.defaultSeparators;
      const custom = current
        .filter(s => !defaults.some(d => d.value === s))
        .map(s => ({
          label: `(${this.formatSeparator(s)})`,
          value: s
        }));
      return [...this.defaultSeparators, ...custom];
    },
    /** Return whether both Main-owned Slack Socket Mode tokens are configured. */
    isSlackBotConfigValid() {
      return this.isApplicationConnectorCredentialConfigured('slack', 'bot_token')
        && this.isApplicationConnectorCredentialConfigured('slack', 'app_token');
    },
    filteredSlackSeparators() {
      const current = this.slackBotConfig.separators;
      const defaults = this.defaultSeparators;
      const custom = current
        .filter(s => !defaults.some(d => d.value === s))
        .map(s => ({
          label: `(${this.formatSeparator(s)})`,
          value: s
        }));
      return [...this.defaultSeparators, ...custom];
    },
    // isWXBotConfigValid() {
    //     return this.WXBotConfig.nickNameList && this.WXBotConfig.nickNameList.length > 0;
    // },
    /** Return whether every enabled live platform has complete metadata and credentials. */
    isLiveConfigValid() {
      const config = this.liveConfig || {};
      const enabled = Boolean(
        config.bilibili_enabled || config.youtube_enabled || config.twitch_enabled,
      );
      if (!enabled) return false;
      if (config.bilibili_enabled) {
        if (config.bilibili_type === 'web') {
          if (!String(config.bilibili_room_id || '').trim()) return false;
        } else if (config.bilibili_type === 'open') {
          if (
            !String(config.bilibili_ACCESS_KEY_ID || '').trim()
            || !String(config.bilibili_APP_ID || '').trim()
            || !this.isApplicationLivePlatformCredentialConfigured('bilibili_ACCESS_KEY_SECRET')
            || !this.isApplicationLivePlatformCredentialConfigured('bilibili_ROOM_OWNER_AUTH_CODE')
          ) return false;
        } else {
          return false;
        }
      }
      if (
        config.youtube_enabled
        && (
          !String(config.youtube_video_id || '').trim()
          || !this.isApplicationLivePlatformCredentialConfigured('youtube_api_key')
        )
      ) return false;
      if (
        config.twitch_enabled
        && (
          !String(config.twitch_channel || '').trim()
          || !this.isApplicationLivePlatformCredentialConfigured('twitch_access_token')
        )
      ) return false;
      return true;
    },
    updateButtonText() {
      if (this.updateDownloaded) return this.t('installNow');
      if (this.downloadProgress > 0) return this.t('downloading');
      return this.t('updateAvailable');
    },
    isSignedIn() {
      return ['signed_in_basic', 'signed_in_premium'].includes(this.authState?.status);
    },
    hasPremiumSubscription() {
      return Boolean(
        this.authState?.status === 'signed_in_premium'
        || this.authState?.premiumModelAccess
        || String(this.authState?.activePlanCode || '').trim()
      );
    },
    canUseEnterprise() {
      return Boolean(this.isSignedIn && this.authState?.enterpriseAccess);
    },
    canUseCustomProvider() {
      return this.isSignedIn;
    },
    canOpenPremiumCatalog() {
      return this.isSignedIn;
    },
    authDisplayName() {
      const rawName = String(this.authState?.profile?.name || '').trim();
      if (rawName) return rawName;
      return this.isCurrentLanguageZh() ? '未登录' : 'Guest';
    },
    authDisplayInitial() {
      const seed = this.authDisplayName;
      return String(seed).trim().slice(0, 1).toUpperCase() || 'G';
    },
    accessQuotaRingPercent() {
      if (typeof this.getAccessRemainingPercent !== 'function') {
        return 0;
      }
      return this.getAccessRemainingPercent(this.authState?.gatewayUsage);
    },
    accountTierLabel() {
      if (this.hasPremiumSubscription) {
        return this.authState?.activePlanName
          || (this.isCurrentLanguageZh() ? '高级模型已开通' : 'Premium Active');
      }
      if (this.authState?.subscriptionStatus === 'pending_payment') {
        return this.isCurrentLanguageZh() ? '待支付' : 'Pending Payment';
      }
      if (this.isSignedIn) {
        return this.isCurrentLanguageZh() ? '基础版' : 'Basic';
      }
      return this.isCurrentLanguageZh() ? '未登录' : 'Guest';
    },
    loginFeatureHighlights() {
      return this.isCurrentLanguageZh()
        ? ['购买更强大的模型使用', '自定义 OpenAI', '启用企业空间']
        : ['Buy stronger models', 'Custom OpenAI', 'Enable enterprise workspace'];
    },
    premiumBillingRules() {
      return this.isCurrentLanguageZh()
        ? [
            '登录后即可解锁自定义 OpenAI 与企业空间，订阅权益会与账户状态实时同步。',
            '所有套餐固定月付 30 天；续费仅在到期前 72 小时内开放，升级只允许低档升高档。',
            '日度额度优先消耗，随后扣减套餐赠送积分，最后扣减永久加油包积分。',
          ]
        : [
            'Signing in unlocks Custom OpenAI and Enterprise Workspace, and entitlements sync with the account in real time.',
            'All plans are monthly for 30 days; renewal opens only in the last 72 hours, and upgrades only move upward.',
            'Daily quota is consumed first, then bonus credits, then permanent top-up credits.',
          ];
    },
    enterprisePreviewCards() {
      return this.isCurrentLanguageZh()
        ? [
            {
              icon: 'fa-solid fa-building',
              title: '企业工作空间',
              description: '统一管理本地目录、SSH、Docker 与 VM 工作空间。',
            },
            {
              icon: 'fa-solid fa-cube',
              title: '企业沙盘',
              description: '在沙盘中浏览工作空间、项目楼层与智能员工。',
            },
            {
              icon: 'fa-solid fa-id-badge',
              title: '角色与知识',
              description: '协同维护角色卡、企业知识库与使用统计。',
            },
          ]
        : [
            {
              icon: 'fa-solid fa-building',
              title: 'Enterprise Workspaces',
              description: 'Manage local, SSH, Docker, and VM workspaces in one place.',
            },
            {
              icon: 'fa-solid fa-cube',
              title: 'Enterprise Sandbox',
              description: 'Browse workspaces, projects, and AI staff inside the sandbox.',
            },
            {
              icon: 'fa-solid fa-id-badge',
              title: 'Roles & Knowledge',
              description: 'Coordinate role cards, enterprise knowledge bases, and usage data.',
            },
          ];
    },
    allItems() {
      return [
        ...this.files.map(file => ({ ...file, type: 'file' })),
        ...this.images.map(image => ({ ...image, type: 'image' }))
      ];
    },
    sortedConversations() {
      return [...this.conversations].sort((a, b) => b.timestamp - a.timestamp);
    },
    filteredConversations() {
        const keyword = this.searchKeyword.toLowerCase()
        return [...this.conversations]
            .filter(conv => {
                // 匹配标题或消息内容
                const titleMatch = (conv.title || this.t('untitled')).toLowerCase().includes(keyword)
                const contentMatch = conv.messages?.some(msg => 
                    msg.content.toLowerCase().includes(keyword)
                )
                return titleMatch || contentMatch
            })
            .sort((a, b) => b.timestamp - a.timestamp)
    },
    iconClass() {
      return this.isMaximized ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
    },
    hasEnabledA2AServers() {
      return Object.values(this.a2aServers).some(server => server.enabled);
    },
    hasEnabledLLMTools() {
      return this.llmTools.some(tool => tool.enabled);
    },
    hasEnabledKnowledgeBases() {
      return this.knowledgeBases.some(kb => kb.enabled)
    },
    hasEnabledMCPServers() {
      // 检查this.mcpServers中的sever中是否有disable为false的
      return Object.values(this.mcpServers).some(server => !server.disabled);
    },
    hasEnabledHttpTools() {
      return this.customHttpTools.some(tool => tool.enabled);
    },
    hasEnabledComfyUI() {
      return this.workflows.some(tool => tool.enabled);
    },
    hasEnabledStickerPacks() {
      return this.stickerPacks.some(pack => pack.enabled);
    },
    hasFiles() {
      return this.files.length > 0
    },
    hasImages() {
      return this.images.length > 0
    },
    formValid() {
      return !!this.newLLMTool.name && !!this.newLLMTool.type
    },
    isEditingBehavior() {
      return this.currentBehaviorIndex !== -1;
    },
    defaultBaseURL() {
      switch(this.newLLMTool.type) {
        case 'openai': 
          return 'https://api.openai.com/v1'
        case 'ollama':
          return this.isdocker ? 
            'http://host.docker.internal:11434' : 
            'http://127.0.0.1:11434'
        default:
          return ''
      }
    },
    defaultApikey() {
      switch(this.newLLMTool.type) {
        case 'ollama':
          return 'ollama'
        default:
          return ''
      }
    },
    validProvider() {
      if (!this.newProviderTemp.vendor) return false
      if (this.newProviderTemp.vendor === 'custom') {
        return this.newProviderTemp.url.startsWith('http')
      }
      return true
    },
    vendorOptions() {
      const unlockHub = {
        label: this.isSignedIn
          ? (this.hasPremiumSubscription
              ? (this.isCurrentLanguageZh() ? '已开通' : 'Unlocked')
              : (this.isCurrentLanguageZh() ? '已解锁' : 'Unlocked'))
          : (this.isCurrentLanguageZh() ? '未解锁' : 'Locked'),
        meta: this.isSignedIn
          ? (this.hasPremiumSubscription
              ? (this.isCurrentLanguageZh() ? '管理高级模型权益与续费' : 'Manage premium models and renewals')
              : (this.isCurrentLanguageZh() ? '订阅 Claude Code、GPT 等高级模型' : 'Subscribe to Claude Code, GPT, and more'))
          : (this.isCurrentLanguageZh() ? '登录后解锁自定义 OpenAI、企业空间与高级模型目录' : 'Sign in to unlock Custom OpenAI, Enterprise Workspace, and premium models'),
        value: 'unlock-hub',
        isUnlockHub: true,
      };

      const visibleValues = this.vendorValues.filter((value) => value !== 'custom');
      if (this.canUseCustomProvider) {
        visibleValues.unshift('custom');
      }

      return [
        unlockHub,
        ...visibleValues.map(value => ({
          label: this.t(`vendor.${value}`),
          value,
          isUnlockHub: false,
        })),
      ];
    },
    MCPvendorOptions() {
      return this.MCPvendorValues.map(value => ({
        label: this.t(`MCPvendor.${value}`), // 使用统一的翻译键
        value
      }));
    },
    PromptOptions() {
      return this.promptValues.map(value => ({
        label: this.t(`prompt.${value}`), // 使用统一的翻译键
        value
      }));
    },
    CardOptions() {
      return this.cardValues.map(value => ({
        label: this.t(`card.${value}`), // 使用统一的翻译键
        value
      }));
    },
    themeOptions() {
      return this.themeValues.map(value => ({
        label: this.t(`theme.${value}`),
        value // 保持原始值（推荐）
      }));
    },
    hasAgentChanges() {
      return this.mainAgent !== 'openxnet-model' || 
        Object.values(this.agents).some(a => a.enabled)
    },
    // 获取所有唯一的语言
    uniqueLanguages() {
      const languages = [...new Set(this.edgettsvoices.map(voice => voice.language))];
      return languages.sort();
    },
    
    // 根据选择的语言获取可用的性别
    uniqueGenders() {
      const voicesForLanguage = this.edgettsvoices.filter(voice => 
        voice.language === this.edgettsLanguage
      );
      const genders = [...new Set(voicesForLanguage.map(voice => voice.gender))];
      return genders.sort();
    },
    
    // 根据选择的语言和性别过滤语音
    filteredVoices() {
      return this.edgettsvoices.filter(voice => 
        voice.language === this.edgettsLanguage && 
        voice.gender === this.edgettsGender
      );
    },
    uniqueNewLanguages() {
      const languages = [...new Set(this.edgettsvoices.map(voice => voice.language))];
      return languages.sort();
    },
    uniqueNewGenders() {
      const voicesForLanguage = this.edgettsvoices.filter(voice => 
        voice.language === this.newTTSConfig.edgettsLanguage
      );
      const genders = [...new Set(voicesForLanguage.map(voice => voice.gender))];
      return genders.sort();
    },
    filteredNewVoices() {
      return this.edgettsvoices.filter(voice => 
        voice.language === this.newTTSConfig.edgettsLanguage && 
        voice.gender === this.newTTSConfig.edgettsGender
      );
    },
    selectedVendor() {
      return this.modelProviders.find(
        p => p.id === this.settings.selectedProvider
      );
    },
    currentTab() {
        return this.browserTabs.find(t => t.id === this.currentTabId);
    },
    allItems() {
      // 1. 给文件列表添加 type 标识
      const filesWithType = (this.files || []).map(f => ({
        ...f,
        type: 'file'
      }));

      // 2. 给图片列表添加 type 标识
      const imagesWithType = (this.images || []).map(img => ({
        ...img,
        type: 'image'
      }));

      // 3. 合并：文件在前，图片在后（对应你的 removeItem 逻辑）
      return [...filesWithType, ...imagesWithType];
    },
    hasAttachments() {
      return this.allItems && this.allItems.length > 0;
    },
    // [v0.5.3] Enterprise KB category filter
    filteredEnterpriseKBs() {
      if (!this.enterpriseKBs) return [];
      if (!this.enterpriseKBActiveCategory || this.enterpriseKBActiveCategory === '全部') {
        return this.enterpriseKBs;
      }
      return this.enterpriseKBs.filter(kb => kb.category === this.enterpriseKBActiveCategory);
    },
    // 日志弹窗：按关键字过滤 logContent（不区分大小写、按行匹配）
    filteredLogContent() {
      const raw = String(this.logContent || '');
      const q = String(this.logFilterQuery || '').trim();
      if (!q) return raw;
      const needle = q.toLowerCase();
      return raw
        .split('\n')
        .filter(line => line.toLowerCase().includes(needle))
        .join('\n');
    },
  },
  methods: {
    ...vue_methods,
  },
directives: {
    morph: {
      mounted(el, binding, vnode) {
        const vm = binding.instance; 
        el._update = (content) => {
           const html = vm.formatMessage(content, -1);
           const wrapper = document.createElement('div');
           wrapper.innerHTML = html;
           morphdom(el, wrapper, { 
               childrenOnly: true,
               onBeforeElUpdated: (fromEl, toEl) => {
                   // 只保护 MathJax 自身的标签，不保护父元素
                   const tag = fromEl.tagName || '';
                   if (tag.startsWith('MJX-') || fromEl.classList.contains('MathJax')) return false;
                   if (fromEl.tagName === 'PRE' && fromEl.isEqualNode(toEl)) return false;
                   return true;
               }
           });
           // 流式输出期间不调用 MathJax，避免和 morphdom 打架
        };
        el._update(binding.value);
      },
      updated(el, binding) {
        if (binding.value !== binding.oldValue) {
           el._update(binding.value);
        }
      }
    }
},
  created() {
      if (typeof this.ensureBrowserState === 'function') {
          this.ensureBrowserState();
      }
      this.scrollInterval = null;
  },
});

// FontAwesome 图标映射
const NOTIFICATION_ICONS = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info'
};

let notificationTimeout;

function showNotification(message, type = 'success', title = '') {
    // 移除旧通知 (单例模式，避免右上角堆叠过多)
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
        clearTimeout(notificationTimeout);
    }

    const iconClass = NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.info;
    const duration = type === 'error' ? 5000 : 3000;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    notification.innerHTML = `
        <div class="notif-icon-box">
            <i class="${iconClass}"></i>
        </div>
        <div class="notif-content">
            ${title ? `<div class="notif-title">${title}</div>` : ''}
            <div class="notif-desc" style="${!title ? 'color: var(--el-text-color-primary);' : ''}">${message}</div>
        </div>
        <div class="notif-progress" style="transition-duration: ${duration}ms"></div>
    `;

    document.body.appendChild(notification);
    
    // 强制重绘
    void notification.offsetWidth;

    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 400); 
    }, duration);
}

// 兼容旧代码调用方式 (如果你的代码里只传了 message)
// showNotification("保存成功"); -> 默认为 success
// showNotification("保存失败", "error");
function removeNonAsciiTags(html) {
  // 匹配所有标签（包括开始标签和结束标签）
  // 例如：<旁白> 和 </旁白>
  const regex = /<\/?([^\s>]+)[^>]*>/g;
  
  return html.replace(regex, (match, tagName) => {
    // 检查标签名是否包含非 ASCII 字符
    const hasNonAscii = [...tagName].some(char => char.charCodeAt(0) > 127);
    
    // 如果标签名包含非 ASCII 字符，删除标签（但保留内容）
    if (hasNonAscii) {
      return '';
    }
    
    // 否则，保留标签
    return match;
  });
}

// 修改图标注册方式（完整示例）
app.use(ElementPlus);

// ==========================================
// ★ 修改点：注册 A2UI 组件
// ==========================================
app.component('a2-u-i-renderer', A2UIRendererComponent);

// 正确注册所有图标（一次性循环注册）
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 挂载应用
window.openxnetStartup?.mark('vue-mount-start');
const openxnetApp = app.mount('#app');
window.openxnetStartup?.mark('vue-mount-complete');
window.openxnetApp = openxnetApp;
void connectDesktopCoreState(openxnetApp);
connectTaskExecutionState(openxnetApp);
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    window.openxnetStartup?.mark('workspace-ready');
    markWorkspaceReady();
    window.setTimeout(() => {
      window.openxnetStartup?.releaseDeferredWork?.();
    }, 0);
  });
});
