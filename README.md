# King Agents

جاهز للتشغيل مباشرة بدون أي dependencies خارجية. يحتاج فقط Node.js 22+ ومفتاح OpenRouter.

## التشغيل

```bash
cp .env.example .env
# ضع OPENROUTER_API_KEY داخل .env
npm start
```

ثم افتح `http://localhost:3000`.

## الوكلاء

Orchestrator, Planner, Coding, Frontend, Backend, Database, Security, Review, Fix, Token Saver.

عند اختيار Orchestrator يتم توجيه المهمة تلقائيًا إلى الوكيل الأنسب بقواعد محلية خفيفة ثم يتم تنفيذ طلب LLM واحد فقط لتقليل استهلاك التوكن.

## OpenRouter

القيمة الافتراضية:

```env
DEFAULT_FREE_MODELS=openrouter/free
```

يمكن إضافة موديلات مجانية احتياطية مفصولة بفواصل دون تعديل الكود.

## Health

`GET /api/health`

## Chat

`POST /api/chat`

```json
{
  "agent": "orchestrator",
  "messages": [{"role":"user","content":"راجع هذا الـ API"}]
}
```

## Docker

```bash
docker build -t king-agents .
docker run --env-file .env -p 3000:3000 king-agents
```

لا ترفع `.env` أو مفاتيح API إلى GitHub.
