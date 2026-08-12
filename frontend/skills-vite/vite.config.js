import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, '../../static/skills-vite'),
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      formats: ['es'],
      fileName: () => 'openxnet-skills.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if ((assetInfo.name || '').endsWith('.css')) {
            return 'openxnet-skills.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
