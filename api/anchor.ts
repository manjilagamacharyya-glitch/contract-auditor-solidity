import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storeAuditOnChain } from '../lib/chain.js';

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

    const { reportHash, contractHash, source, score } = body || {};

    if (!reportHash || !contractHash || source === undefined || score === undefined) {
      return res.status(400).json({
        error: 'Missing required parameters: reportHash, contractHash, source, score are all required.',
      });
    }

    const anchorResult = await storeAuditOnChain({
      reportHash,
      contractHash,
      source: String(source),
      score: Number(score),
    });

    return res.status(200).json(anchorResult);
  } catch (err: any) {
    console.error('Anchoring error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred while anchoring the audit.',
    });
  }
}
