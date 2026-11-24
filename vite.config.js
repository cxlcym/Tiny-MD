import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/highlight.js')) return 'vendor-hljs'
          if (id.includes('node_modules/katex')) return 'vendor-katex'
          if (id.includes('node_modules/@codemirror')) return 'vendor-codemirror'
          if (id.includes('node_modules/react')) return 'vendor-react'
        },
      },
    },
  },
})
