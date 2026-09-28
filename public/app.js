const BUILD_ID = '2026.09.28.3';
const STORAGE_KEY = 'king-agent-histories-v3';
const SELECTED_KEY = 'king-agent';
const SIDEBAR_KEY = 'king-sidebar-collapsed';

const AGENTS = [
  ['orchestrator','الوكيل العام','يوجّه المهمة للوكيل الأنسب','✦'],
  ['planner','وكيل التخطيط','التخطيط والهندسة المعمارية','◇'],
  ['coding','مساعد البرمجة','كتابة وتحليل الأكواد','</>'],
  ['frontend','مساعد الواجهات','تصميم وتطوير الواجهات','UI'],
  ['backend','مساعد الباك إند','APIs والخدمات والتكاملات','API'],
  ['database','مساعد البيانات','قواعد البيانات والاستعلامات','DB'],
  ['security','مساعد الأمن','الأمن السيبراني والمراجعة','◈'],
  ['review','مساعد المراجعة','فحص الجودة والدقة','✓'],
  ['fix','مساعد الإصلاح','إصلاح الأخطاء والمشاكل','⌁'],
  ['token-saver','مساعد التوكن','تقليل الاستهلاك','◌']
];

const VALID_AGENT_IDS = new Set(AGENTS.map(([id]) => id));
const $ = id => document.getElementById(id);

function loadHistories() {
  for (const key of [STORAGE_KEY, 'king-agent-histories-v2']) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length) {
        if (key !== STORAGE_KEY) localStorage.removeItem(key);
        return parsed;
      }
    } catch {}
  }
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
    if (!VALID_AGENT_IDS.has(agentId) || !Array.isArray(messages)) continue;
    compact[agentId] = messages.slice(-20).map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').slice(0, 20000),
      ...(message.meta ? { meta: String(message.meta).slice(0, 500) } : {})
    }));
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
  } catch {
    try {
      const reduced = {};
      for (const [agentId, messages] of Object.entries(compact)) reduced[agentId] = messages.slice(-8);
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

function formatText(text) {
  return escapeHtml(text)
    .replace(/**(.+?)**/g, '<strong>$1</strong>')
    .replace(/\`([^\`\n]+)\`/g, '<code class="inlineCode">$1</code>')
    .replace(/\n/g, '<br>');
}

function formatAssistantContent(value = '') {
  const raw = String(value);
  const parts = raw.split(/\`\`\`/g);

  return parts.map((part, index) => {
    if (index % 2 === 0) return formatText(part);

    const lines = part.replace(/^\n/, '').split('\n');
    let language = '';
    if (lines.length > 1 && /^[a-z0-9_+#.-]{1,24}$/i.test(lines[0].trim())) {
      language = lines.shift().trim();
    }

    const code = escapeHtml(lines.join('\n').replace(/\n$/, ''));
    return `<div class="codeBlock">${language ? `<div class="codeHeader">${escapeHtml(language)}</div>` : ''}<pre><code>${code}</code></pre></div>`;
  }).join('');
}

function renderAgents() {
  $('agents').innerHTML = AGENTS.map(([id, name, desc, icon]) => `
    <button class="agent ${selected === id ? 'active' : ''}" data-id="${id}" type="button" title="${name}">
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
      closeMobileSidebar();
    });
  });
}

function renderHeader() {
  const agent = AGENTS.find(item => item[0] === selected) || AGENTS[0];
  $('agentTitle').textContent = agent[1];
  $('agentDesc').textContent = agent[2];
  $('activeAgentLabel').textContent = agent[1];
}

function emptyState() {
  return `
    <div class="hero">
      <div class="heroLogo" aria-hidden="true">K</div>
      <h1>كيف أقدر أساعدك اليوم؟</h1>
      <p>اختر وكيلاً متخصصًا أو اكتب طلبك مباشرة، وسيتولى King Agents توجيه المهمة وتنفيذها.</p>

      <div class="suggestions">
        <button type="button" data-agent="coding" data-prompt="ساعدني في حل مشكلة برمجية">
          <span class="suggestionIcon code">⌘</span>
          <span><b>مساعدة برمجية</b><small>كتابة، مراجعة أو إصلاح الكود</small></span>
          <i>↗</i>
        </button>

        <button type="button" data-agent="planner" data-prompt="خطط لي هذا المشروع خطوة بخطوة">
          <span class="suggestionIcon plan">◇</span>
          <span><b>تخطيط مشروع</b><small>حوّل الفكرة إلى خطوات تنفيذ واضحة</small></span>
          <i>↗</i>
        </button>

        <button type="button" data-agent="database" data-prompt="حلل لي هذه البيانات أو قاعدة البيانات">
          <span class="suggestionIcon data">▥</span>
          <span><b>تحليل بيانات</b><small>قواعد بيانات، استعلامات وتحليل</small></span>
          <i>↗</i>
        </button>

        <button type="button" data-agent="security" data-prompt="راجع هذا العمل أمنيًا وحدد المشاكل">
          <span class="suggestionIcon security">◈</span>
          <span><b>مراجعة أمنية</b><small>اكتشاف المخاطر واقتراح الإصلاحات</small></span>
          <i>↗</i>
        </button>
      </div>
    </div>
  `;
}

