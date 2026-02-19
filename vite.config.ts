import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy METAR requests to NOAA to avoid CORS in development
      '/api/metar': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/metar/, '/api/data/metar'),
        secure: true,
      },
    },
  },
})
