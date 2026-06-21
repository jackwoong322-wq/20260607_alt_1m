import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://two0260317-alt.onrender.com',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
})
