import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: parseInt(env.PORT || '3000', 10),
      fs: {
        allow: ['..'],
      },
    },
    preview: {
      port: 4173,
    },
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
      exclude: ['src/wasm/pkg'],
    },
  }
})
