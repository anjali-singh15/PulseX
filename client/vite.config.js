import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY || 'http://localhost:5000';

  return {
    plugins: [react()],

    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            charts: ['recharts'],
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },

    server: {
      port: 5173,
      allowedHosts: ['.ngrok-free.dev'],

      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  };
});