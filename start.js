// scripts/start.js
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function ensureUtf8Console() {
  process.env.PYTHONIOENCODING = process.env.PYTHONIOENCODING || 'utf-8';
  process.env.PYTHONUTF8 = process.env.PYTHONUTF8 || '1';
  process.env.LANG = process.env.LANG || 'zh_CN.UTF-8';

  if (process.platform !== 'win32' || process.env.OPENXNET_SKIP_UTF8_CONSOLE === '1') {
    return;
  }

  try {
    execFileSync('cmd.exe', ['/d', '/s', '/c', 'chcp 65001 >nul'], { stdio: 'ignore' });
  } catch (error) {
    // Keep startup non-blocking; UTF-8 env vars still protect child process text.
  }
}

ensureUtf8Console();

// 设置 NODE_ENV 为 development
process.env.NODE_ENV = 'development';
// 源码联调默认对接已部署的线上账户服务，避免桌面端与后台管理查看的不是同一套用户库。
process.env.OPENXNET_LOGIN_SERVICE_URL = process.env.OPENXNET_LOGIN_SERVICE_URL || 'https://synapxnet.work';
process.env.OPENXNET_LOGIN_API_PREFIX = process.env.OPENXNET_LOGIN_API_PREFIX || '/api';

const platform = process.platform;

// 解析 electron 可执行文件的绝对路径。优先使用 electron npm 包的官方导出
// （它直接返回 dist/electron.exe / dist/electron 的真实路径），
// 避免依赖 node_modules/.bin/electron.cmd 这类 shim —— 在某些 Windows
// 环境（chcp 切换、PATH 含特殊字符等）下 shim 会被误判为 "not recognized"。
let electronPath = null;
try {
  const resolved = require('electron');
  if (typeof resolved === 'string') {
    electronPath = resolved;
  }
} catch (error) {
  electronPath = null;
}

if (!electronPath || !fs.existsSync(electronPath)) {
  // Fallback：直接定位 dist 目录里的二进制文件
  const distBinary = path.join(
    __dirname,
    'node_modules',
    'electron',
    'dist',
    platform === 'win32' ? 'electron.exe' : 'electron'
  );
  if (fs.existsSync(distBinary)) {
    electronPath = distBinary;
  }
}

if (!electronPath) {
  console.error('[start.js] 未能解析 electron 可执行文件，请检查 node_modules/electron 是否完整。');
  console.error('[start.js] 可尝试运行: npm install electron --save-dev');
  process.exit(1);
}

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: process.env,
  cwd: __dirname,
});

child.on('exit', (code) => {
  process.exit(typeof code === 'number' ? code : 0);
});

child.on('error', (error) => {
  console.error('[start.js] 启动 electron 进程失败:', error);
  process.exit(1);
});
