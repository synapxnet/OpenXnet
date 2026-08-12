import { createApp } from 'vue';
import App from './App.vue';

function mountOpenXnetRole() {
  const root = document.getElementById('openxnet-vite-role-root');
  if (!root || root.dataset.viteMounted === 'true') {
    return;
  }

  createApp(App).mount(root);
  root.dataset.viteMounted = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOpenXnetRole, { once: true });
} else {
  mountOpenXnetRole();
}

window.addEventListener('openxnet-vite-role-remount', mountOpenXnetRole);
