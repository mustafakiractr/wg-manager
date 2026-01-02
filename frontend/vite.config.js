import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          process.env.NODE_ENV === 'production' && ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }],
        ].filter(Boolean),
      },
    }),
  ],

  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: [
      "localhost",
      "wg.mustafakirac.tr",
      "192.168.40.1",
      "127.0.0.1",
    ],

    // ✅ EKLE: /api isteklerini backend'e yönlendir
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        ws: true, // WebSocket desteğini etkinleştir
      },
    },
  },

  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react'],
          'vendor-utils': ['axios', 'date-fns'],
          'vendor-charts': ['chart.js', 'react-chartjs-2'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
})
