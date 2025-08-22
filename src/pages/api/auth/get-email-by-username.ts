import type { NextApiRequest, NextApiResponse } from 'next';

// This endpoint is intentionally disabled to prevent username->email leakage and account enumeration.
// Username-based sign-in has been removed. Clients must supply an email address directly.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return res.status(410).json({ error: 'This endpoint is no longer available. Please sign in with your email address.' });
}
