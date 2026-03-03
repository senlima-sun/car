import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { writeFile } from 'fs/promises'

function saveLiveryPlugin(): Plugin {
  return {
    name: 'save-livery',
    configureServer(server) {
      server.middlewares.use('/api/save-livery', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        const chunks: Buffer[] = []
        req.on('data', (chunk: Buffer) => chunks.push(chunk))
        req.on('end', async () => {
          const buffer = Buffer.concat(chunks)
          const outPath = resolve(__dirname, 'public/textures/Livery_baseColor.png')
          await writeFile(outPath, buffer)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, size: buffer.length, path: outPath }))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), saveLiveryPlugin()],
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
