import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/suggest': 'http://localhost:8001',
      '/leagues': 'http://localhost:8001',
      '/patches': 'http://localhost:8001',
      '/champions': 'http://localhost:8001',
      '/stats': 'http://localhost:8001',
      '/matchup':      'http://localhost:8001',
      '/analyze-comp': 'http://localhost:8001',
      '/draft-stats':  'http://localhost:8001',
    }
  }
})
