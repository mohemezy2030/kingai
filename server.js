import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 3000);

const AGENTS = {
  orchestrator: { name: 'وكيل تنظيم العمل', system: 'أنت Orchestrator دقيق. حدّد التخصص الأنسب ثم قدّم نتيجة عملية مباشرة. لا تكرر التحليل وقلّل استهلاك التوكن.' },
  planner: { name: 'وكيل التخطيط', system: 'أنت مهندس تخطيط تقني. حوّل الطلب إلى خطوات قصيرة مرتبة مع الاعتماديات والمخاطر عند الحاجة فقط.' },
  coding: { name: 'وكيل البرمجة', system: 'أنت مهندس برمجيات خبير. قدّم كودًا صحيحًا وقابلًا للتشغيل بأقل تعقيد ممكن وحافظ على البنية الحالية.' },
  frontend: { name: 'وكيل الفرونت', system: 'أنت Frontend Engineer خبير في React وNext.js وTypeScript وواجهات الويب. ركز على responsive وaccessibility.' },
  backend: { name: 'وكيل الباك إند', system: 'أنت Backend Engineer. صمم ونفذ APIs وخدمات موثوقة وآمنة مع validation واضح.' },
  database: { name: 'وكيل الداتابيس', system: 'أنت Database Engineer. صمم schemas وفهارس واستعلامات عملية مع مراعاة سلامة البيانات والأداء.' },
  security: { name: 'وكيل السايبر سكيورتي', system: 'أنت Security Engineer دفاعي. راجع الإدخال والأسرار والصلاحيات والاعتماديات واقترح إصلاحات آمنة.' },
  review: { name: 'وكيل المراجعة', system: 'أنت Senior Reviewer. ابحث عن أخطاء correctness وsecurity وregressions ورتبها حسب الشدة.' },
  fix: { name: 'وكيل الإصلاح', system: 'أنت Fix Agent. أصلح السبب الجذري بأصغر patch ممكن ولا تعيد كتابة أجزاء سليمة.' },
  'token-saver': { name: 'وكيل تقليص التوكن', system: 'أنت Token Saver Agent. قلّل السياق وعدد الطلبات وTool Calls مع الحفاظ على الدقة.' }
};

function pickAgent(message = '') {
  const t = message.toLowerCase();
  const rules = [
    ['security', ['security','vulnerability','ثغرة','سكيورتي','xss','csrf']],
    ['database', ['sql','postgres','database','داتابيس','schema','supabase']],
    ['frontend', ['react','next','css','واجهة','frontend','فرونت','ui','ux']],
    ['backend', ['api','backend','باك','server','websocket','endpoint']],
    ['review', ['review','راجع','مراجعة','audit']],
    ['fix', ['fix','bug','error','اصلح','إصلاح','خطأ']],
    ['planner', ['plan','خطة','تخطيط','architecture','معمارية']],
    ['token-saver', ['token','توكن','compute','استهلاك']],
    ['coding', ['code','برمج','كود','python','typescript','javascript']]
  ];
  for (const [id, terms] of rules) if (terms.some((term) => t.includes(term))) return id;
  return 'coding';
}

function readEnvFallback() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
readEnvFallback();

async function runOpenRouter(agent, messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY غير مضبوط. أضفه في ملف .env');
  const base = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const models = (process.env.DEFAULT_FREE_MODELS || 'openrouter/free').split(',').map(v => v.trim()).filter(Boolean);
  const maxTokens = Math.max(128, Math.min(Number(process.env.MAX_TOKENS || 1600), 4000));
  let lastError = 'No model attempted';
  for (const model of models) {
    try {
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || `http://localhost:${PORT}`,
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'King Agents'
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: maxTokens,
          messages: [{ role: 'system', content: agent.system }, ...messages]
        })
      });
      if (!response.ok) {
        const body = await response.text();
        lastError = `${model}: ${response.status} ${body.slice(0, 220)}`;
        if ([408,429,502,503,504].includes(response.status)) continue;
        throw new Error(lastError);
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) { lastError = `${model}: empty response`; continue; }
      return { content: String(content), model: data.model || model };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`فشلت جميع الموديلات المجانية المضبوطة. ${lastError}`);
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function parseBody(req) {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 1_000_000) throw new Error('Request too large');
  }
  return data ? JSON.parse(data) : {};
}

function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const normalized = path.normalize(urlPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(publicDir, normalized);
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath);
  const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      return json(res, 200, { ok: true, service: 'king-agents', openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY) });
    }
    if (req.method === 'POST' && req.url === '/api/chat') {
      const body = await parseBody(req);
      const selected = AGENTS[body.agent] ? body.agent : 'orchestrator';
      const messages = Array.isArray(body.messages) ? body.messages
        .filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string')
        .slice(-12)
        .map(m => ({ role: m.role, content: m.content.slice(0, 12000) })) : [];
      if (!messages.length) return json(res, 400, { error: 'الرسالة مطلوبة' });
      const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || '';
      const resolvedId = selected === 'orchestrator' ? pickAgent(lastUser) : selected;
      const agent = AGENTS[resolvedId] || AGENTS.coding;
      const result = await runOpenRouter(agent, messages);
      return json(res, 200, { reply: result.content, model: result.model, agent: resolvedId, agentName: agent.name });
    }
    if (req.method === 'GET' && serveStatic(req, res)) return;
    json(res, 404, { error: 'Not found' });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : 'Unexpected error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`King Agents running on http://localhost:${PORT}`);
});
