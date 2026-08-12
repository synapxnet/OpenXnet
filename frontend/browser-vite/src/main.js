import { createApp } from 'vue';
import App from './App.vue';

function mountOpenXnetBrowser() {
  const root = document.getElementById('openxnet-vite-browser-root');
  if (!root || root.dataset.viteMounted === 'true') {
    return;
  }

  createApp(App).mount(root);
  root.dataset.viteMounted = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOpenXnetBrowser, { once: true });
} else {
  mountOpenXnetBrowser();
}

window.addEventListener('openxnet-vite-browser-remount', mountOpenXnetBrowser);
