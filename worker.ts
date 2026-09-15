import { httpServerHandler } from 'cloudflare:node';
import { env } from 'cloudflare:workers';
import { app } from './server.js';

// Bridge Cloudflare Worker secrets to process.env so existing code works
app.use((req, res, next) => {
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.GEMINI_MODEL) process.env.GEMINI_MODEL = env.GEMINI_MODEL;
  if (env.GEMINI_FALLBACK_MODEL) process.env.GEMINI_FALLBACK_MODEL = env.GEMINI_FALLBACK_MODEL;
  if (env.SUPABASE_URL) process.env.SUPABASE_URL = env.SUPABASE_URL;
  if (env.SUPABASE_ANON_KEY) process.env.SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
  if (env.VITE_SUPABASE_URL) process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
  if (env.VITE_SUPABASE_ANON_KEY) process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
  next();
});

export default httpServerHandler({ port: 3000 });
