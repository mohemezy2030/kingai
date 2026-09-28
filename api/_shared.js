export const AGENTS = {
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

export function pickAgent(message = '') {
  const t = message.toLowerCase();
  const rules = [
    ['security',['security','vulnerability','ثغرة','سكيورتي','xss','csrf']],
    ['database',['sql','postgres','database','داتابيس','schema','supabase']],
    ['frontend',['react','next','css','واجهة','frontend','فرونت','ui','ux']],
    ['backend',['api','backend','باك','server','websocket','endpoint']],
    ['review',['review','راجع','مراجعة','audit']],
    ['fix',['fix','bug','error','اصلح','إصلاح','خطأ']],
    ['planner',['plan','خطة','تخطيط','architecture','معمارية']],
    ['token-saver',['token','توكن','compute','استهلاك']],
    ['coding',['code','برمج','كود','python','typescript','javascript']]
  ];
  for (const [id, terms] of rules) if (terms.some(term => t.includes(term))) return id;
  return 'coding';
}

export async function runOpenRouter(agent, messages) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY غير مضبوط في Vercel Environment Variables');
  const base = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const models = (process.env.DEFAULT_FREE_MODELS || 'openrouter/free').split(',').map(v => v.trim()).filter(Boolean);
  const maxTokens = Math.max(128, Math.min(Number(process.env.MAX_TOKENS || 1600), 4000));
  let lastError = 'No model attempted';
  for (const model of models) {
    try {
      const response = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://vercel.app',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'King Agents'
        },
        body: JSON.stringify({
          model, temperature: 0.2, max_tokens: maxTokens,
          messages: [{ role: 'system', content: agent.system }, ...messages]
        })
      });
      if (!response.ok) {
        const body = await response.text();
        lastError = model + ': ' + response.status + ' ' + body.slice(0, 220);
        if ([408,429,502,503,504].includes(response.status)) continue;
        throw new Error(lastError);
      }
      const data = await response.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) { lastError = model + ': empty response'; continue; }
      return { content: String(content), model: data.model || model };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error('فشلت جميع الموديلات المجانية المضبوطة. ' + lastError);
}