export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    service: 'king-agents',
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY)
  });
}