import { AGENTS, pickAgent, runOpenRouter } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const selected = AGENTS[body.agent] ? body.agent : 'orchestrator';
    const messages = Array.isArray(body.messages) ? body.messages
      .filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string')
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content.slice(0, 12000) })) : [];
    if (!messages.length) return res.status(400).json({ error: 'الرسالة مطلوبة' });
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const resolvedId = selected === 'orchestrator' ? pickAgent(lastUser) : selected;
    const agent = AGENTS[resolvedId] || AGENTS.coding;
    const result = await runOpenRouter(agent, messages);
    return res.status(200).json({ reply: result.content, model: result.model, agent: resolvedId, agentName: agent.name });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unexpected error' });
  }
}