function attachMessageActions() {
  document.querySelectorAll('[data-copy-message]').forEach(button => {
    button.addEventListener('click', async () => {
      const index = Number(button.dataset.copyMessage);
      const message = currentMessages()[index];
      if (!message) return;

      try {
        await navigator.clipboard.writeText(message.content);
        button.textContent = 'تم النسخ';
        setTimeout(() => { button.textContent = 'نسخ'; }, 1200);
      } catch {
        button.textContent = 'تعذر النسخ';
        setTimeout(() => { button.textContent = 'نسخ'; }, 1200);
      }
    });
  });
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

  const rows = messages.map((message, index) => {
    const isAssistant = message.role === 'assistant';
    const body = isAssistant ? formatAssistantContent(message.content) : formatText(message.content);

    return `
      <article class="messageRow ${isAssistant ? 'assistant' : 'user'}">
        ${isAssistant ? '<div class="botAvatar">K</div>' : ''}
        <div class="messageContent">
          <div class="bubble">${body}</div>
          ${isAssistant ? `
            <div class="messageActions">
              <button type="button" data-copy-message="${index}">نسخ</button>
              ${message.meta ? `<span>${escapeHtml(message.meta)}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');

  const pending = pendingAgent === selected
    ? '<article class="messageRow assistant"><div class="botAvatar">K</div><div class="messageContent"><div class="bubble typing"><span></span><span></span><span></span></div></div></article>'
    : '';

  $('messages').innerHTML = rows + pending;
  attachMessageActions();
  $('messages').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function resizeInput() {
  const input = $('input');
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 180) + 'px';
}

function updateControls() {
  $('send').disabled = Boolean(pendingAgent) || !$('input').value.trim();
  $('newChat').disabled = pendingAgent === selected;
}

function closeMobileSidebar() {
  $('sidebar').classList.remove('open');
  $('sidebarBackdrop').classList.remove('show');
}

function openMobileSidebar() {
  $('sidebar').classList.add('open');
  $('sidebarBackdrop').classList.add('show');
}

function applySidebarState() {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
  $('app').classList.toggle('sidebarCollapsed', collapsed);
  $('sidebarToggle').querySelector('span').textContent = collapsed ? '›' : '‹';
  $('sidebarToggle').setAttribute('aria-label', collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية');
}

async function checkHealth() {
  const dot = $('providerDot');
  const label = $('providerText');

  dot.className = 'providerDot checking';
  label.textContent = 'جاري فحص OpenRouter';

  try {
    const response = await fetch('/api/health?b=' + encodeURIComponent(BUILD_ID), { cache: 'no-store' });
    const data = await response.json();

    if (!response.ok || !data.ok) throw new Error('health');

    if (data.openrouterConfigured) {
      dot.className = 'providerDot ready';
      label.textContent = data.build === BUILD_ID ? 'OpenRouter جاهز' : 'OpenRouter جاهز';
    } else {
      dot.className = 'providerDot warning';
      label.textContent = 'مفتاح OpenRouter غير مضاف';
    }
  } catch {
    dot.className = 'providerDot error';
    label.textContent = 'تعذر الاتصال بالخادم';
  }
}

async function send() {
  const text = $('input').value.trim();
  if (!text || pendingAgent) return;

  const agentId = selected;
  const nextMessages = [...currentMessages(agentId), { role: 'user', content: text }];
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
    try { data = await response.json(); } catch {}

    if (!response.ok) throw new Error(data.error || 'تعذر تنفيذ الطلب.');

    setMessages(agentId, [
      ...currentMessages(agentId),
      {
        role: 'assistant',
        content: data.reply,
        meta: [data.agentName, data.model].filter(Boolean).join(' · ')
      }
    ]);
  } catch (error) {
    setMessages(agentId, [
      ...currentMessages(agentId),
      {
        role: 'assistant',
        content: 'تعذر إكمال الطلب: ' + (error?.message || String(error))
      }
    ]);
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

$('menuToggle').addEventListener('click', openMobileSidebar);
$('sidebarBackdrop').addEventListener('click', closeMobileSidebar);

$('sidebarToggle').addEventListener('click', () => {
  const collapsed = !$('app').classList.contains('sidebarCollapsed');
  localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  applySidebarState();
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMobileSidebar();
});

renderAgents();
renderHeader();
renderMessages();
applySidebarState();
resizeInput();
updateControls();
checkHealth();
