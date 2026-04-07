<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1gVnKdlt_5Ld0EQO3jvk2MwqHxRFu_tHz

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create `.env.local` (copy from `.env.example`) and set at least:
   - `GEMINI_API_KEY`
   - `SUPABASE_URL` + `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
3. Supabase (recommended): auto-create `profiles` rows on signup.
   - Open Supabase SQL Editor and run `supabase/profiles.sql`.
4. Run the app:
   `npm run dev`
