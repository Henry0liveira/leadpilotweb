/* Cliente REST Supabase sem dependências: Auth + PostgREST com RLS.
   Armazena sessão apenas na aba (sessionStorage), nunca a chave de serviço. */
const SESSION_KEY = 'leadpilot.session.v1';
let current = null;
let refreshInFlight = null;
export function config() {
  const cfg = typeof window !== 'undefined' ? window.LEADPILOT_CONFIG : null;
  if(!cfg?.url || !cfg?.key || cfg.key.startsWith('sb_secret_')) {
    throw new Error('Configuração pública do Supabase não encontrada. Confira as variáveis da Vercel.');
  }
  return cfg;
}
function save(session) {
  current = session;
  try { if(session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); else sessionStorage.removeItem(SESSION_KEY); }
  catch { /* navegador sem armazenamento disponível: sessão somente em memória */ }
}
function read() {
  if(current) return current;
  try {const stored = sessionStorage.getItem(SESSION_KEY); if(stored) current = JSON.parse(stored);} catch {return null;}
  return current;
}
export function user() {return read()?.user || null;}
function responseError(status, data) {
  const code = data?.code || data?.error_code || '';
  const detail = data?.msg || data?.error_description || data?.message || data?.error || '';
  if(status===401 || status===403) return new Error('Acesso não autorizado. Verifique a sessão e suas permissões.');
  if(code==='23505') return new Error('Este registro já existe no CRM.');
  return new Error(detail && String(detail).length < 220 ? detail : `Erro ao acessar Supabase (HTTP ${status}).`);
}
async function authFetch(path, payload, token) {
  const cfg = config();
  const response = await fetch(cfg.url + '/auth/v1/' + path, {
    method: payload ? 'POST' : 'GET',
    headers: {'apikey':cfg.key,'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{})},
    ...(payload ? {body:JSON.stringify(payload)} : {}),
    cache:'no-store'
  });
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw responseError(response.status,data);
  return data;
}
function ingestAuth(response) {
  const previous = read();
  if(!response.access_token || !(response.refresh_token || previous?.refresh_token)) throw new Error('Resposta de autenticação incompleta.');
  const session = {
    access_token:response.access_token,
    refresh_token:response.refresh_token || previous.refresh_token,
    expires_at:Date.now()+Math.max(Number(response.expires_in||3600)-30,30)*1000,
    user:response.user || previous?.user
  };
  save(session);
  return session;
}
export async function login(email,password) {
  workspaceCache=null;
  const result = await authFetch('token?grant_type=password',{email,password});
  const session = ingestAuth(result);
  if(!session.user?.id){await signOut(); throw new Error('Usuário não encontrado na sessão.');}
  return session.user;
}
async function refresh() {
  if(refreshInFlight) return refreshInFlight;
  refreshInFlight = (async()=>{
    const session = read();
    if(!session?.refresh_token) throw new Error('Sua sessão expirou. Entre novamente.');
    const result = await authFetch('token?grant_type=refresh_token',{refresh_token:session.refresh_token});
    return ingestAuth(result);
  })();
  try {return await refreshInFlight;} finally {refreshInFlight=null;}
}
export async function accessToken() {
  const session=read();
  if(!session?.access_token) throw new Error('Entre com seu e-mail e senha.');
  if(Date.now()>=session.expires_at) await refresh();
  return read().access_token;
}
export async function restoreSession() {
  if(!read()?.refresh_token)return null;
  try {
    let token=await accessToken();
    let profile;
    try {profile=await authFetch('user',null,token);}
    catch {token=(await refresh()).access_token; profile=await authFetch('user',null,token);}
    if(!profile?.id) throw new Error('Usuário inválido');
    const s=read(); save({...s,user:profile});
    return profile;
  } catch {save(null);return null;}
}
export async function signOut() {
  workspaceCache=null;
  const token=read()?.access_token;
  save(null);
  if(token) {
    try {await authFetch('logout',{},token);} catch { /* sessão local já revogada */ }
  }
}
export async function rest(table,{method='GET',params={},body,count=false}={}) {
  const cfg=config();
  const query=new URLSearchParams(params);
  const url=cfg.url+'/rest/v1/'+encodeURIComponent(table)+(query.size?'?'+query:'');
  const token=await accessToken();
  const headers={apikey:cfg.key,Authorization:'Bearer '+token,'Content-Type':'application/json'};
  if(method==='POST'||method==='PATCH'||method==='DELETE') headers.Prefer='return=representation';
  if(count) headers.Prefer=(headers.Prefer?headers.Prefer+',':'')+'count=exact';
  let response=await fetch(url,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  if(response.status===401){
    const session=await refresh();
    response=await fetch(url,{method,headers:{...headers,Authorization:'Bearer '+session.access_token},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store'});
  }
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw responseError(response.status,data);
  return {data:data??[],count:Number(response.headers.get('content-range')?.split('/').pop())||0};
}
export const rows=async(table,params={})=>(await rest(table,{params})).data;
let workspaceCache = null;
export async function workspaceOwner() {
  if(workspaceCache) return workspaceCache;
  const activeUser = user();
  if(!activeUser?.id) throw new Error('Entre na sua conta para acessar o workspace.');
  const memberships = await rows('workspace_members',{select:'workspace_owner_id',user_id:'eq.'+activeUser.id,limit:'1'});
  workspaceCache = memberships?.[0]?.workspace_owner_id || activeUser.id;
  return workspaceCache;
}
export async function add(table,body) {
  const ownerId=await workspaceOwner();
  if(!ownerId)throw new Error('Sessão não iniciada');
  return (await rest(table,{method:'POST',body:{...body,owner_id:ownerId}})).data;
}
export async function deleteLead(id) {
  const ownerId = await workspaceOwner();
  if(!ownerId) throw new Error('Sessão não iniciada.');
  const records = await rest('leads',{
    method:'DELETE',
    params:{id:'eq.'+id,owner_id:'eq.'+ownerId}
  });
  if(!Array.isArray(records.data) || records.data.length!==1) {
    throw new Error('O Supabase não confirmou a exclusão. Confira as permissões de administrador.');
  }
  return records.data[0];
}
export async function edit(table,id,fields) {
  const ownerId=await workspaceOwner();
  if(!ownerId)throw new Error('Sessão não iniciada');
  return (await rest(table,{method:'PATCH',params:{id:'eq.'+id,owner_id:'eq.'+ownerId},body:fields})).data;
}

/** Geração segura de rascunho comercial: a chave Groq nunca fica no navegador. */
export async function generateLeadMessage(leadId,siteReady=false){
  const cfg=config(),token=await accessToken();
  const response=await fetch(cfg.url+'/functions/v1/generate-lead-message',{
    method:'POST',cache:'no-store',
    headers:{'apikey':cfg.key,'Authorization':'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({lead_id:leadId,site_ready:siteReady===true})
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'Erro na geração com Groq (HTTP '+response.status+').');
  if(typeof body.draft!=='string'||!body.draft.trim())throw new Error('Groq não retornou uma mensagem.');
  return body.draft.trim();
}
