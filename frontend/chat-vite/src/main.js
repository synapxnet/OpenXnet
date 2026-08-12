import { createApp } from 'vue';
import App from './App.vue';

function mountOpenXnetChat() {
  const root = document.getElementById('openxnet-vite-chat-root');
  if (!root || root.dataset.viteMounted === 'true') {
    return;
  }

  createApp(App).mount(root);
  root.dataset.viteMounted = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountOpenXnetChat, { once: true });
} else {
  mountOpenXnetChat();
}

window.addEventListener('openxnet-vite-chat-remount', mountOpenXnetChat);
