import {accessToken} from './supabase.js';
import { placesMarkup, setPlacesContext } from './places.js';
import {promoteLead,REFERENCE_NAME} from './crm-promotion.js';
import { config, login, restoreSession, signOut, user, rows, rest, add, edit, workspaceOwner, deleteLead, generateLeadMessage } from './supabase.js';
import { parseImport, isSameLead } from './importer.js';

const $=selector=>document.querySelector(selector);
const state={ready:false,me:null,view:'overview',loading:false,data:{contacts:[],conversations:[],messages:[],outcomes:[],leads:[],activities:[],botSettings:null},
  selectedChat:null,thread:[],modal:null,search:'',outcomeFilter:'all',importSelection:new Set(),busy:false,refreshAt:null,importReport:null,mobileMenu:false};
const labels={overview:'Visão geral',inbox:'Conversas',insights:'Inteligência IA',crm:'Pipeline CRM',prospects:'Prospecção',tasks:'Atividades',contacts:'Contatos'};
const subtitles={overview:'Seu negócio, em uma única visão.',inbox:'Conversas reais registradas pelo WhatsApp.',insights:'Oportunidades identificadas nas conversas.',crm:'Acompanhe cada oportunidade até o fechamento.',prospects:'Importe, revise e selecione seus leads.',tasks:'Organize os próximos passos da operação.',contacts:'Sua base de contatos do WhatsApp.'};
const STAGES=[['new','Novos'],['contacted','Em contato'],['interested','Interessados'],['proposal','Propostas'],['won','Fechados'],['lost','Perdidos']];
const OUTCOMES={pending:'Em análise',qualified:'Qualificado',interested:'Interessado',not_interested:'Sem interesse',no_response:'Sem resposta',follow_up:'Follow-up',meeting_booked:'Reunião marcada',proposal_sent:'Proposta enviada',won:'Fechado',lost:'Perdido',human_handoff:'Atendimento humano',other:'Outro'};
const OUTCOME_POSITIVE=['qualified','interested','follow_up','meeting_booked','proposal_sent','won'];
const TYPE_LABELS={note:'Nota',call:'Ligação',whatsapp:'WhatsApp',email:'E-mail',meeting:'Reunião',proposal:'Proposta',follow_up:'Follow-up',stage_change:'Mudança de etapa',task:'Tarefa',other:'Outro'};
const ICON={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  messages:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  spark:'<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3Z"/><path d="m19 18 .7 1.3L21 20l-1.3.7L19 22l-.7-1.3L17 20l1.3-.7L19 18Z"/>',
  kanban:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v11"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  link:'<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 1 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 1 0 7 7l1.7-1.7"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart:'<path d="M3 3v18h18M7 17l4-4 3 2 6-7"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  external:'<path d="M14 3h7v7M21 3l-9 9M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l0-8Z"/>'};
const icon=(name,size=18)=>`<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]||ICON.grid}</svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"":'&quot;',"'":'&#39;'}[ch]));
const fmt=(date,includeTime=false)=>date?(new Intl.DateTimeFormat('pt-BR',includeTime?{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}:{day:'2-digit',month:'short',year:'numeric'}).format(new Date(date))):'—';
const rel=date=>{if(!date)return 'Sem atividade';const t=new Date(date).getTime();if(!Number.isFinite(t))return '—';const delta=Date.now()-t;const m=Math.floor(delta/60000);return m<1?'Agora':m<60?`Há ${m} min`:m<1440?`Há ${Math.floor(m/60)} h`:fmt(date);};
const initials=name=>String(name||'C').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const truncate=(s,n=80)=>String(s||'').length>n?String(s).slice(0,n-1)+'…':String(s||'');
const contactById=id=>state.data.contacts.find(x=>x.id===id);
const leadsForContact=id=>state.data.leads.filter(l=>l.contact_id===id);
const leadsForConv=c=>c&&c.chat_type!=='group'?leadsForContact(c.contact_id):[];
const nameOfConv=c=>leadsForConv(c).length===1?leadsForConv(c)[0].business_name:
  contactById(c.contact_id)?.name || contactById(c.contact_id)?.phone || c.remote_jid?.split('@')[0] || 'Contato';
const lastMessage=id=>state.data.messages.find(m=>m.conversation_id===id);
const outcomeOf=id=>state.data.outcomes.find(x=>x.conversation_id===id);
const leadOf=id=>state.data.leads.find(x=>x.id===id);
const chosenLeads=()=>state.data.leads.filter(l=>l.selected_for_crm);
const stageName=s=>STAGES.find(x=>x[0]===s)?.[1]||s||'Novo';
const prettyOutcome=s=>OUTCOMES[s]||'Em análise';
const badge=(value,kind='neutral')=>`<span class="badge ${kind}">${esc(value)}</span>`;
const initialsAvatar=(name,extra='')=>`<span class="initial-avatar ${extra}">${esc(initials(name))}</span>`;
const empty=(title,copy,ico='search')=>`<div class="empty-state"><div class="empty-icon">${icon(ico,24)}</div><strong>${esc(title)}</strong><p>${esc(copy)}</p></div>`;
function toast(message,error=false){const root=$('#toast-root');if(!root)return;const el=document.createElement('div');el.className='toast'+(error?' error':'');el.textContent=String(message);root.append(el);setTimeout(()=>el.remove(),4800);}

function sidebar(){
  const btn=(id,i)=>`<button class="side-item ${state.view===id?'active':''}" data-nav="${id}">${icon(i,19)}<span>${labels[id]}</span>${id==='inbox'&&state.data.conversations.length?`<small>${state.data.conversations.length}</small>`:''}</button>`;
  return `<aside class="sidebar ${state.mobileMenu?'show':''}" aria-label="Navegação principal">
    <div class="brand"><div class="brand-mark">${icon('bolt',23)}</div><div class="brand-word"><strong>leadpilot<span class="brand-dot">.</span></strong><small>BY ORBYTA</small></div></div>
    <div class="workspace"><span class="workspace-avatar">O</span><div><strong>Orbyta Web & Development</strong><small>Workspace comercial</small></div>${icon('chevron',15)}</div>
    <div class="side-scroll"><div class="side-label">WORKSPACE</div>${btn('overview','grid')}${btn('inbox','messages')}${btn('insights','spark')}
    <div class="side-label top-spaced">OPERAÇÃO</div>${btn('crm','kanban')}${btn('prospects','search')}${btn('tasks','calendar')}${btn('contacts','users')}
    </div><div class="side-footer"><div class="connection"><span class="connection-dot"></span><div><strong>Dados sincronizados</strong><small>Supabase · WhatsApp</small></div></div>
    <button class="sidebar-profile" data-logout>${initialsAvatar(state.me?.email||'U')}<span class="profile-text"><strong>${esc((state.me?.email||'Usuário').split('@')[0])}</strong><small>Encerrar sessão</small></span>${icon('logout',17)}</button></div>
  </aside>`;
}
function shell(page){
  const settings=state.data.botSettings;
  const botButton=settings?`<button type="button" class="btn ${settings.enabled?'danger-outline':'primary'} small" data-toggle-bot ${state.busy?'disabled':''} title="Pausar ou reativar todas as respostas do bot">${icon('shield',15)} ${settings.enabled?'Pausar bot':'Reativar bot'}</button>`:`<span class="bot-status-unknown" title="Controle remoto não carregado">Bot: estado indisponível</span>`;
  const action=state.view==='crm'?`<button type="button" class="btn primary" data-open-lead>${icon('plus',17)} Novo lead</button>`:
    state.view==='tasks'?`<button class="btn primary" data-open-task>${icon('plus',17)} Nova atividade</button>`:
    state.view==='prospects'?`<button type="button" class="btn primary" data-open-lead data-destination="prospects">${icon('plus',17)} Criar lead manual</button><button class="btn primary" data-file-trigger>${icon('upload',17)} Importar JSON</button>`:'';
  return `<div class="layout">${sidebar()}<main class="main">
    <header class="topbar"><div class="left-top"><button class="menu-button" data-menu aria-label="Abrir menu">${icon('menu',22)}</button><span class="breadcrumb">WORKSPACE</span><span class="crumb-sep">/</span><span class="breadcrumb-current">${labels[state.view]}</span></div><div class="top-actions">${botButton}<span class="updated">${state.refreshAt?'Atualizado '+rel(state.refreshAt):'Conectando…'}</span><button class="icon-button" title="Atualizar dados" data-refresh ${state.loading?'disabled':''}>${icon('refresh',18)}</button><span class="top-avatar">${esc(initials(state.me?.email))}</span></div></header>
    <div class="content"><div class="page-heading"><div><div class="heading-eyebrow"><span class="tiny-indicator"></span> LEADPILOT / ${esc(labels[state.view].toUpperCase())}</div><h1>${labels[state.view]}</h1><p>${subtitles[state.view]}</p></div><div class="heading-actions">${action}</div></div>
    ${state.loading&&!state.refreshAt?`<div class="loading-area"><div class="spinner"></div><span>Buscando informações do Supabase…</span></div>`:page}
    <footer class="main-footer"><span>© 2026 Orbyta Web & Development · LeadPilot</span><span>Seu workspace comercial, conectado com segurança.</span></footer></div>
  </main>${state.mobileMenu?'<button class="mobile-overlay" data-menu aria-label="Fechar menu"></button>':''}</div>${modalHtml()}`;
}
function loginHtml(){return `<div class="auth-page"><div class="auth-glow"></div><div class="auth-panel"><div class="auth-brand"><div class="brand-mark">${icon('bolt',27)}</div><span>leadpilot<strong>.</strong></span></div><div class="auth-status"><span class="connection-dot"></span> WORKSPACE ORBYTA</div><h1>Boas-vindas<br><em>de volta.</em></h1><p>Entre para acompanhar suas oportunidades, conversas e resultados comerciais em um só lugar.</p><form id="login-form" class="auth-form"><label>E-MAIL<input name="email" type="email" placeholder="seu@email.com" autocomplete="username" required></label><label>SENHA<input name="password" type="password" placeholder="Sua senha" autocomplete="current-password" required></label><button class="btn primary auth-submit" type="submit" ${state.busy?'disabled':''}>${state.busy?'Entrando…':'Entrar no workspace'} ${icon('arrow',17)}</button></form><div class="auth-security">${icon('shield',16)} Sessão protegida pelo Supabase Auth</div></div><div class="auth-aside"><div class="auth-orbit orbit-one"></div><div class="auth-orbit orbit-two"></div><div class="auth-aside-top">ORBYTA <span>／</span> TECHNOLOGY</div><div class="auth-showcase"><div class="showcase-pill">${icon('spark',15)} Inteligência comercial em tempo real</div><h2>Transforme conversas em <span>oportunidades.</span></h2><p>Centralize o relacionamento com clientes e enxergue o que importa para fechar mais negócios.</p><div class="showcase-metrics"><div><span>01</span><strong>Capture leads</strong></div><div><span>02</span><strong>Qualifique com IA</strong></div><div><span>03</span><strong>Acompanhe no CRM</strong></div></div></div><div class="auth-aside-bottom">Seu próximo cliente está a uma conversa de distância.</div></div></div>`;}

function overview(){
  const {conversations,contacts,messages,outcomes,activities}=state.data;
  const selected=chosenLeads(),positive=outcomes.filter(o=>OUTCOME_POSITIVE.includes(o.outcome));
  const pending=activities.filter(a=>a.status==='pending');
  const metrics=[
    {title:'Conversas ativas',value:conversations.length,desc:'Conversas registradas',icon:'messages',tone:'purple'},
    {title:'Contatos',value:contacts.length,desc:'Base do WhatsApp',icon:'users',tone:'blue'},
    {title:'Oportunidades IA',value:new Set(positive.map(o=>o.conversation_id)).size,desc:'Conversas com sinal positivo',icon:'spark',tone:'amber'},
    {title:'Leads no CRM',value:selected.length,desc:'Selecionados por você',icon:'kanban',tone:'mint'}
  ];
  const dates=Array.from({length:7},(_,i)=>{const dt=new Date();dt.setHours(0,0,0,0);dt.setDate(dt.getDate()-(6-i));return dt;});
  const counts=dates.map(d=>messages.filter(m=>m.direction==='incoming'&&new Date(m.created_at).toDateString()===d.toDateString()).length);
  const top=Math.max(1,...counts);
  const latest=conversations.slice(0,5);
  const interested=outcomes.filter(o=>OUTCOME_POSITIVE.includes(o.outcome)).slice(0,4);
  return `<div class="welcome-banner"><div><span class="hero-tag">${icon('spark',15)} SEU COPILOTO COMERCIAL</span><h2>Uma visão mais clara.<br><span>Decisões mais inteligentes.</span></h2><p>As conversas do WhatsApp chegam aqui automaticamente. Organize seu pipeline e não perca oportunidades.</p><button class="btn light" data-nav="inbox">Explorar conversas ${icon('arrow',16)}</button></div><div class="hero-visual" aria-hidden="true"><div class="hero-orb"></div><div class="hero-bubble one">${icon('messages',24)}</div><div class="hero-bubble two">${icon('chart',25)}</div><div class="hero-bubble three">✦</div></div></div>
  <div class="kpi-grid">${metrics.map(m=>`<article class="kpi-card"><div class="kpi-top"><span>${m.title}</span><span class="kpi-icon ${m.tone}">${icon(m.icon,20)}</span></div><strong>${m.value.toLocaleString('pt-BR')}</strong><div class="kpi-bottom"><span class="kpi-mini-dot ${m.tone}"></span> ${m.desc}</div></article>`).join('')}</div>
  <div class="dashboard-grid"><section class="panel trend-panel"><div class="panel-header"><div><div class="panel-kicker">ATIVIDADE</div><h3>Mensagens recebidas</h3><p>Últimos 7 dias · eventos armazenados</p></div><span class="panel-chip">7 dias ${icon('chevron',14)}</span></div>
    <div class="chart-wrap"><div class="chart-rows"><span>${top}</span><span>${Math.round(top/2)}</span><span>0</span></div><div class="bar-chart">${counts.map((v,i)=>`<div class="bar-item" title="${v} mensagens"><span class="bar-track"><span class="bar-fill ${i===6?'focus':''}" style="height:${v?Math.max(6,v/top*100):0}%"></span></span><small>${new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(dates[i]).replace('.','')}</small></div>`).join('')}</div></div><div class="chart-caption">${icon('messages',15)} ${messages.filter(m=>m.direction==='incoming').length} mensagens recebidas na amostra carregada</div></section>
    <section class="panel follow-panel"><div class="panel-header"><div><div class="panel-kicker">PRÓXIMAS AÇÕES</div><h3>Seu foco de hoje</h3><p>O que merece atenção</p></div><button class="link-button" data-nav="tasks">Ver tudo ${icon('arrow',15)}</button></div>
    ${pending.length?`<div class="todo-stack">${pending.slice(0,4).map(a=>`<div class="todo-row"><span class="todo-symbol">${icon('calendar',18)}</span><div><strong>${esc(truncate(a.title,50))}</strong><small>${esc(leadOf(a.lead_id)?.business_name||'Atividade')} · ${a.due_at?fmt(a.due_at):'Sem prazo'}</small></div><button class="check-button" title="Concluir atividade" data-done="${a.id}">${icon('check',15)}</button></div>`).join('')}</div>`:empty('Tudo em dia!','As atividades pendentes que você criar aparecerão aqui.','check')}
    <button class="btn subtle full" data-nav="tasks">Organizar atividades ${icon('arrow',16)}</button></section></div>
  <div class="dashboard-grid bottom"><section class="panel"><div class="panel-header"><div><div class="panel-kicker">ÚLTIMAS INTERAÇÕES</div><h3>Conversas recentes</h3></div><button class="link-button" data-nav="inbox">Ver conversas ${icon('arrow',15)}</button></div>
  ${latest.length?`<div class="recent-list">${latest.map(c=>`<button class="recent-row" data-chat="${c.id}">${initialsAvatar(nameOfConv(c))}<div class="recent-main"><strong>${esc(truncate(nameOfConv(c),38))}</strong><small>${esc(truncate(lastMessage(c.id)?.content||'Conversa iniciada',57))}</small></div><span>${rel(c.last_message_at||c.created_at)}</span></button>`).join('')}</div>`:empty('Nenhuma conversa ainda','Envie uma mensagem ao WhatsApp conectado para começar.','messages')}</section>
  <section class="panel"><div class="panel-header"><div><div class="panel-kicker">INTELIGÊNCIA</div><h3>Sinais de interesse</h3></div><button class="link-button" data-nav="insights">Explorar ${icon('arrow',15)}</button></div>
  ${interested.length?`<div class="signal-list">${interested.map(o=>`<div class="signal-row"><span class="signal-mark">${icon('spark',17)}</span><div><strong>${esc(prettyOutcome(o.outcome))}</strong><p>${esc(truncate(o.summary,110))}</p></div>${badge(o.extracted_by==='groq'?'Groq':'Regras','soft')}</div>`).join('')}</div>`:empty('Radar aguardando sinais','Interesses identificados nas conversas aparecerão aqui.','target')}</section></div>`;
}

function inbox(){
  const filtered=state.data.conversations.filter(c=>!state.search||[nameOfConv(c),c.remote_jid,lastMessage(c.id)?.content].some(x=>String(x||'').toLowerCase().includes(state.search.toLowerCase())));
  const selected=state.data.conversations.find(c=>c.id===state.selectedChat)||filtered[0];
  const messageItems=selected?.id===state.selectedChat?state.thread:[];
  const latest=selected?outcomeOf(selected.id):null;
  return `<section class="panel inbox-shell"><div class="chat-sidebar"><div class="chat-top"><div><h3>Caixa de entrada</h3><p>${filtered.length} conversas</p></div><span class="icon-well">${icon('messages',18)}</span></div><form class="search-box" data-search-form><span>${icon('search',17)}</span><input name="query" value="${esc(state.search)}" placeholder="Buscar contato ou mensagem" aria-label="Buscar conversa"><button type="submit" aria-label="Buscar">${icon('arrow',16)}</button></form><div class="conversation-list">${filtered.length?filtered.map(c=>`<button class="conversation-item ${selected?.id===c.id?'selected':''}" data-chat="${c.id}">${initialsAvatar(nameOfConv(c))}<span class="conversation-copy"><span class="conversation-first"><strong>${esc(truncate(nameOfConv(c),25))}</strong><time>${rel(c.last_message_at)}</time></span><span class="conversation-summary">${esc(truncate(lastMessage(c.id)?.content||'Sem prévia carregada',55))}</span><span class="conversation-flags">${c.chat_type==='group'?badge('Grupo'):c.mode==='human'?badge('Humano','soft'):badge('Bot','green')} ${leadsForConv(c).length?badge('Lead relacionado','green'):''} ${outcomeOf(c.id)?badge(prettyOutcome(outcomeOf(c.id).outcome),'soft'):''}</span></span></button>`).join(''):empty('Sem conversas','Quando chegarem mensagens, elas aparecerão aqui.','messages')}</div></div>
  <div class="chat-main">${selected?`<div class="chat-header">${initialsAvatar(nameOfConv(selected))}<div><strong>${esc(nameOfConv(selected))}</strong><span>${selected.chat_type==='group'?'Grupo':'WhatsApp'} · ${selected.mode==='human'?'Atendimento humano':'Bot registrado'}</span>${leadsForConv(selected).length?`<small class="linked-company">Empresa relacionada: ${esc(leadsForConv(selected).map(l=>l.business_name).join(', '))}</small>`:''}</div>${selected.chat_type!=='group'?`<button type="button" class="btn outline small" data-link-conversation="${selected.id}">${icon('link',14)} Vincular lead</button>`:''}${selected.chat_type!=='group'?`<button type="button" class="btn ${selected.mode==='human'?'primary':'danger-outline'} small" data-conversation-mode="${selected.id}" data-next-mode="${selected.mode==='human'?'bot':'human'}" ${state.busy?'disabled':''}>${icon('shield',14)} ${selected.mode==='human'?'Devolver ao bot':'Assumir atendimento'}</button>`:''}${/^[0-9]+@s\.whatsapp\.net$/.test(selected.remote_jid)?`<a class="btn outline small" href="https://wa.me/${selected.remote_jid.split('@')[0]}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp ${icon('external',14)}</a>`:''}</div>
  ${latest?`<div class="chat-intelligence">${icon('spark',16)}<div><strong>${esc(prettyOutcome(latest.outcome))}</strong><span>${esc(truncate(latest.summary,150))}</span></div><button class="link-button" data-nav="insights">Detalhes ${icon('arrow',14)}</button></div>`:''}
  <div class="chat-history"><div class="chat-date">HISTÓRICO REGISTRADO</div>${messageItems.length?messageItems.map(m=>`<div class="chat-message ${m.direction==='outgoing'?'outgoing':'incoming'}"><div class="message-bubble"><p>${esc(m.content||'[mensagem sem texto]')}</p><span>${m.sender_type==='bot'?'Bot · ':m.sender_type==='operator'?'Operador · ':''}${fmt(m.created_at,true)}</span></div></div>`).join(''):empty('Carregando conversa','Selecione uma conversa para ver as mensagens recentes.','messages')}</div>
  <div class="chat-disabled">${icon('shield',17)} Histórico somente leitura · Respostas enviadas pelo bot na Oracle Cloud</div>`:empty('Selecione uma conversa','Clique em um contato à esquerda para visualizar seu histórico.','messages')}</div></section>`;
}

function insights(){
  const all=state.data.outcomes;
  const filtered=all.filter(o=>state.outcomeFilter==='all'||(state.outcomeFilter==='positive'&&OUTCOME_POSITIVE.includes(o.outcome))||(state.outcomeFilter==='negative'&&['not_interested','lost'].includes(o.outcome))||(state.outcomeFilter==='handoff'&&o.outcome==='human_handoff'));
  const positive=new Set(all.filter(o=>OUTCOME_POSITIVE.includes(o.outcome)).map(o=>o.conversation_id));
  const negative=new Set(all.filter(o=>['not_interested','lost'].includes(o.outcome)).map(o=>o.conversation_id));
  return `<div class="insight-overview"><div class="insight-lead"><span class="eyebrow-purple">${icon('spark',16)} AI INTELLIGENCE</span><h2>Entenda cada conversa.<br><span>Antecipe a próxima ação.</span></h2><p>Acompanhe os resultados comerciais extraídos das mensagens recebidas. Classificações são sugestões, não vendas confirmadas.</p></div><div class="insight-stat"><span>Sinais positivos</span><strong>${positive.size}</strong><small>Conversas únicas</small></div><div class="insight-stat"><span>Sem interesse</span><strong>${negative.size}</strong><small>Conversas únicas</small></div></div>
  <section class="panel insights-panel"><div class="panel-header"><div><div class="panel-kicker">RESULTADOS REGISTRADOS</div><h3>Insights de conversas</h3><p>Últimas ${all.length} análises carregadas</p></div><div class="filter-tabs">${[['all','Todos'],['positive','Interesse'],['negative','Recusas'],['handoff','Humano']].map(([id,label])=>`<button class="filter-tab ${state.outcomeFilter===id?'active':''}" data-outcome-filter="${id}">${label}</button>`).join('')}</div></div>
  ${filtered.length?`<div class="insights-list">${filtered.slice(0,100).map(o=>{const c=state.data.conversations.find(x=>x.id===o.conversation_id);const name=c?nameOfConv(c):'Conversa';const positive=OUTCOME_POSITIVE.includes(o.outcome);return `<article class="insight-item"><div class="insight-icon ${positive?'positive':o.outcome==='not_interested'?'negative':''}">${icon(positive?'spark':'messages',20)}</div><div class="insight-content"><div class="insight-title"><strong>${esc(name)}</strong>${badge(prettyOutcome(o.outcome),positive?'green':o.outcome==='not_interested'?'red':'soft')}${badge(o.extracted_by==='groq'?'Groq':'Regras')}</div><p>${esc(o.summary||'Sem resumo')}</p>${o.next_action?`<div class="next-action">${icon('arrow',14)} <strong>Próxima ação:</strong> ${esc(o.next_action)}</div>`:''}${o.objections?`<div class="objection"><strong>Objeções:</strong> ${esc(o.objections)}</div>`:''}<div class="insight-meta">${icon('clock',13)} ${fmt(o.recorded_at,true)} ${Number.isFinite(Number(o.confidence))?' · Confiança estimada '+Math.round(Number(o.confidence)*100)+'%':''}</div></div>${c?`<button class="icon-button" data-chat="${c.id}" title="Abrir conversa">${icon('arrow',17)}</button>`:''}</article>`}).join('')}</div>`:empty('Nenhuma análise com este filtro','Novos resultados serão exibidos assim que as conversas forem classificadas.','spark')}</section>`;
}

/** Normaliza números do Brasil para WhatsApp. Nenhuma mensagem é enviada por esta função. */
function whatsappNumber(lead){
  const raw=String(lead?.whatsapp_phone||lead?.phone||'').trim();
  const digits=raw.replace(/\D/g,'');
  if(digits.length===10||digits.length===11)return '55'+digits;
  if(digits.startsWith('55')&&(digits.length===12||digits.length===13))return digits;
  return '';
}

let liveCrmDetails=new Map(),liveCrmOwner=null,liveCrmBusy=false,liveCrmEpoch=0;
async function loadCrmDetails(id){
 const uid=state.me?.id;if(!uid||state.view!=='crm'||liveCrmBusy)return;
 const lead=chosenLeads().find(l=>l.id===id&&l.google_place_id&&l.business_name===REFERENCE_NAME);
 if(!lead)return;
 liveCrmBusy=true;const epoch=liveCrmEpoch;
 try{const token=await accessToken();const response=await fetch('/api/places',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({placeId:lead.google_place_id}),cache:'no-store'});const data=await response.json();if(!response.ok||!data.place)throw Error(data.error||'Ficha indisponível.');if(epoch===liveCrmEpoch&&state.me?.id===uid&&state.view==='crm')liveCrmDetails.set(lead.google_place_id,data.place);}
 catch(e){if(epoch===liveCrmEpoch)toast(e.message||'Falha ao consultar ficha.',true);}
 finally{if(epoch===liveCrmEpoch){liveCrmBusy=false;if(state.view==='crm')render();}}
}
function crm(){
  const pipeline=chosenLeads().map(l=>{const p=liveCrmDetails.get(l.google_place_id);return l.business_name===REFERENCE_NAME?{...l,referenceOnly:true,...(p?{business_name:p.name||l.business_name,phone:p.phone||null,livePlace:p}:{})}:l;});
  return `<div class="lead-quick-actions"><button type="button" class="btn primary" data-open-lead>${icon('plus',17)} Criar lead manual</button><span>Cadastre um estabelecimento diretamente no CRM.</span></div><div class="crm-intro"><div class="crm-intro-copy">${icon('kanban',19)} <span>Arraste os cards entre as colunas ou abra o lead para editar a etapa.</span></div><span>${pipeline.length} leads selecionados</span></div>
    <div class="kanban-scroll"><div class="kanban-board">${STAGES.map(([stage,title],idx)=>{
      const items=pipeline.filter(l=>l.pipeline_stage===stage);
      return `<section class="kanban-column" data-drop-stage="${stage}"><div class="column-head"><span class="stage-marker stage-${idx}"></span><h3>${title}</h3><span class="column-count">${items.length}</span></div><div class="column-cards">${items.map(l=>`<article class="pipeline-card" draggable="true" data-drag-lead="${l.id}"><div class="pipeline-card-head"><div class="tiny-company">${esc(initials(l.business_name))}</div>${l.lead_score!==null?badge('Score '+l.lead_score,'soft'):''}</div><h4>${esc(truncate(l.business_name,36))}</h4>${l.referenceOnly?`<button type="button" class="btn outline small" data-live-place="${l.id}" ${liveCrmBusy?'disabled':''}>${l.livePlace?'Atualizar ficha':'Consultar ficha Google Maps'}</button>`:''}${l.google_place_id&&l.livePlace?`<small>Google Maps · ficha ao vivo</small><p>${esc(l.livePlace.phone||'Telefone não informado')}</p><p>${esc(l.livePlace.address||'Endereço não informado')}</p>${(l.livePlace.attributions||[]).map(a=>`<small>${esc(a.provider||'')}</small>`).join('')}${l.livePlace.maps?`<a href="https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(l.google_place_id)}" target="_blank" rel="noopener noreferrer">Abrir ficha</a>`:''}`:''}<p>${esc(l.category||'Empresa')} ${l.city?' · '+esc(l.city):''}</p>${l.contact_id?`<div class="lead-match-chip">${icon('link',13)} WhatsApp relacionado</div>`:''}<button type="button" class="btn outline small lead-draft-button" data-message-lead="${l.id}">${icon('spark',14)} Mensagem IA / WhatsApp</button><div class="pipeline-footer">${l.phone?`<span>${icon('messages',14)} WhatsApp / telefone</span>`:`<span>${icon('clock',14)} Sem telefone</span>`}<button type="button" data-edit-lead="${l.id}" class="tiny-action" title="Editar lead" aria-label="Editar ${esc(l.business_name)}">${icon('arrow',16)}</button><button type="button" data-delete-lead="${l.id}" class="tiny-action delete-lead-btn" title="Excluir lead" aria-label="Excluir ${esc(l.business_name)}">${icon('trash',16)}</button></div></article>`).join('')}${items.length?'':`<div class="kanban-empty">Arraste leads para esta etapa</div>`}</div></section>`;
    }).join('')}</div></div>${pipeline.length?'':`<div class="empty-cta">${empty('Seu CRM começa com um lead','Crie um lead manualmente ou selecione os que importou na aba Prospecção.','kanban')}<button class="btn primary" data-open-lead>${icon('plus',16)} Adicionar primeiro lead</button></div>`}`;
}
function prospects(){
  const candidates=state.data.leads.filter(l=>!l.selected_for_crm);
  const selected=candidates.filter(l=>state.importSelection.has(l.id));
  const existing=chosenLeads().length;
  return `<div class="lead-quick-actions"><button type="button" class="btn primary" data-open-lead data-destination="prospects">${icon('plus',17)} Criar lead manual</button><span>Salve novos estabelecimentos na prospecção antes de adicioná-los ao CRM.</span></div><div class="prospect-hero"><div><span class="eyebrow-purple">${icon('upload',16)} IMPORTADOR GOOGLE MAPS</span><h2>Encontre oportunidades.<br><span>Você decide quem entra.</span></h2><p>Importe arquivos JSON do Maps Lead Extractor. Os registros chegam à lista de prospecção <strong>sem seleção automática</strong> para o CRM.</p></div><form class="upload-surface" id="import-form"><div class="upload-symbol">${icon('upload',26)}</div><strong>Importar lista de leads</strong><span>Arquivo JSON · Até 1.500 registros</span><input type="file" name="file" id="json-file" accept=".json,application/json" required><button class="btn primary" type="submit" ${state.busy?'disabled':''}>${state.busy?'Importando…':'Importar para a lista'} ${icon('arrow',16)}</button></form></div>
    ${state.importReport?`<div class="import-report">${icon('check',17)} ${esc(state.importReport)}</div>`:''}
    <section class="panel prospects-panel"><div class="panel-header"><div><div class="panel-kicker">REVISÃO MANUAL</div><h3>Leads em prospecção <span class="pill-count">${candidates.length}</span></h3><p>${existing} leads no CRM · Revise antes de adicionar</p></div><div class="panel-actions"><button class="btn outline small" data-select-all ${!candidates.length?'disabled':''}>${state.importSelection.size===candidates.length&&candidates.length?'Desmarcar todos':'Selecionar todos'}</button><button class="btn primary small" data-promote ${!selected.length||state.busy?'disabled':''}>Adicionar ${selected.length} ao CRM ${icon('arrow',15)}</button><button type="button" class="btn danger-outline small" data-delete-selected ${!selected.length||state.busy?'disabled':''}>${icon('trash',15)} Excluir ${selected.length} selecionado(s)</button></div></div>
    ${candidates.length?`<div class="prospects-table-wrap"><table class="data-table"><thead><tr><th>SELEÇÃO</th><th>ESTABELECIMENTO</th><th>CONTATO</th><th>STATUS DO SITE</th><th>SCORE</th><th>ORIGEM</th><th>WHATSAPP</th><th>AÇÕES</th></tr></thead><tbody>${candidates.map(l=>`<tr><td><input aria-label="Selecionar ${esc(l.business_name)}" type="checkbox" data-prospect-check="${l.id}" ${state.importSelection.has(l.id)?'checked':''}></td><td><div class="table-identity"><div class="tiny-company">${esc(initials(l.business_name))}</div><div><strong>${esc(truncate(l.business_name,46))}</strong><small>${esc([l.category,l.city].filter(Boolean).join(' · ')||'Sem categoria')}</small></div></div></td><td>${esc(l.phone||'—')}</td><td>${badge(l.website_status==='absent'?'Sem site informado':l.website_status==='present'?'Site informado':'A verificar',l.website_status==='absent'?'amber':'soft')}</td><td>${l.lead_score??'—'}</td><td>${esc(l.source==='json_import'?'JSON importado':l.source||'Manual')}</td><td>${l.contact_id?badge('Relacionado','green'):badge('Sem vínculo','soft')}</td><td><button type="button" class="btn primary small" data-promote-one="${l.id}" ${state.busy?'disabled':''}>Enviar ao CRM</button> <button type="button" class="btn outline small" data-message-lead="${l.id}">${icon('spark',14)} Mensagem IA</button> <button type="button" data-delete-lead="${l.id}" title="Excluir lead" aria-label="Excluir ${esc(l.business_name)}" class="btn-delete-lead">${icon('trash',15)} Excluir</button></td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum lead aguardando revisão','Importe um JSON ou crie um lead manual para revisar os candidatos.','upload')}</section><div class="info-footnote">${icon('shield',16)} A ausência de site no arquivo não comprova que a empresa realmente não possui site. Confirme os dados antes de contatar.</div>`;
}
function tasks(){
  const items=state.data.activities;const pending=items.filter(a=>a.status==='pending');const completed=items.filter(a=>a.status==='completed');
  return `<div class="tasks-summary"><div class="mini-summary"><span class="mini-summary-icon purple">${icon('calendar',19)}</span><div><strong>${pending.length}</strong><span>Atividades pendentes</span></div></div><div class="mini-summary"><span class="mini-summary-icon green">${icon('check',19)}</span><div><strong>${completed.length}</strong><span>Concluídas</span></div></div><div class="mini-summary"><span class="mini-summary-icon amber">${icon('clock',19)}</span><div><strong>${pending.filter(a=>a.due_at&&new Date(a.due_at)<new Date()).length}</strong><span>Com prazo vencido</span></div></div></div>
    <section class="panel tasks-panel"><div class="panel-header"><div><div class="panel-kicker">AGENDA COMERCIAL</div><h3>Suas atividades</h3><p>Tarefas, follow-ups, reuniões e propostas</p></div><button class="btn outline small" data-open-task>${icon('plus',15)} Criar atividade</button></div>
    ${items.length?`<div class="task-list">${[...items].sort((a,b)=>(a.status==='pending'?-1:1)-(b.status==='pending'?-1:1)||new Date(a.due_at||a.created_at)-new Date(b.due_at||b.created_at)).map(a=>`<div class="task-item"><button class="task-check ${a.status==='completed'?'completed':''}" title="${a.status==='pending'?'Marcar concluída':'Atividade concluída'}" data-done="${a.id}" ${a.status==='completed'?'disabled':''}>${a.status==='completed'?icon('check',16):''}</button><div class="task-body"><div class="task-title ${a.status==='completed'?'crossed':''}">${esc(a.title)}</div><p>${esc(a.description||'Sem descrição')}</p><div class="task-tags">${badge(TYPE_LABELS[a.activity_type]||'Atividade','soft')}<span>${icon('users',13)} ${esc(leadOf(a.lead_id)?.business_name||'Lead não encontrado')}</span>${a.due_at?`<span class="${a.status==='pending'&&new Date(a.due_at)<new Date()?'overdue':''}">${icon('clock',13)} ${fmt(a.due_at,true)}</span>`:''}</div></div>${badge(a.status==='completed'?'Concluída':a.status==='canceled'?'Cancelada':'Pendente',a.status==='completed'?'green':'soft')}</div>`).join('')}</div>`:empty('Sua lista está vazia','Crie atividades relacionadas aos leads para acompanhar o que precisa ser feito.','calendar')}</section>`;
}
function contacts(){
  const list=state.data.contacts;
  return `<section class="panel"><div class="panel-header"><div><div class="panel-kicker">AGENDA DE CONTATOS</div><h3>Contatos do WhatsApp <span class="pill-count">${list.length}</span></h3><p>Cadastrados automaticamente após as mensagens chegarem à ponte</p></div>${badge('Sincronizado','green')}</div>
    ${list.length?`<div class="prospects-table-wrap"><table class="data-table"><thead><tr><th>CONTATO</th><th>TELEFONE</th><th>CADASTRADO EM</th><th>CANAL</th></tr></thead><tbody>${list.map(c=>`<tr><td><div class="table-identity">${initialsAvatar(c.name||c.phone||'C')}<div><strong>${esc(c.name||'Contato sem nome')}</strong><small>${esc(truncate(c.whatsapp_jid,44))}</small></div></div></td><td>${esc(c.phone||'—')}</td><td>${fmt(c.created_at)}</td><td>${badge('WhatsApp','green')} ${leadsForContact(c.id).length?badge('Lead: '+leadsForContact(c.id).map(l=>l.business_name).join(', '),'soft'):''}</td></tr>`).join('')}</tbody></table></div>`:empty('Nenhum contato registrado','Seus contatos do WhatsApp aparecerão automaticamente aqui.','users')}</section>`;
}
function modalHtml(){
  if(!state.modal)return '';

  if(state.modal.type==='ai-draft'){
    const lead=leadOf(state.modal.id);
    if(!lead)return '';
    const phone=whatsappNumber(lead);
    const message=state.modal.draft??lead.ai_message_draft??'';
    return `<div class="modal-shade" data-modal-dismiss><div role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal"><div class="modal-top"><div><span class="panel-kicker">ORBYTA · PROSPECÇÃO MANUAL</span><h2 id="modal-title">Mensagem para ${esc(lead.business_name)}</h2><p class="match-info">${phone?'Destino: +'+esc(phone):'WhatsApp não informado ou número inválido'}</p></div><button class="icon-button" data-modal-close aria-label="Fechar">${icon('close',19)}</button></div>
      <form id="ai-draft-form" class="modal-form">
        <p class="lead-form-hint">Gere uma mensagem personalizada com a IA, revise o conteúdo e envie manualmente. Marque a opção abaixo apenas se a demonstração já foi preparada para este estabelecimento. Este recurso não dispara mensagens pela Evolution API.</p>
        <label class="full site-ready-confirmation"><input type="checkbox" name="site_ready" ${state.modal.siteReady?"checked":""}> O site demonstrativo deste estabelecimento já está pronto para apresentar</label><button type="button" class="btn outline" data-generate-message="${lead.id}" ${state.busy?'disabled':''}>${icon('spark',16)} ${message?'Gerar outra mensagem com Groq':'Gerar mensagem com Groq'}</button>
        <label class="full">MENSAGEM EDITÁVEL<textarea name="message" rows="7" maxlength="1500" placeholder="Gere uma mensagem com IA ou escreva sua abordagem aqui">${esc(message)}</textarea></label>
        <p class="lead-form-hint">Ao clicar em “Abrir WhatsApp”, a conversa será aberta com o número e o texto preenchidos. O envio final depende da sua ação no WhatsApp.</p>
        <div class="modal-bottom"><button type="button" class="btn outline" data-modal-close>Cancelar</button><button type="submit" class="btn outline" ${state.busy?'disabled':''}>Salvar rascunho</button><button type="button" class="btn primary" data-open-whatsapp="${lead.id}" ${phone?'':'disabled'}>${icon('messages',16)} Abrir WhatsApp</button></div>
      </form></div></div>`;
  }
  if(state.modal.type==='lead'){
    const l=state.modal.id?leadOf(state.modal.id):null;
    return `<div class="modal-shade" data-modal-dismiss><div role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal"><div class="modal-top"><div><span class="panel-kicker">CRM / LEAD</span><h2 id="modal-title">${l?'Editar lead':'Novo lead'}</h2></div><button class="icon-button" data-modal-close aria-label="Fechar">${icon('close',19)}</button></div><form id="lead-form" class="modal-form" novalidate><p class="lead-form-hint">Somente o nome do estabelecimento é obrigatório. Os demais campos são opcionais.</p><input type="hidden" name="id" value="${esc(l?.id||'')}"><label class="full">NOME DO ESTABELECIMENTO *<input name="business_name" maxlength="180" value="${esc(l?.business_name||'')}" required placeholder="Ex.: Sorveteria Astronauta"></label><label>CATEGORIA<input name="category" maxlength="120" value="${esc(l?.category||'')}" placeholder="Ex.: Alimentação"></label><label>CIDADE<input name="city" maxlength="100" value="${esc(l?.city||'')}" placeholder="Ex.: Pindamonhangaba"></label><label>ENDEREÇO<input name="address" maxlength="300" value="${esc(l?.address||'')}" placeholder="Rua, número, bairro"></label><label>TELEFONE<input name="phone" maxlength="60" value="${esc(l?.phone||'')}" placeholder="Ex.: +55 12 ..."></label><label>WHATSAPP (OPCIONAL)<input name="whatsapp_phone" maxlength="60" value="${esc(l?.whatsapp_phone||'')}" placeholder="+55 12 99999-9999"></label><label>E-MAIL<input name="email" type="text" inputmode="email" maxlength="250" value="${esc(l?.email||'')}" placeholder="contato@empresa.com"></label><label>WEBSITE<input name="website_url" type="text" inputmode="url" maxlength="700" value="${esc(l?.website_url||'')}" placeholder="https://..."></label><label>STATUS DO SITE<select name="website_status"><option value="unknown" ${!l||l.website_status==='unknown'?'selected':''}>A verificar</option><option value="present" ${l?.website_status==='present'?'selected':''}>Site informado</option><option value="absent" ${l?.website_status==='absent'?'selected':''}>Sem site informado</option></select></label>${!l?`<label class="full">DESTINO DO CADASTRO<select name="destination"><option value="crm" ${state.modal.destination!=='prospects'?'selected':''}>Adicionar diretamente ao CRM</option><option value="prospects" ${state.modal.destination==='prospects'?'selected':''}>Salvar na prospecção para revisão manual</option></select></label>`:''}<label class="full">CONTATO WHATSAPP ASSOCIADO<select name="contact_id"><option value="">Automático pelo telefone / Sem vínculo manual</option>${state.data.contacts.map(c=>`<option value="${c.id}" ${l?.contact_id===c.id?'selected':''}>${esc(c.name||c.phone||c.whatsapp_jid)} · ${esc(c.phone||c.whatsapp_jid)}</option>`).join('')}</select><small class="match-hint">Vínculo por número não comprova titularidade. Contatos ambíguos devem ser confirmados manualmente.</small></label><label>ETAPA<select name="pipeline_stage">${STAGES.map(([s,t])=>`<option value="${s}" ${s===(l?.pipeline_stage||'new')?'selected':''}>${t}</option>`).join('')}</select></label><label>SCORE (0–100)<input name="lead_score" type="number" min="0" max="100" value="${l?.lead_score??''}" placeholder="Opcional"></label><label class="full">OBSERVAÇÕES<textarea name="notes" rows="3" maxlength="2000" placeholder="Necessidades, contexto, próximos passos">${esc(l?.notes||'')}</textarea></label><div class="modal-bottom">${l?`<button class="btn danger-outline" type="button" data-delete-lead="${l.id}">${icon('trash',16)} Excluir</button>`:''}<button class="btn outline" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit" data-save-lead ${state.busy?'disabled':''}>${state.busy?'Salvando…':'Salvar lead'} ${icon('check',16)}</button></div></form></div></div>`;
  }
  if(state.modal.type==='link'){
    const conv=state.data.conversations.find(c=>c.id===state.modal.conversation);
    const contact=conv?contactById(conv.contact_id):null;
    const matches=conv?leadsForConv(conv):[];
    if(!conv||!contact)return '';
    return `<div class="modal-shade" data-modal-dismiss><div role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal"><div class="modal-top"><div><span class="panel-kicker">WHATSAPP / LEAD</span><h2 id="modal-title">Relacionar conversa ao lead</h2><p class="match-info">Número: ${esc(contact.phone||contact.whatsapp_jid)}</p></div><button type="button" class="icon-button" data-modal-close aria-label="Fechar">${icon('close',19)}</button></div><form id="link-form" class="modal-form"><p class="lead-form-hint">Confirme que esse contato representa o estabelecimento. O telefone pode ser de um atendente ou terceiro.</p><label class="full">LEAD <select name="lead_id"><option value="">Nenhum / Desvincular</option>${state.data.leads.map(l=>`<option value="${l.id}" ${matches.some(m=>m.id===l.id)?'selected':''}>${esc(l.business_name)}</option>`).join('')}</select></label><input type="hidden" name="conversation_id" value="${conv.id}"><div class="modal-bottom"><button type="button" class="btn outline" data-modal-close>Cancelar</button><button type="submit" class="btn primary">Confirmar vínculo</button></div></form></div></div>`;
  }
  if(state.modal.type==='task'){
    const leads=chosenLeads();
    return `<div class="modal-shade" data-modal-dismiss><div role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal"><div class="modal-top"><div><span class="panel-kicker">OPERAÇÃO COMERCIAL</span><h2 id="modal-title">Nova atividade</h2></div><button class="icon-button" data-modal-close aria-label="Fechar">${icon('close',19)}</button></div><form id="task-form" class="modal-form"><label class="full">TÍTULO *<input name="title" maxlength="200" required placeholder="Ex.: Enviar proposta de site"></label><label>LEAD *<select name="lead_id" required><option value="">Selecione um lead</option>${leads.map(l=>`<option value="${l.id}">${esc(l.business_name)}</option>`).join('')}</select></label><label>TIPO<select name="activity_type">${Object.entries(TYPE_LABELS).map(([key,value])=>`<option value="${key}">${value}</option>`).join('')}</select></label><label>VENCIMENTO<input type="datetime-local" name="due_at"></label><label>STATUS<select name="status"><option value="pending">Pendente</option><option value="completed">Concluída</option></select></label><label class="full">DESCRIÇÃO<textarea name="description" rows="3" maxlength="2000" placeholder="Anote o que precisa ser feito"></textarea></label><div class="modal-bottom"><button class="btn outline" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit" ${state.busy?'disabled':''}>${state.busy?'Salvando…':'Criar atividade'} ${icon('check',16)}</button></div></form></div></div>`;
  }
  return '';
}
function page(){switch(state.view){case 'inbox':return inbox();case 'insights':return insights();case 'crm':return crm();case 'prospects':return placesMarkup()+prospects();case 'tasks':return tasks();case 'contacts':return contacts();default:return overview();}}
function render(){
  if(liveCrmOwner!==state.me?.id){liveCrmOwner=state.me?.id;liveCrmDetails.clear();liveCrmEpoch++;liveCrmBusy=false;}
  if(state.view!=='crm'&&(liveCrmDetails.size||liveCrmBusy)){liveCrmDetails.clear();liveCrmEpoch++;liveCrmBusy=false;}
  setPlacesContext(state.me?.id||null,state.view,render,refresh);
  const root=$('#app');if(!root)return;
  if(!state.ready){root.innerHTML='<div class="app-boot"><div class="boot-mark">✦</div><p>Preparando seu workspace…</p></div>';return;}
  if(!state.me){root.innerHTML=loginHtml();return;}
  root.innerHTML=shell(page());
  if(state.modal){const dialog=$('.modal'); if(dialog){dialog.scrollTop=0;dialog.querySelector('input:not([type="hidden"])')?.focus({preventScroll:true});}}
}
async function refresh({silent=false}={}){
  if(state.loading||!state.me)return;
  state.loading=true;
  if(!silent)render();
  try {
    const [contacts,conversations,messages,outcomes,leads,activities,settings]=await Promise.all([
      rows('contacts',{select:'id,name,phone,whatsapp_jid,created_at',order:'created_at.desc',limit:'1000'}),
      rows('conversations',{select:'id,contact_id,remote_jid,instance_name,chat_type,mode,last_message_at,created_at',order:'last_message_at.desc.nullslast',limit:'500'}),
      rows('messages',{select:'id,conversation_id,direction,sender_type,content,created_at',order:'created_at.desc',limit:'700'}),
      rows('conversation_outcomes',{select:'id,conversation_id,outcome,sentiment,summary,main_need,objections,next_action,extracted_by,confidence,recorded_at',order:'recorded_at.desc',limit:'700'}),
      rows('leads',{select:'id,business_name,category,phone,whatsapp_phone,contact_id,email,website_url,website_status,city,address,source,lead_score,selected_for_crm,selected_at,pipeline_stage,notes,created_at,google_place_id,google_maps_url,dedupe_key,ai_message_draft',order:'created_at.desc',limit:'1000'}),
      rows('crm_activities',{select:'id,lead_id,activity_type,title,description,status,due_at,completed_at,created_at',order:'created_at.desc',limit:'700'}),
      rows('bot_settings',{select:'id,owner_id,instance_name,enabled,updated_at',instance_name:'eq.leadpilot',limit:'1'})
    ]);
    state.data={contacts,conversations,messages,outcomes,leads,activities,botSettings:settings?.[0]||null};
    state.refreshAt=Date.now();
    if(state.selectedChat && !conversations.some(c=>c.id===state.selectedChat)){state.selectedChat=null;state.thread=[];}
    if(state.view==='inbox'&&!state.selectedChat&&conversations.length)void openChat(conversations[0].id);
  }catch(e){toast('Erro ao carregar dados: '+e.message,true);}
  finally{state.loading=false;render();}
}
async function openChat(id){
  state.selectedChat=id;state.view='inbox';state.thread=[];state.mobileMenu=false;
  render();
  try{
    const messages=await rows('messages',{select:'id,direction,sender_type,content,created_at',conversation_id:'eq.'+id,order:'created_at.desc',limit:'150'});
    if(state.selectedChat===id){state.thread=messages.reverse();render();$('.chat-history')?.scrollTo({top:999999,behavior:'instant'});}
  }catch(e){toast('Falha ao carregar conversa: '+e.message,true);}
}
async function run(task){if(state.busy)return;state.busy=true;try {await task();}catch(e){toast(e.message,true);}finally{state.busy=false;render();}}
const pageLink=id=>{if(!labels[id])return;state.view=id;state.mobileMenu=false;state.search='';state.modal=null;history.replaceState(null,'','#'+id);render();if(id==='inbox'&&state.data.conversations.length&&!state.selectedChat)void openChat(state.data.conversations[0].id);};

// Backdrop clicks close the modal; clicks inside it never dismiss the form.
document.addEventListener('click',e=>{
  if(e.target.matches('.modal-shade[data-modal-dismiss]')){state.modal=null;render();}
},true);
// Delegação: listeners são preservados mesmo depois de cada atualização da interface.
document.addEventListener('click',async e=>{
  const el=e.target.closest('button[data-nav],button[data-refresh],button[data-logout],button[data-menu],button[data-open-lead],button[data-edit-lead],button[data-open-task],button[data-modal-close],button[data-modal-dismiss],button[data-chat],button[data-done],button[data-outcome-filter],button[data-select-all],button[data-promote],button[data-promote-one],button[data-file-trigger],button[data-delete-lead],button[data-delete-selected],button[data-link-conversation],button[data-toggle-bot],button[data-conversation-mode],button[data-message-lead],button[data-generate-message],button[data-open-whatsapp],button[data-live-place]');
  if(!el)return;

  if(el.hasAttribute('data-live-place')){await loadCrmDetails(el.dataset.livePlace);return;}
  if(el.hasAttribute('data-message-lead')){
    const lead=leadOf(el.dataset.messageLead);
    if(!lead)return;
    if(lead.google_place_id&&lead.business_name===REFERENCE_NAME){toast('Cadastre o nome e os dados de fonte própria ou licenciada em Editar lead antes de gerar uma mensagem personalizada.',true);return;}
    state.modal={type:'ai-draft',id:lead.id,draft:lead.ai_message_draft||''};
    render();return;
  }
  if(el.hasAttribute('data-generate-message')){
    const id=el.dataset.generateMessage;
    if(!leadOf(id)||state.busy)return;
    const current=document.querySelector('#ai-draft-form textarea[name="message"]')?.value?.trim()||'';
    if(current&&!confirm('Substituir a mensagem atual por uma nova versão gerada pela IA?'))return;
    await run(async()=>{
      const siteReady=document.querySelector('#ai-draft-form input[name="site_ready"]')?.checked===true;
      const message=await generateLeadMessage(id,siteReady);
      state.modal={type:'ai-draft',id,draft:message,siteReady};
      toast('Mensagem personalizada gerada. Revise antes de enviar.');
    });return;
  }
  if(el.hasAttribute('data-open-whatsapp')){
    const lead=leadOf(el.dataset.openWhatsapp);
    const phone=whatsappNumber(lead);
    const message=document.querySelector('#ai-draft-form textarea[name="message"]')?.value?.trim()||'';
    if(!phone){toast('Este lead precisa de um número brasileiro válido de WhatsApp.',true);return;}
    if(!message){toast('Gere ou escreva uma mensagem antes de abrir o WhatsApp.',true);return;}
    if(!confirm('Abrir WhatsApp para '+lead.business_name+' (+ '+phone+')? Revise o destinatário antes de enviar.'))return;
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
    return;
  }
  if(el.hasAttribute('data-toggle-bot')){
    if(state.busy)return;
    const setting=state.data.botSettings;
    if(!setting){toast('Configuração do bot indisponível. Atualize a página.',true);return;}
    const desired=!setting.enabled;
    if(!confirm(desired?'Reativar respostas automáticas em conversas não assumidas por humanos?':'Pausar todas as respostas automáticas do bot? As conversas continuarão sendo registradas.'))return;
    await run(async()=>{
      const ownerId=await workspaceOwner();
      const changed=await rest('bot_settings',{method:'PATCH',params:{id:'eq.'+setting.id,owner_id:'eq.'+ownerId},body:{enabled:desired,updated_at:new Date().toISOString()}});
      if(!Array.isArray(changed.data)||changed.data.length!==1)throw new Error('Supabase não confirmou a mudança. Confira as permissões.');
      state.data.botSettings=changed.data[0];
      await refresh({silent:true});
      toast(desired?'Bot reativado.':'Bot pausado.');
    });return;
  }
  if(el.hasAttribute('data-conversation-mode')){
    if(state.busy)return;
    const id=el.dataset.conversationMode,mode=el.dataset.nextMode;
    const convo=state.data.conversations.find(c=>c.id===id);
    if(!convo||convo.chat_type==='group'||!['bot','human'].includes(mode))return;
    if(!confirm(mode==='human'?'Assumir esta conversa? O bot deixará de responder a ela.':'Devolver esta conversa ao bot? Ele poderá responder às próximas mensagens se estiver globalmente ativo.'))return;
    await run(async()=>{
      const ownerId=await workspaceOwner();
      const result=await rest('conversations',{method:'PATCH',params:{id:'eq.'+id,owner_id:'eq.'+ownerId},body:{mode}});
      if(!Array.isArray(result.data)||result.data.length!==1)throw new Error('Supabase não confirmou a mudança de atendimento.');
      await refresh({silent:true});
      toast(mode==='human'?'Atendimento humano ativado.':'Conversa devolvida ao bot.');
    });return;
  }
  if(el.hasAttribute('data-nav')){pageLink(el.dataset.nav);return;}
  if(el.hasAttribute('data-refresh')){await refresh();return;}
  if(el.hasAttribute('data-menu')){state.mobileMenu=!state.mobileMenu;render();return;}
  if(el.hasAttribute('data-logout')){await run(async()=>{await signOut();state.me=null;state.data={contacts:[],conversations:[],messages:[],outcomes:[],leads:[],activities:[],botSettings:null};state.refreshAt=null;state.importSelection.clear();render();});return;}
  if(el.hasAttribute('data-open-lead')){e.preventDefault();state.modal={type:'lead',destination:el.dataset.destination||'crm'};render();return;}
  if(el.hasAttribute('data-edit-lead')){state.modal={type:'lead',id:el.dataset.editLead};render();return;}
  if(el.hasAttribute('data-open-task')){if(!chosenLeads().length){toast('Cadastre ou selecione um lead antes de criar uma atividade.',true);return;}state.modal={type:'task'};render();return;}
  if(el.hasAttribute('data-modal-close')){state.modal=null;render();return;}
  if(el.hasAttribute('data-link-conversation')){state.modal={type:'link',conversation:el.dataset.linkConversation};render();return;}
  if(el.hasAttribute('data-chat')){await openChat(el.dataset.chat);return;}
  if(el.hasAttribute('data-done')){await run(async()=>{await edit('crm_activities',el.dataset.done,{status:'completed',completed_at:new Date().toISOString()});toast('Atividade concluída.');await refresh({silent:true});});return;}
  if(el.hasAttribute('data-outcome-filter')){state.outcomeFilter=el.dataset.outcomeFilter;render();return;}
  if(el.hasAttribute('data-select-all')){const candidates=state.data.leads.filter(l=>!l.selected_for_crm);state.importSelection=state.importSelection.size===candidates.length?new Set():new Set(candidates.map(l=>l.id));render();return;}
  if(el.hasAttribute('data-promote')||el.hasAttribute('data-promote-one')){const ids=el.hasAttribute('data-promote-one')?[el.dataset.promoteOne]:[...state.importSelection];const valid=ids.filter(id=>state.data.leads.some(l=>l.id===id&&!l.selected_for_crm));if(!valid.length)return;if(!confirm(`Adicionar ${valid.length} lead(s) ao CRM?`))return;await run(async()=>{let count=0,failed=0;for(const id of valid){try{await promoteLead(id);count++;state.importSelection.delete(id);}catch(e){failed++;console.warn('Falha no envio de um candidato',e.message);}}await refresh({silent:true});toast(`${count} lead(s) no CRM.${failed?' '+failed+' falharam; tente novamente.':''}`,!!failed);});return;}
  if(el.hasAttribute('data-delete-lead')){
    e.preventDefault();
    if(state.busy)return;
    const id=el.dataset.deleteLead;
    const lead=leadOf(id);
    if(!lead){toast('Lead não encontrado. Atualize a lista.',true);return;}
    const related=state.data.activities.filter(a=>a.lead_id===id).length;
    const notice=related?`\nATENÇÃO: ${related} atividade(s) vinculada(s) também serão apagadas.`:'';
    if(!confirm(`Excluir definitivamente o lead "${lead.business_name}"?${notice}\nEssa ação não pode ser desfeita.`))return;
    await run(async()=>{
      await deleteLead(id);
      state.importSelection.delete(id);
      state.modal=null;
      state.data.leads=state.data.leads.filter(l=>l.id!==id);
      toast('Lead excluído com sucesso.');
      await refresh({silent:true});
    });
    return;
  }
  if(el.hasAttribute('data-delete-selected')){
    e.preventDefault();
    if(state.busy)return;
    const ids=[...state.importSelection].filter(id=>state.data.leads.some(l=>l.id===id&&!l.selected_for_crm));
    if(!ids.length){toast('Selecione pelo menos um lead para excluir.',true);return;}
    const activities=state.data.activities.filter(a=>ids.includes(a.lead_id)).length;
    const warning=activities?`\nATENÇÃO: ${activities} atividade(s) vinculada(s) também serão apagadas.`:'';
    if(!confirm(`Excluir definitivamente ${ids.length} lead(s) selecionado(s)?${warning}\nEssa ação não pode ser desfeita.`))return;
    await run(async()=>{
      let removed=0,failed=0;
      for(const id of ids){
        try{
          await deleteLead(id);
          state.importSelection.delete(id);
          state.data.leads=state.data.leads.filter(l=>l.id!==id);
          removed++;
        }catch(error){failed++;console.error('Falha ao excluir lead:',error);}
      }
      await refresh({silent:true});
      if(failed)toast(`${removed} lead(s) excluído(s); ${failed} falha(s). Tente novamente.`,true);
      else toast(`${removed} lead(s) excluído(s) com sucesso.`);
    });
    return;
  }
  if(el.hasAttribute('data-file-trigger')){$('#json-file')?.click();return;}
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-prospect-check]')){const id=e.target.dataset.prospectCheck;if(e.target.checked)state.importSelection.add(id);else state.importSelection.delete(id);render();}
});
async function handleFormSubmit(e){
  const form=e.target;
  if(!['login-form','lead-form','task-form','import-form','link-form','ai-draft-form'].includes(form.getAttribute('id'))&&!form.matches('[data-search-form]'))return;
  e.preventDefault();
  if(form.matches('[data-search-form]')){state.search=String(new FormData(form).get('query')||'').trim();render();return;}
  if(form.getAttribute('id')==='login-form'){
    const data=new FormData(form);const email=String(data.get('email')||'').trim(),pass=String(data.get('password')||'');
    await run(async()=>{state.me=await login(email,pass);toast('Bem-vindo ao LeadPilot.');await refresh();});return;
  }

  if(form.getAttribute('id')==='ai-draft-form'){
    const lead=leadOf(state.modal?.id);
    const message=String(new FormData(form).get('message')||'').trim();
    if(!lead||!message){toast('Escreva uma mensagem antes de salvar.',true);return;}
    await run(async()=>{
      const saved=await edit('leads',lead.id,{ai_message_draft:message,updated_at:new Date().toISOString()});
      if(!saved?.length)throw new Error('Não foi possível salvar a mensagem.');
      state.modal={type:'ai-draft',id:lead.id,draft:message};
      await refresh({silent:true});
      toast('Rascunho salvo com sucesso neste lead.');
    });return;
  }
  if(form.getAttribute('id')==='lead-form'){
    const data=new FormData(form);
    const id=String(data.get('id')||'');
    const name=String(data.get('business_name')||'').trim();
    if(!name){toast('Informe somente o nome do estabelecimento para continuar.',true);form.querySelector('[name="business_name"]')?.focus();return;}
    const score=String(data.get('lead_score')||'').trim();
    if(score && (!Number.isInteger(Number(score))||Number(score)<0||Number(score)>100)){toast('O score deve ser um número de 0 a 100.',true);return;}
    const url=String(data.get('website_url')||'').trim();
    const email=String(data.get('email')||'').trim();
    const manualCandidate=String(data.get('destination')||state.modal?.destination||'crm')==='prospects';
    const fields={business_name:name,category:String(data.get('category')||'').trim()||null,city:String(data.get('city')||'').trim()||null,
      phone:String(data.get('phone')||'').trim()||null,whatsapp_phone:String(data.get('whatsapp_phone')||'').trim()||null,contact_id:String(data.get('contact_id')||'')||null,email:email||null,address:String(data.get('address')||'').trim()||null,website_url:url||null,
      website_status:String(data.get('website_status')||'unknown'),pipeline_stage:String(data.get('pipeline_stage')||'new'),
      notes:String(data.get('notes')||'').trim()||null,lead_score:score===''?null:Number(score),updated_at:new Date().toISOString()};
    await run(async()=>{
      let saved;
      if(id){
        saved=await edit('leads',id,fields);
        if(!saved?.length)throw new Error('O lead não foi atualizado. Verifique as permissões do workspace.');
      } else {
        const duplicate=state.data.leads.some(l=>isSameLead(l,{...fields,source:'manual'}));
        if(duplicate)throw new Error('Já existe um lead com esses dados. Pesquise antes de criar novamente.');
        saved=await add('leads',{...fields,source:'manual',selected_for_crm:!manualCandidate,
          selected_at:manualCandidate?null:new Date().toISOString()});
        if(!saved?.[0]?.id)throw new Error('O Supabase não confirmou a criação do lead.');
      }
      state.modal=null;
      if(!id){state.view=manualCandidate?'prospects':'crm';history.replaceState(null,'','#'+state.view);}
      await refresh({silent:true});
      const visible=state.data.leads.some(l=>l.id===saved[0].id);
      toast(id?'Lead atualizado com sucesso.':visible?'Lead criado com sucesso!':'Lead criado no Supabase. Atualize a lista para visualizá-lo.');
    });return;
  }
    if(form.getAttribute('id')==='link-form'){
    const data=new FormData(form);
    const conv=state.data.conversations.find(c=>c.id===String(data.get('conversation_id')||''));
    const leadId=String(data.get('lead_id')||'');
    if(!conv?.contact_id){toast('Conversa sem contato WhatsApp.',true);return;}
    await run(async()=>{
      const linked=leadsForContact(conv.contact_id);
      for(const lead of linked)if(lead.id!==leadId){
        const result=await edit('leads',lead.id,{contact_id:null});
        if(!result?.length)throw new Error('Falha ao remover associação anterior.');
      }
      if(leadId){
        if(!leadOf(leadId))throw new Error('Lead não encontrado.');
        const edited=await edit('leads',leadId,{contact_id:conv.contact_id});
        if(!edited?.length)throw new Error('Falha ao associar contato ao lead.');
      }
      state.modal=null;
      await refresh({silent:true});
      toast(leadId?'Lead relacionado à conversa.':'Vínculo removido.');
    });return;
  }
  if(form.getAttribute('id')==='task-form'){
    const data=new FormData(form);const title=String(data.get('title')||'').trim();const lead_id=String(data.get('lead_id')||'');
    if(!title||!chosenLeads().some(l=>l.id===lead_id)){toast('Preencha o título e selecione um lead.',true);return;}
    const status=String(data.get('status')||'pending');const due=String(data.get('due_at')||'');
    await run(async()=>{await add('crm_activities',{title,lead_id,status,activity_type:String(data.get('activity_type')||'task'),
      description:String(data.get('description')||'').trim()||null,due_at:due?new Date(due).toISOString():null,
      completed_at:status==='completed'?new Date().toISOString():null});state.modal=null;toast('Atividade criada.');await refresh({silent:true});});return;
  }
  if(form.getAttribute('id')==='import-form'){
    const file=new FormData(form).get('file');if(!file||typeof file.text!=='function'){toast('Escolha um arquivo JSON.',true);return;}
    await run(async()=>{
      if(file.size>4_000_000)throw new Error('Arquivo muito grande (limite de 4 MB).');
      let parsed;try {parsed=JSON.parse(await file.text());}catch{throw new Error('JSON inválido.');}
      const batch=parseImport(parsed);
      const existing=state.data.leads;
      const candidates=batch.rows.filter(l=>!existing.some(old=>isSameLead(old,l)));
      const dupExisting=batch.rows.length-candidates.length;
      let imported=0,failed=0;
      for(let i=0;i<candidates.length;i+=25){
        const ownerId=await workspaceOwner();
        const chunk=candidates.slice(i,i+25).map(l=>({...l,owner_id:ownerId}));
        try {await rest('leads',{method:'POST',body:chunk});imported+=chunk.length;}
        catch {for(const item of chunk){try {await rest('leads',{method:'POST',body:item});imported++;}catch{failed++;}}}
      }
      state.importSelection.clear();
      state.importReport=`${imported} importados sem seleção automática · ${batch.invalid} inválidos · ${batch.duplicate+dupExisting} duplicados · ${failed} não importados`;
      toast(`${imported} leads importados. Selecione manualmente os que irão ao CRM.`);
      await refresh({silent:true});
    });return;
  }
}
document.addEventListener('submit',handleFormSubmit,true);
let dragged=null;
document.addEventListener('dragstart',e=>{const card=e.target.closest('[data-drag-lead]');if(card){dragged=card.dataset.dragLead;e.dataTransfer?.setData('text/plain',dragged);e.dataTransfer.effectAllowed='move';}});
document.addEventListener('dragover',e=>{if(dragged&&e.target.closest('[data-drop-stage]'))e.preventDefault();});
document.addEventListener('drop',async e=>{
  const target=e.target.closest('[data-drop-stage]');if(!target||!dragged)return;
  e.preventDefault();const id=dragged;dragged=null;
  if(!chosenLeads().some(l=>l.id===id))return;
  await run(async()=>{await edit('leads',id,{pipeline_stage:target.dataset.dropStage,updated_at:new Date().toISOString()});toast('Etapa do lead atualizada.');await refresh({silent:true});});
});
document.addEventListener('dragend',()=>{dragged=null;});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.modal){state.modal=null;render();}});

async function start(){
  try{config();state.me=await restoreSession();}catch(e){state.ready=true;$('#app').innerHTML=`<div class="config-error"><div class="brand-mark">${icon('bolt',27)}</div><h1>Configuração necessária</h1><p>${esc(e.message)}</p><p>Confira <code>SUPABASE_URL</code> e <code>SUPABASE_PUBLISHABLE_KEY</code> na Vercel e faça um novo deploy.</p></div>`;return;}
  state.view=labels[location.hash.slice(1)]?location.hash.slice(1):'overview';
  state.ready=true;render();
  if(state.me)await refresh();
  setInterval(()=>{if(!state.me||state.modal||state.loading||document.hidden)return;const focused=document.activeElement?.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(focused))return;void refresh({silent:true});},45_000);
}
void start();
