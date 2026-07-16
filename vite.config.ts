import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: false,
      hmr: process.env.DISABLE_HMR !== 'true' ? {
        clientPort: 5173
      } : false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: true as any,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    },
    build: {
      minify: false,
      cssMinify: false,
      emptyOutDir: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-ui': ['lucide-react'],
          },
        },
      },
    },
  };
});
