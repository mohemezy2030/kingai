const BUILD_ID = '2026.09.28.2';
const STORAGE_KEY = 'king-agent-histories-v2';
const SELECTED_KEY = 'king-agent';

const AGENTS = [
  ['orchestrator','الوكيل العام','OpenRouter Free Router','♛'],
  ['planner','وكيل التخطيط','التخطيط والهندسة المعمارية','✦'],
  ['coding','مساعد البرمجة','كتابة وتحليل الأكواد','</>'],
  ['frontend','مساعد الواجهات','تصميم وتطوير الواجهات','✎'],
  ['backend','مساعد الباك إند','APIs والخدمات والتكاملات','⚙'],
  ['database','مساعد البيانات','قواعد البيانات والاستعلامات','▥'],
  ['security','مساعد الأمن','الأمن السيبراني والمراجعة','◈'],
  ['review','مساعد المراجعة','فحص الجودة والدقة','✓'],
  ['fix','مساعد الإصلاح','إصلاح الأخطاء والمشاكل','⌁'],
  ['token-saver','مساعد التوكن','تقليل الاستهلاك','◌']
];

const VALID_AGENT_IDS = new Set(AGENTS.map(([id]) => id));
const $ = id => document.getElementById(id);

function loadHistories() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {}

  try {
    const legacy = JSON.parse(localStorage.getItem('king-messages') || 'null');
    if (Array.isArray(legacy) && legacy.length) {
      localStorage.removeItem('king-messages');
      return { orchestrator: legacy };
    }
  } catch {}

  return {};
}

let selected = localStorage.getItem(SELECTED_KEY) || 'orchestrator';
if (!VALID_AGENT_IDS.has(selected)) selected = 'orchestrator';

let histories = loadHistories();
let pendingAgent = null;

function currentMessages(agentId = selected) {
  return Array.isArray(histories[agentId]) ? histories[agentId] : [];
}

function setMessages(agentId, messages) {
  histories[agentId] = messages.slice(-30);
}

function save() {
  localStorage.setItem(SELECTED_KEY, selected);

  const compact = {};
  for (const [agentId, messages] of Object.entries(histories)) {
    if (!Array.isArray(messages)) continue;
    compact[agentId] = messages.slice(-20).map(message => ({
      role: message.role,
      content: String(message.content || '').slice(0, 20000),
      ...(message.meta ? { meta: String(message.meta).slice(0, 500) } : {})
    }));
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  } catch {
    const reduced = {};
    for (const [agentId, messages] of Object.entries(compact)) {
      reduced[agentId] = messages.slice(-8);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced));
    } catch {}
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[char]));
}

function renderAgents() {
  $('agents').innerHTML = AGENTS.map(([id, name, desc, icon]) => `
    <button class="agent ${selected === id ? 'active' : ''}" data-id="${id}" type="button">
      <span class="agentIcon">${icon}</span>
      <span class="agentText">
        <b>${name}</b>
        <small>${desc}</small>
      </span>
    </button>
  `).join('');

  document.querySelectorAll('.agent').forEach(button => {
    button.addEventListener('click', () => {
      selected = button.dataset.id;
      save();
      renderAgents();
      renderHeader();
      renderMessages();
      updateControls();

      if (window.innerWidth < 900) $('sidebar').classList.remove('open');
    });
  });
}

function renderHeader() {
  const agent = AGENTS.find(item => item[0] === selected) || AGENTS[0];
  $('agentTitle').textContent = agent[1];
  $('agentDesc').textContent = agent[2];
}

function emptyState() {
  return `
    <div class="hero">
      <div class="heroCrown">♛</div>
      <h1>كيف أقدر أساعدك اليوم؟</h1>
      <p>اختر وكيلاً متخصصًا أو اطرح سؤالك مباشرة. كل وكيل يحتفظ بسياق محادثته بشكل مستقل.</p>

      <div class="cards">
        <button type="button" data-agent="coding" data-prompt="ساعدني في حل مشكلة برمجية">
          <span class="ico cyan">&lt;/&gt;</span>
          <b>مساعدة برمجية</b>
          <small>كتابة أو مراجعة أو إصلاح الكود</small>
          <i>→</i>
        </button>

        <button type="button" data-agent="planner" data-prompt="خطط لي هذا المشروع خطوة بخطوة">
          <span class="ico purple">✦</span>
          <b>تخطيط مشروع</b>
          <small>خطة تنفيذ مرتبة وواضحة</small>
          <i>→</i>
        </button>

        <button type="button" data-agent="database" data-prompt="حلل لي هذه البيانات أو قاعدة البيانات">
          <span class="ico yellow">▥</span>
          <b>تحليل بيانات</b>
          <small>قواعد بيانات واستعلامات وتحليل</small>
          <i>→</i>
        </button>

        <button type="button" data-agent="security" data-prompt="راجع هذا العمل أمنيًا وحدد المشاكل">
          <span class="ico blue">◈</span>
          <b>مراجعة أمنية</b>
          <small>فحص المخاطر واقتراح الإصلاحات</small>
          <i>→</i>
        </button>
      </div>
    </div>
  `;
}

