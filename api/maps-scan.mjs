import {scanMaps} from '../lib/maps-scan.mjs';
const limits=new Map();
export function createHandler({fetchImpl=fetch,env=process.env,now=Date.now,scan=scanMaps}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
  const token=req.headers.authorization;
  if(typeof token!=='string'||!/^Bearer [A-Za-z0-9_.-]+$/.test(token))return res.status(401).json({error:'Entre na sua conta.'});
  const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key}=env;
  if(!url||!key)return res.status(503).json({error:'Integração indisponível.'});
  const started=now();
  try{
   const {category,city}=req.body||{};
   if(typeof city!=='string'||typeof category!=='string'||!city.trim()||!category.trim()||city.length>120||category.length>100)return res.status(400).json({error:'Informe cidade e segmento válidos.'});
   const base=url.replace(/\/$/,'');const headers={apikey:key,Authorization:token};
   const auth=await fetchImpl(base+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});
   if(!auth.ok)return res.status(401).json({error:'Sessão inválida.'});
   const user=await auth.json();
   if(!user.id||user.is_anonymous)return res.status(403).json({error:'Acesso não autorizado.'});
   const membership=await fetchImpl(base+'/rest/v1/workspace_members?select=user_id&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{headers,signal:AbortSignal.timeout(8000)});
   if(!membership.ok||!(await membership.json()).some(m=>m.user_id===user.id))return res.status(403).json({error:'Acesso restrito à equipe LeadPilot.'});
   const time=now();for(const [id,v] of limits)if(time-v.start>=3600000)limits.delete(id);
   const limit=limits.get(user.id)||{start:time,last:0,count:0};
   if(limit.count>=6||(limit.count&&time-limit.last<15000))return res.status(429).json({error:'Limite de consultas atingido. Aguarde antes de pesquisar novamente.'});
   limits.set(user.id,{start:limit.start,last:time,count:limit.count+1});
   const data=await scan({city:city.trim(),category:category.trim(),deadline:started+48000});
   return res.status(200).json({...data,nextPageToken:null});
  }catch(e){return res.status(502).json({error:'O extrator não conseguiu concluir a consulta. A fonte pode estar indisponível ou limitar a automação.'});}
 };
}
export default createHandler();
