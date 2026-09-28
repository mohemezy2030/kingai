export const BUILD_ID = '2026.09.28.2';

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const AGENTS = {
  orchestrator: {
    name: 'الوكيل العام',
    system: 'أنت وكيل تنظيم العمل العام في King Agents. افهم الهدف، وجّه المهمة عند الحاجة، وقدّم نتيجة عملية مباشرة ودقيقة. لا تكرر التحليل وقلّل استهلاك التوكن.'
  },
  planner: {
    name: 'وكيل التخطيط',
    system: 'أنت مهندس تخطيط تقني. حوّل الطلب إلى خطوات قصيرة مرتبة مع الاعتماديات والمخاطر عند الحاجة فقط.'
  },
  coding: {
    name: 'مساعد البرمجة',
    system: 'أنت مهندس برمجيات خبير. قدّم كودًا صحيحًا وقابلًا للتشغيل بأقل تعقيد ممكن وحافظ على البنية الحالية.'
  },
  frontend: {
    name: 'مساعد الواجهات',
    system: 'أنت Frontend Engineer خبير في واجهات الويب وتجربة المستخدم. ركز على responsive وaccessibility والأداء.'
  },
  backend: {
    name: 'مساعد الباك إند',
    system: 'أنت Backend Engineer. صمم ونفذ APIs وخدمات موثوقة وآمنة مع validation واضح.'
  },
  database: {
    name: 'مساعد البيانات',
    system: 'أنت Database Engineer. صمم schemas وفهارس واستعلامات عملية مع مراعاة سلامة البيانات والأداء.'
  },
  security: {
    name: 'مساعد الأمن',
    system: 'أنت Security Engineer دفاعي. راجع الإدخال والأسرار والصلاحيات والاعتماديات واقترح إصلاحات آمنة.'
  },
  review: {
    name: 'مساعد المراجعة',
    system: 'أنت Senior Reviewer. ابحث عن أخطاء correctness وsecurity وregressions ورتبها حسب الشدة.'
  },
  fix: {
    name: 'مساعد الإصلاح',
    system: 'أنت Fix Agent. أصلح السبب الجذري بأصغر patch ممكن ولا تعيد كتابة أجزاء سليمة.'
  },
  'token-saver': {
    name: 'مساعد التوكن',
    system: 'أنت Token Saver Agent. قلّل السياق وعدد الطلبات وTool Calls مع الحفاظ على الدقة.'
  }
};

export function pickAgent(message = '') {
  const text = String(message).toLowerCase();
  const rules = [
    ['security', ['security', 'vulnerability', 'ثغرة', 'سكيورتي', 'أمن', 'xss', 'csrf']],
    ['database', ['sql', 'postgres', 'database', 'داتابيس', 'قاعدة بيانات', 'schema', 'supabase']],
    ['frontend', ['react', 'next', 'css', 'واجهة', 'frontend', 'فرونت', 'ui', 'ux']],
    ['backend', ['api', 'backend', 'باك', 'server', 'سيرفر', 'websocket', 'endpoint']],
    ['review', ['review', 'راجع', 'مراجعة', 'audit', 'تدقيق']],
    ['fix', ['fix', 'bug', 'error', 'اصلح', 'إصلاح', 'خطأ', 'مشكلة']],
    ['planner', ['plan', 'خطة', 'تخطيط', 'architecture', 'معمارية']],
    ['token-saver', ['token', 'توكن', 'compute', 'استهلاك']],
    ['coding', ['code', 'برمج', 'كود', 'python', 'typescript', 'javascript']]
  ];

  for (const [id, terms] of rules) {
    if (terms.some(term => text.includes(term))) return id;
  }

  return 'orchestrator';
}

export function resolveAgentId(selected, lastUserMessage = '') {
  const safeSelected = AGENTS[selected] ? selected : 'orchestrator';
  return safeSelected === 'orchestrator' ? pickAgent(lastUserMessage) : safeSelected;
}

export function sanitizeMessages(input) {
  if (!Array.isArray(input)) return [];

  return input
    .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .map(item => ({ role: item.role, content: item.content.trim().slice(0, 12000) }))
    .filter(item => item.content.length > 0)
    .slice(-12);
}

function getFreeModels() {
  const configured = (process.env.DEFAULT_FREE_MODELS || 'openrouter/free')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const freeOnly = configured.filter(model => model === 'openrouter/free' || model.endsWith(':free'));
  return [...new Set(freeOnly.length ? freeOnly : ['openrouter/free'])].slice(0, 6);
}

function getSiteUrl() {
  if (process.env.OPENROUTER_SITE_URL) return process.env.OPENROUTER_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_URL) return 'https://' + process.env.VERCEL_URL;
  return 'http://localhost:' + (process.env.PORT || 3000);
}

export async function runOpenRouter(agent, messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AppError('مفتاح OpenRouter غير مضبوط. أضف OPENROUTER_API_KEY في متغيرات البيئة.', 503, 'OPENROUTER_NOT_CONFIGURED');
  }

  const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const models = getFreeModels();
  const maxTokens = Math.max(128, Math.min(Number(process.env.MAX_TOKENS || 1600), 4000));

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(baseUrl + '/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'HTTP-Referer': getSiteUrl(),
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
        if (response.status === 401 || response.status === 403) {
          throw new AppError('مفتاح OpenRouter مرفوض أو لا يملك الصلاحية المطلوبة.', 503, 'OPENROUTER_AUTH');
        }

        if (response.status === 402) {
          throw new AppError('OpenRouter رفض الطلب بسبب إعدادات الرصيد أو المزوّد. استخدم الموديلات المجانية فقط.', 503, 'OPENROUTER_PAYMENT_REQUIRED');
        }

        if ([404, 408, 409, 425, 429, 500, 502, 503, 504].includes(response.status)) {
          continue;
        }

        throw new AppError('OpenRouter رفض الطلب برمز ' + response.status + '.', 502, 'OPENROUTER_REJECTED');
      }

      let data;
      try {
        data = await response.json();
      } catch {
        continue;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content || !String(content).trim()) continue;

      return {
        content: String(content),
        model: data.model || model
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.name === 'AbortError') continue;
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new AppError('تعذر الحصول على رد من موديلات OpenRouter المجانية الآن. حاول مرة أخرى لاحقًا.', 503, 'OPENROUTER_UNAVAILABLE');
}
