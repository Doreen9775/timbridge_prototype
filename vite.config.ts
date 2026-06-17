import path from 'node:path'
import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: emulate the Vercel /api/parse-slip function during `npm run dev` (and the
// preview) so slips parse locally with the key kept server-side — never in the bundle.
// In production, Vercel serves api/parse-slip.ts instead.
function devParseSlipApi(apiKey: string | undefined): Plugin {
  return {
    name: 'dev-parse-slip-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api/parse-slip', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return send(405, { error: 'Method not allowed' })
        if (!apiKey) return send(500, { error: 'Local dev is missing ANTHROPIC_API_KEY in .env.local' })
        try {
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const { base64, mediaType, isPDF } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          // Load the shared server core through Vite's SSR pipeline (handles the TS).
          const core = await server.ssrLoadModule('/api/_core.ts')
          const items = await core.extractLineItems(base64, mediaType, isPDF, apiKey)
          send(200, { items })
        } catch (err) {
          send(502, { error: err instanceof Error ? err.message : 'Parsing failed.' })
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix loads non-VITE_ vars too (e.g. ANTHROPIC_API_KEY) for the dev API only.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), devParseSlipApi(env.ANTHROPIC_API_KEY)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
