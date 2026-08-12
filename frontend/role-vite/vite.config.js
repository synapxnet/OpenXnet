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
    outDir: path.resolve(__dirname, '../../static/role-vite'),
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      formats: ['es'],
      fileName: () => 'openxnet-role.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if ((assetInfo.name || '').endsWith('.css')) {
            return 'openxnet-role.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
