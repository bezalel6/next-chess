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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { agent, message } = req.body;

  if (!agent || !message) {
    return res.status(400).json({ error: 'Missing agent or message' });
  }

  if (agent !== 'master' && agent !== 'sub') {
    return res.status(400).json({ error: 'Agent must be "master" or "sub"' });
  }

  try {
    // Read existing messages
    const filename = agent === 'master' ? 'master-messages.json' : 'sub-messages.json';
    const filepath = path.join(process.cwd(), 'public', filename);
    
    // Handle special __CLEAR__ message
    if (message === '__CLEAR__') {
      // Clear the messages file
      fs.writeFileSync(filepath, JSON.stringify([], null, 2));
      return res.status(200).json({ success: true, message: 'Messages cleared' });
    }
    
    let messages = [];
    try {
      const data = fs.readFileSync(filepath, 'utf8');
      messages = JSON.parse(data);
    } catch {
      // File doesn't exist or is invalid, start with empty array
      messages = [];
    }

    // Add new message
    messages.push({
      text: message,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 messages to prevent file from growing too large
    if (messages.length > 50) {
      messages = messages.slice(-50);
    }

    // Write back to file
    fs.writeFileSync(filepath, JSON.stringify(messages, null, 2));

    return res.status(200).json({ success: true, message: 'Message sent' });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}