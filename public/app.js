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
let messages = JSON.parse(localStorage.getItem('king-messages') || 'null') || [
  { role:'assistant', content:'King Agents جاهز. اختر الوكيل أو اترك Orchestrator يوجّه المهمة تلقائيًا.' }
];
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
    <button class="agent ${selected===id?'active':''}" data-id="${id}"><span>${name}</span><small>${desc}</small></button>
  `).join('');
  document.querySelectorAll('.agent').forEach(btn => btn.addEventListener('click', () => {
    selected = btn.dataset.id;
    save(); renderAgents(); renderHeader();
  }));
}

function renderHeader() {
  const item = AGENTS.find(a => a[0] === selected) || AGENTS[0];
  $('agentTitle').textContent = item[1];
  $('agentDesc').textContent = item[2];
}

function renderMessages() {
  $('messages').innerHTML = messages.map(m => `
    <article class="msg ${m.role}">
      <div class="role">${m.role==='user'?'أنت':'King Agents'}</div>
      <div class="content">${escapeHtml(m.content)}</div>
      ${m.meta?`<div class="meta">${escapeHtml(m.meta)}</div>`:''}
    </article>
  `).join('') + (loading ? '<article class="msg assistant"><div class="role">King Agents</div><div class="typing">جاري التنفيذ…</div></article>' : '');
  $('messages').lastElementChild?.scrollIntoView({behavior:'smooth',block:'end'});
}

async function send() {
  const text = $('input').value.trim();
  if (!text || loading) return;
  messages.push({role:'user', content:text});
  $('input').value = '';
  loading = true; save(); renderMessages(); updateSend();
  try {
    const res = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({agent:selected,messages:messages.map(({role,content})=>({role,content}))})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    messages.push({role:'assistant', content:data.reply, meta:`${data.agentName} · ${data.model}`});
  } catch (err) {
    messages.push({role:'assistant', content:`خطأ: ${err.message || String(err)}`});
  } finally {
    loading = false; save(); renderMessages(); updateSend();
  }
}

function updateSend() { $('send').disabled = loading || !$('input').value.trim(); }
$('composer').addEventListener('submit', e => {e.preventDefault(); send();});
$('input').addEventListener('input', updateSend);
$('input').addEventListener('keydown', e => { if (e.key==='Enter' && !e.shiftKey) {e.preventDefault(); send();} });
renderAgents(); renderHeader(); renderMessages(); updateSend();
