const AGENTS = [
  ['orchestrator','وكيل تنظيم العمل','يوجه المهمة للوكيل الأنسب بأقل تكلفة'],
  ['planner','وكيل التخطيط','يحوّل الهدف إلى خطة تنفيذ واضحة'],
  ['coding','وكيل البرمجة','تنفيذ الكود والإصلاحات العامة'],
  ['frontend','وكيل الفرونت','واجهات الويب وتجربة المستخدم'],
  ['backend','وكيل الباك إند','APIs والخدمات والتكاملات'],
  ['database','وكيل الداتابيس','تصميم البيانات والاستعلامات'],
  ['security','وكيل السايبر سكيورتي','مراجعة أمنية وإغلاق الثغرات'],
  ['review','وكيل المراجعة','فحص الجودة والدقة قبل الدمج'],
  ['fix','وكيل الإصلاح','إصلاح المشاكل بأقل تغيير'],
  ['token-saver','وكيل تقليص التوكن','تقليل السياق والطلبات غير الضرورية']
];

const $ = (id) => document.getElementById(id);
let selected = localStorage.getItem('king-agent') || 'orchestrator';
let messages = JSON.parse(localStorage.getItem('king-messages') || 'null') || [];
let loading = false;

function save() {
  localStorage.setItem('king-agent', selected);
  localStorage.setItem('king-messages', JSON.stringify(messages.slice(-50)));
}

function escapeHtml(value='') {
  return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function renderAgents() {
  $('agents').innerHTML = AGENTS.map(([id,name,desc]) => `
    <button class="agent ${selected===id?'active':''}" data-id="${id}" type="button">
      <span class="agentIcon">${id==='orchestrator'?'✦':'•'}</span>
      <span class="agentText">
        <span class="agentName">${name}</span>
        <small>${desc}</small>
      </span>
    </button>
  `).join('');

  document.querySelectorAll('.agent').forEach(btn => btn.addEventListener('click', () => {
    selected = btn.dataset.id;
    save();
    renderAgents();
    renderHeader();
    closeSidebarOnMobile();
  }));
}

function renderHeader() {
  const item = AGENTS.find(a => a[0] === selected) || AGENTS[0];
  $('agentTitle').textContent = item[1];
  $('agentDesc').textContent = item[2];
}

function renderEmptyState() {
  return `
    <div class="emptyState">
      <div class="emptyLogo">K</div>
      <h2>كيف أقدر أساعدك اليوم؟</h2>
      <p>اختر وكيلًا متخصصًا أو اترك وكيل تنظيم العمل يوجّه المهمة تلقائيًا.</p>
      <div class="suggestions">
        <button type="button" data-prompt="خطط لي هذا المشروع خطوة بخطوة">خطط مشروعًا</button>
        <button type="button" data-prompt="راجع الكود وحدد الأخطاء والمشاكل">راجع الكود</button>
        <button type="button" data-prompt="حلل المشكلة الأمنية واقترح إصلاحًا">فحص أمني</button>
        <button type="button" data-prompt="قلل استهلاك التوكن بدون التأثير على الدقة">قلل التوكن</button>
      </div>
    </div>
  `;
}

function renderMessages() {
  if (!messages.length && !loading) {
    $('messages').innerHTML = renderEmptyState();
    document.querySelectorAll('[data-prompt]').forEach(btn => btn.addEventListener('click', () => {
      $('input').value = btn.dataset.prompt;
      resizeInput();
      updateSend();
      $('input').focus();
    }));
    return;
  }

  $('messages').innerHTML = messages.map(m => `
    <article class="messageRow ${m.role}">
      <div class="avatar">${m.role==='user'?'أ':'K'}</div>
      <div class="messageBody">
        <div class="messageMeta">${m.role==='user'?'أنت':'King Agents'}</div>
        <div class="content">${escapeHtml(m.content)}</div>
        ${m.meta?`<div class="modelMeta">${escapeHtml(m.meta)}</div>`:''}
      </div>
    </article>
  `).join('') + (loading ? `
    <article class="messageRow assistant">
      <div class="avatar">K</div>
      <div class="messageBody">
        <div class="messageMeta">King Agents</div>
        <div class="typing"><span></span><span></span><span></span></div>
      </div>
    </article>
  ` : '');

  $('messages').lastElementChild?.scrollIntoView({behavior:'smooth',block:'end'});
}

function resizeInput() {
  const el = $('input');
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

function newConversation() {
  messages = [];
  save();
  renderMessages();
  $('input').value = '';
  resizeInput();
  updateSend();
  $('input').focus();
}

function closeSidebarOnMobile() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    $('sidebar').classList.remove('open');
  }
}

async function send() {
  const text = $('input').value.trim();
  if (!text || loading) return;

  messages.push({role:'user', content:text});
  $('input').value = '';
  resizeInput();
  loading = true;
  save();
  renderMessages();
  updateSend();

  try {
    const res = await fetch('/api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        agent:selected,
        messages:messages.map(({role,content})=>({role,content}))
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    messages.push({
      role:'assistant',
      content:data.reply,
      meta:`${data.agentName} · ${data.model}`
    });
  } catch (err) {
    messages.push({
      role:'assistant',
      content:`تعذر إكمال الطلب: ${err.message || String(err)}`
    });
  } finally {
    loading = false;
    save();
    renderMessages();
    updateSend();
  }
}

function updateSend() {
  $('send').disabled = loading || !$('input').value.trim();
}

$('composer').addEventListener('submit', e => {
  e.preventDefault();
  send();
});

$('input').addEventListener('input', () => {
  resizeInput();
  updateSend();
});

$('input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

$('newChat').addEventListener('click', newConversation);
$('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
$('agentSwitcher').addEventListener('click', () => {
  if (window.matchMedia('(max-width: 900px)').matches) $('sidebar').classList.add('open');
});

renderAgents();
renderHeader();
renderMessages();
resizeInput();
updateSend();
