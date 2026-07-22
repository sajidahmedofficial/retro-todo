export const config = {
  // AI backend is now hosted on the same origin via Vercel Serverless Functions
  AI_BACKEND_URL: window.location.origin,
  
  // Supabase Configuration
  // IMPORTANT: Replace these with your actual Supabase project credentials
  SUPABASE_URL: 'YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY'
};
