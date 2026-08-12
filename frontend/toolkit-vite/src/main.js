import { createApp } from 'vue';
import App from './App.vue';

function mountOpenXnetToolkit() {
  const root = document.getElementById('openxnet-vite-toolkit-root');
  if (!root || root.dataset.viteMounted === 'true') {
    return;
  }

  createApp(App).mount(root);
  root.dataset.viteMounted = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOpenXnetToolkit, { once: true });
} else {
  mountOpenXnetToolkit();
}

window.addEventListener('openxnet-vite-toolkit-remount', mountOpenXnetToolkit);
