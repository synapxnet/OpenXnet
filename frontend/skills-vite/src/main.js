import { createApp } from 'vue';
import App from './App.vue';

function mountOpenXnetSkills() {
  const root = document.getElementById('openxnet-vite-skills-root');
  if (!root || root.dataset.viteMounted === 'true') {
    return;
  }

  createApp(App).mount(root);
  root.dataset.viteMounted = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOpenXnetSkills, { once: true });
} else {
  mountOpenXnetSkills();
}

window.addEventListener('openxnet-vite-skills-remount', mountOpenXnetSkills);
