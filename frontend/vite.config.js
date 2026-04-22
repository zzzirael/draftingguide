import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/suggest': 'http://localhost:8000',
      '/leagues': 'http://localhost:8000',
      '/patches': 'http://localhost:8000',
      '/champions': 'http://localhost:8000',
      '/stats': 'http://localhost:8000',
    }
  }
})
