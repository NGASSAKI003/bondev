import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

/**
 * Message affiché (et renvoyé) quand la configuration locale est absente.
 * Aucune clé n'est écrite dans le code : les valeurs viennent de .env.local.
 */
export const supabaseConfigError =
  !url || !anonKey
    ? "La connexion à Supabase n'est pas configurée. Crée un fichier .env.local à partir de .env.example, puis renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY avec les valeurs de ton projet Supabase."
    : null

let client: SupabaseClient | null = null

/**
 * Crée le client à la première utilisation réelle. Cela permet d'afficher un
 * écran de configuration lisible au lieu d'une page blanche si .env.local
 * manque.
 */
export function getSupabase(): SupabaseClient {
  if (supabaseConfigError || !url || !anonKey) {
    throw new Error(
      supabaseConfigError ??
        "La connexion à Supabase n'est pas configurée.",
    )
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return client
}
