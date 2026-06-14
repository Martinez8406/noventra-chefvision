import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

let loaded = false;

/** Loads .env.local for API handlers (Vercel serverless / vercel dev). Idempotent. */
export function loadEnv() {
  if (loaded) return;
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  config({ path: path.join(root, '.env.local') });
  loaded = true;
}

loadEnv();
