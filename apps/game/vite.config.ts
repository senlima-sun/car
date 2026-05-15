import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import wasm from 'vite-plugin-wasm'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    wasm(),
    tailwindcss(),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) return 'react'
            if (id.includes('@react-three/rapier') || id.includes('rapier3d-compat')) return 'rapier'
            if (id.includes('@react-three/drei') || id.includes('@react-three/fiber')) return 'drei'
            if (id.includes('/three/') || id.includes('three-stdlib')) return 'three'
          }
          return undefined
        },
      },
    },
  },
  server: {
    port: 7234,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 7235,
  },
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr', '**/*.exr'],
})