function renderMessages() {
  const messages = currentMessages();

  if (!messages.length && pendingAgent !== selected) {
    $('messages').innerHTML = emptyState();

    document.querySelectorAll('[data-prompt]').forEach(button => {
      button.addEventListener('click', () => {
        const targetAgent = button.dataset.agent;
        if (VALID_AGENT_IDS.has(targetAgent)) {
          selected = targetAgent;
          save();
          renderAgents();
          renderHeader();
        }

        $('input').value = button.dataset.prompt || '';
        resizeInput();
        updateControls();
        $('input').focus();
      });
    });

    return;
  }

  const rows = messages.map(message => `
    <article class="messageRow ${message.role}">
      ${message.role === 'assistant' ? '<div class="botAvatar">♛</div>' : ''}
      <div class="bubble">
        <div class="content">${escapeHtml(message.content)}</div>
        ${message.meta ? `<div class="modelMeta">${escapeHtml(message.meta)}</div>` : ''}
      </div>
    </article>
  `).join('');

  const pending = pendingAgent === selected
    ? '<article class="messageRow assistant"><div class="botAvatar">♛</div><div class="bubble typing">جاري التنفيذ<span>.</span><span>.</span><span>.</span></div></article>'
    : '';

  $('messages').innerHTML = rows + pending;
  $('messages').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function resizeInput() {
  const input = $('input');
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
}

function updateControls() {
  $('send').disabled = Boolean(pendingAgent) || !$('input').value.trim();
  $('newChat').disabled = pendingAgent === selected;
}

async function checkHealth() {
  const dot = $('providerDot');
  const text = $('providerText');

  dot.className = 'providerDot checking';
  text.textContent = 'جاري فحص OpenRouter';

  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok || !data.ok) throw new Error('health check failed');

    if (data.openrouterConfigured) {
      dot.className = 'providerDot ready';
      text.textContent = data.build === BUILD_ID ? 'OpenRouter جاهز' : 'OpenRouter جاهز · نسخة مختلفة';
    } else {
      dot.className = 'providerDot warning';
      text.textContent = 'أضف OPENROUTER_API_KEY';
    }
  } catch {
    dot.className = 'providerDot error';
    text.textContent = 'تعذر الاتصال بالخادم';
  }
}

async function send() {
  const text = $('input').value.trim();
  if (!text || pendingAgent) return;

  const agentId = selected;
  const before = currentMessages(agentId);
  const nextMessages = [...before, { role: 'user', content: text }];
  setMessages(agentId, nextMessages);

  $('input').value = '';
  resizeInput();

  pendingAgent = agentId;
  save();
  renderMessages();
  updateControls();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent: agentId,
        messages: nextMessages.map(({ role, content }) => ({ role, content }))
      })
    });

    let data = {};
    try {
      data = await response.json();
    } catch {}

    if (!response.ok) {
      throw new Error(data.error || 'تعذر تنفيذ الطلب.');
    }

    const updated = [
      ...currentMessages(agentId),
      {
        role: 'assistant',
        content: data.reply,
        meta: [data.agentName, data.model].filter(Boolean).join(' · ')
      }
    ];

    setMessages(agentId, updated);
  } catch (error) {
    const updated = [
      ...currentMessages(agentId),
      {
        role: 'assistant',
        content: 'تعذر إكمال الطلب: ' + (error?.message || String(error))
      }
    ];

    setMessages(agentId, updated);
  } finally {
    pendingAgent = null;
    save();

    if (selected === agentId) renderMessages();
    updateControls();
    checkHealth();
  }
}

$('composer').addEventListener('submit', event => {
  event.preventDefault();
  send();
});

$('input').addEventListener('input', () => {
  resizeInput();
  updateControls();
});

$('input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

$('newChat').addEventListener('click', () => {
  if (pendingAgent === selected) return;

  setMessages(selected, []);
  save();
  renderMessages();

  $('input').value = '';
  resizeInput();
  updateControls();
  $('input').focus();
});

$('menuToggle').addEventListener('click', () => {
  $('sidebar').classList.toggle('open');
});

renderAgents();
renderHeader();
renderMessages();
resizeInput();
updateControls();
checkHealth();
