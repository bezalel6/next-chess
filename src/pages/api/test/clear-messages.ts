import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow in test mode
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return res.status(403).json({ error: 'Test mode not enabled' });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Clear both message files
    const masterPath = path.join(process.cwd(), 'public', 'master-messages.json');
    const subPath = path.join(process.cwd(), 'public', 'sub-messages.json');
    
    fs.writeFileSync(masterPath, JSON.stringify([], null, 2));
    fs.writeFileSync(subPath, JSON.stringify([], null, 2));
    
    return res.status(200).json({ success: true, message: 'All messages cleared' });
  } catch (error) {
    console.error('Error clearing messages:', error);
    return res.status(500).json({ error: 'Failed to clear messages' });
  }
}