import { createApp } from 'vue';
import App from './App.vue';

function mountOpenXnetModel() {
  const root = document.getElementById('openxnet-vite-model-root');
  if (!root || root.dataset.viteMounted === 'true') {
    return;
  }

  createApp(App).mount(root);
  root.dataset.viteMounted = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOpenXnetModel, { once: true });
} else {
  mountOpenXnetModel();
}

window.addEventListener('openxnet-vite-model-remount', mountOpenXnetModel);
