# Edge Functions Dependencies Guide

## Deno Standard Library Version

All Supabase Edge Functions should use a consistent version of the Deno standard library to avoid dependency resolution issues.

### Current Version
```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
```

### Common Import Error
If you encounter errors like:
```
Error: failed to create the graph
Import 'https://deno.land/std@0.168.0/http/server.ts' failed: error sending request for url
```

This typically means:
1. The Deno std version is outdated or incompatible
2. Network issues preventing dependency download
3. Version mismatch between functions

### Solution
Update all edge functions to use the same Deno std version:
```bash
# Update all edge function imports
sed -i 's/std@0.168.0/std@0.177.0/g' supabase/functions/*/index.ts
```

### Version History
- `std@0.168.0` - Original version (deprecated, causes resolution errors)
- `std@0.177.0` - Current stable version (recommended)
- `std@0.182.0` - Latest version (used in heartbeat function)

### Best Practices
1. **Consistency**: Keep all edge functions on the same Deno std version
2. **Testing**: Test locally with `supabase functions serve` before deployment
3. **Updates**: When updating, update all functions simultaneously
4. **Documentation**: Document any version changes in commit messages

### Other Common Dependencies

**Important**: Always use specific versions for external dependencies to avoid resolution errors.

```typescript
// Supabase client - MUST use specific version
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// NOT: import { createClient } from "https://esm.sh/@supabase/supabase-js@2"; // This will fail!

// Zod for validation
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Common Dependency Errors

**Error**: `Import 'https://esm.sh/@supabase/supabase-js@2' failed`
**Solution**: Use specific version `@supabase/supabase-js@2.39.3`

**Error**: `failed to create the graph`
**Cause**: Usually means a dependency URL is unreachable or malformed
**Solution**: 
1. Use specific versions for all dependencies
2. Ensure network access to esm.sh and deno.land
3. Check for typos in import URLs

### Deployment Checklist
- [ ] All functions use the same Deno std version
- [ ] Dependencies are accessible (not behind corporate firewall)
- [ ] Local testing passes with `supabase functions serve`
- [ ] No conflicting dependency versions