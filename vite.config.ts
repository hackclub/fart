import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': `http://localhost:${process.env.PORT ?? 3000}` },
  },
  worker: {
    format: 'es',
  },
})
