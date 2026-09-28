import { BUILD_ID } from '../lib/agents.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = {
    ok: true,
    service: 'king-agents',
    build: BUILD_ID,
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY)
  };

  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).json(payload);
}
