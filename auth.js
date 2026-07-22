import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { config } from './config.js'

// Initialize Supabase Client
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY)

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  return { data, error }
}
