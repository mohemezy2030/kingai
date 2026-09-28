import {
  AGENTS,
  AppError,
  resolveAgentId,
  runOpenRouter,
  sanitizeMessages
} from '../lib/agents.js';

export const config = {
  maxDuration: 60
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 500000) {
      throw new AppError('حجم الطلب أكبر من الحد المسموح.', 413, 'REQUEST_TOO_LARGE');
    }

    if (body.agent && !AGENTS[body.agent]) {
      throw new AppError('الوكيل المحدد غير صالح.', 400, 'INVALID_AGENT');
    }

    const selected = body.agent || 'orchestrator';
    const messages = sanitizeMessages(body.messages);
    const lastUser = [...messages].reverse().find(message => message.role === 'user');

    if (!lastUser) {
      throw new AppError('أرسل رسالة مستخدم صالحة أولًا.', 400, 'USER_MESSAGE_REQUIRED');
    }

    const resolvedId = resolveAgentId(selected, lastUser.content);
    const agent = AGENTS[resolvedId];
    const result = await runOpenRouter(agent, messages);

    return res.status(200).json({
      reply: result.content,
      model: result.model,
      agent: resolvedId,
      agentName: agent.name
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }

    return res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم.', code: 'INTERNAL_ERROR' });
  }
}
