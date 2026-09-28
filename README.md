# King Agents

King Agents هو واجهة عربية متعددة الوكلاء تعمل عبر OpenRouter. لا توجد dependencies خارجية في الإصدار الحالي؛ يلزم Node.js 22+ ومفتاح OpenRouter.

## التشغيل المحلي

```bash
cp .env.example .env
# أضف OPENROUTER_API_KEY داخل .env
npm run check
npm start
```

ثم افتح:

```text
http://localhost:3000
```

## الوكلاء

- الوكيل العام / Orchestrator
- التخطيط
- البرمجة
- الواجهات
- الباك إند
- البيانات
- الأمن
- المراجعة
- الإصلاح
- تقليل التوكن

عند اختيار الوكيل العام يتم التوجيه بقواعد محلية خفيفة. إذا لم يوجد تخصص واضح يبقى الطلب عند الوكيل العام بدل إرساله عشوائيًا إلى وكيل البرمجة.

## OpenRouter

الإعداد الافتراضي:

```env
DEFAULT_FREE_MODELS=openrouter/free
```

لحماية المشروع من استخدام موديلات مدفوعة بالخطأ، يقبل الراوتر فقط `openrouter/free` أو معرفات موديلات تنتهي بـ `:free`.

## API

Health:

```text
GET /api/health
```

يعيد أيضًا رقم البناء وحالة وجود مفتاح OpenRouter.

Chat:

```text
POST /api/chat
```

مثال:

```json
{
  "agent": "orchestrator",
  "messages": [
    { "role": "user", "content": "راجع هذا الـ API" }
  ]
}
```

## Docker

```bash
docker build -t king-agents .
docker run --env-file .env -p 3000:3000 king-agents
```

## Vercel

اربط مشروع Vercel بالمستودع الصحيح:

```text
mohemezy2030/kingai
```

ثم أضف `OPENROUTER_API_KEY` داخل Environment Variables، وبعدها نفّذ Redeploy.

ملف `vercel.json` يضبط API Functions، يمنع تخزين الواجهة القديمة في cache، ويوجه الصفحة الرئيسية إلى `public/index.html` المنشورة على Vercel كـ `/index.html`.

## أمان

- لا ترفع `.env` أو مفاتيح API إلى GitHub.
- الطلبات محدودة الحجم.
- رسائل المحادثة محدودة العدد والطول.
- استدعاءات OpenRouter لها مهلة زمنية.
- الواجهة لا ترى مفتاح OpenRouter؛ المفتاح يبقى في الخادم.
