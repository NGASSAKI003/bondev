import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Ajoute un preconnect vers Supabase sans figer l'URL du projet dans le HTML.
 * L'URL vient de VITE_SUPABASE_URL (.env.local ou variables de déploiement).
 */
function supabasePreconnect(url: string): Plugin {
  return {
    name: 'bondev:supabase-preconnect',
    transformIndexHtml(html) {
      let tags = ''
      try {
        const origin = new URL(url).origin
        tags = [
          `<link rel="preconnect" href="${origin}" crossorigin />`,
          `<link rel="dns-prefetch" href="${origin}" />`,
        ].join('\n    ')
      } catch {
        // Pas d'URL configurée : le HTML reste valide sans preconnect.
      }
      return html.replace('<!-- VITE_SUPABASE_PRECONNECT -->', tags)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  return {
    plugins: [
      react(),
      tailwindcss(),
      supabasePreconnect(env.VITE_SUPABASE_URL ?? ''),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@supabase/')) return 'supabase'
            return undefined
          },
        },
      },
    },
  }
})
