Centralized Edge Function secrets

1) Create your local env file from the example
- Copy supabase/functions/.env.example to supabase/functions/.env
- Fill values:
  - AUTH_WEBHOOK_SECRET=... (same value you will put in the Auth webhook Authorization header: Bearer {{AUTH_WEBHOOK_SECRET}})
  - SUPABASE_URL=... (project URL)
  - SUPABASE_SERVICE_ROLE_KEY=... (service role key)

2) Serve functions locally using the canonical env
- npm run functions:serve
  This runs: supabase functions serve --env-file supabase/functions/.env

3) Push the same secrets to hosted Edge Functions
- npm run functions:secrets:push
  This runs: supabase functions secrets set --env-file supabase/functions/.env
- You can list currently set secrets with: npm run functions:secrets:list

Notes
- The edge code reads secrets using Deno.env.get('AUTH_WEBHOOK_SECRET'), etc.
- Do not commit supabase/functions/.env (already ignored).
- After changing hosted secrets, re-deploy or re-invoke the function to pick up changes.
