import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENTS,
  AppError,
  BUILD_ID,
  resolveAgentId,
  runOpenRouter,
  sanitizeMessages
} from './api/_shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 500000;

function readEnvFallback() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

readEnvFallback();

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function writeHeaders(res, extra = {}) {
  for (const [key, value] of Object.entries({ ...securityHeaders, ...extra })) {
    res.setHeader(key, value);
  }
}

function json(res, status, payload) {
  writeHeaders(res, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;

    if (total > MAX_BODY_BYTES) {
      throw new AppError('حجم الطلب أكبر من الحد المسموح.', 413, 'REQUEST_TOO_LARGE');
    }

    chunks.push(buffer);
  }

  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('صيغة JSON غير صالحة.', 400, 'INVALID_JSON');
  }
}

function serveStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = path.resolve(publicDir, relativePath);
  const publicRoot = path.resolve(publicDir) + path.sep;

  if (!filePath.startsWith(publicRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };

  writeHeaders(res, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-store, max-age=0' : 'no-cache'
  });

  res.statusCode = 200;

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    const pathname = requestUrl.pathname;

    if (['GET', 'HEAD'].includes(req.method) && pathname === '/api/health') {
      if (req.method === 'HEAD') {
        writeHeaders(res, { 'Cache-Control': 'no-store' });
        res.statusCode = 200;
        return res.end();
      }

      return json(res, 200, {
        ok: true,
        service: 'king-agents',
        build: BUILD_ID,
        openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY)
      });
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await parseBody(req);

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

      return json(res, 200, {
        reply: result.content,
        model: result.model,
        agent: resolvedId,
        agentName: agent.name
      });
    }

    if (['GET', 'HEAD'].includes(req.method) && serveStatic(req, res, pathname)) return;

    json(res, 404, { error: 'Not found', code: 'NOT_FOUND' });
  } catch (error) {
    if (error instanceof AppError) {
      return json(res, error.statusCode, { error: error.message, code: error.code });
    }

    json(res, 500, { error: 'حدث خطأ غير متوقع في الخادم.', code: 'INTERNAL_ERROR' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('King Agents ' + BUILD_ID + ' running on http://localhost:' + PORT);
});
