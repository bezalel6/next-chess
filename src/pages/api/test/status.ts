import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Status endpoint to check test auth configuration
 * Returns information about service role availability
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow when test auth is enabled
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return res.status(403).json({ error: 'Test auth disabled' });
  }

  return res.status(200).json({
    testAuthEnabled: true,
    serviceRoleAvailable: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not configured',
    timestamp: new Date().toISOString()
  });
}