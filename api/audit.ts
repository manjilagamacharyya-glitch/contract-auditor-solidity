import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auditSolidity } from '../lib/audit.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON request body.' });
      }
    }

    const source = body?.source;
    if (!source || typeof source !== 'string' || source.trim().length === 0) {
      return res.status(400).json({ error: 'Solidity contract source code is required.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const result = await auditSolidity(source, apiKey);

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Audit error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred during the audit.',
    });
  }
}
