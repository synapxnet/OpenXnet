import { createApp } from 'vue';
import App from './App.vue';

/** Mount Ops only into roots whose owning legacy page is currently visible. */
function mountOpenXnetOps() {
  const roots = document.querySelectorAll('[data-openxnet-ops-surface]');
  roots.forEach((root) => {
    const page = root?.closest('.page');
    if (
      !root
      || root.dataset.viteMounted === 'true'
      || (page && window.getComputedStyle(page).display === 'none')
    ) {
      return;
    }
    const surface = String(root.dataset.openxnetOpsSurface || '').trim();
    createApp(App, { surface }).mount(root);
    root.dataset.viteMounted = 'true';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOpenXnetOps, { once: true });
} else {
  mountOpenXnetOps();
}

window.addEventListener('openxnet-vite-ops-remount', mountOpenXnetOps);
