import { createClient } from '@supabase/supabase-js'
import { requireEnv } from './env'

// service role: bypassa RLS a propósito (uso exclusivo server-side, nunca
// llega al bundle del cliente porque SUPABASE_SERVICE_ROLE_KEY no tiene
// prefijo VITE_)
export const supabaseAdmin = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { autoRefreshToken: false, persistSession: false },
})
