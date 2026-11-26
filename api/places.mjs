const fields='places.id,places.displayName,places.formattedAddress,places.businessStatus,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.googleMapsUri,places.attributions,nextPageToken';
const textValue=(...values)=>values.find(v=>typeof v==='string'&&v.trim())?.trim()||null;
function websiteKind(url){
 if(!url)return 'missing';
 try{
  const u=new URL(url);if(!['https:','http:'].includes(u.protocol))return 'unknown';
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  const platforms=['instagram.com','facebook.com','fb.com','fb.me','tiktok.com','linkedin.com','youtube.com','youtu.be','wa.me','whatsapp.com','linktr.ee','beacons.ai','ifood.com.br','rappi.com.br','bio.site'];
  return platforms.some(d=>host===d||host.endsWith('.'+d))?'social':'website';
 }catch{return 'unknown';}
}
export function normalizePlace(p){
 const phone=textValue(p.nationalPhoneNumber,p.internationalPhoneNumber,p.formatted_phone_number,p.international_phone_number,p.phone);
 const website=textValue(p.websiteUri,p.websiteURI,p.website);
 return {id:p.id||p.place_id||null,name:p.displayName?.text||p.name||'',address:p.formattedAddress||p.formatted_address||p.address||'',phone,website,websiteKind:websiteKind(website),rating:p.rating??null,reviews:p.userRatingCount??p.user_ratings_total??p.reviews??null,maps:p.googleMapsUri||p.url||p.maps||null,attributions:Array.isArray(p.attributions)?p.attributions:[]};
}
const limits=new Map();
export function createHandler({fetchImpl=fetch,env=process.env,now=Date.now}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
  const token=req.headers.authorization;
  if(typeof token!=='string'||!/^Bearer [A-Za-z0-9_.-]+$/.test(token))return res.status(401).json({error:'Entre na sua conta.'});
  const {SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,GOOGLE_PLACES_API_KEY:google}=env;
  if(!url||!key||!google)return res.status(503).json({error:'Integração indisponível.'});
  try{
   const {category,city,pageToken}=req.body||{};
   if(typeof city!=='string'||typeof category!=='string'||!city.trim()||!category.trim()||city.length>120||category.length>100||(pageToken!=null&&(typeof pageToken!=='string'||pageToken.length>4096)))return res.status(400).json({error:'Informe cidade e segmento válidos.'});
   const base=url.replace(/\/$/,'');const headers={apikey:key,Authorization:token};
   const auth=await fetchImpl(base+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});
   if(!auth.ok)return res.status(401).json({error:'Sessão inválida.'});
   const user=await auth.json();
   if(!user.id||user.is_anonymous)return res.status(403).json({error:'Acesso não autorizado.'});
   const membership=await fetchImpl(base+'/rest/v1/workspace_members?select=user_id&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{headers,signal:AbortSignal.timeout(8000)});
   if(!membership.ok||!(await membership.json()).some(m=>m.user_id===user.id))return res.status(403).json({error:'Acesso restrito à equipe LeadPilot.'});
   const time=now();for(const [id,v] of limits)if(time-v.start>=3600000)limits.delete(id);
   const limit=limits.get(user.id)||{start:time,last:0,count:0};
   if(limit.count>=30||(limit.count&&time-limit.last<2500))return res.status(429).json({error:'Limite de consultas atingido. Aguarde antes de pesquisar novamente.'});
   limits.set(user.id,{start:limit.start,last:time,count:limit.count+1});
   const r=await fetchImpl('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':google,'X-Goog-FieldMask':fields},body:JSON.stringify({textQuery:category.trim()+' em '+city.trim()+', Brasil',languageCode:'pt-BR',regionCode:'BR',pageSize:20,...(pageToken?{pageToken}:{})}),signal:AbortSignal.timeout(12000)});
   if(!r.ok)return res.status(r.status===429?429:502).json({error:r.status===429?'Limite da API Google atingido.':'Google Places recusou a consulta. Verifique faturamento, restrições da chave e Places API (New).'});
   const data=await r.json();
   if(data.places!=null&&!Array.isArray(data.places))return res.status(502).json({error:'Formato inesperado da resposta Google Places.'});
   const places=(data.places||[]).filter(p=>p&&p.businessStatus!=='CLOSED_PERMANENTLY').map(normalizePlace);
   const coverage={total:places.length,withPhone:places.filter(p=>p.phone).length,withWebsite:places.filter(p=>p.websiteKind==='website').length,social:places.filter(p=>p.websiteKind==='social').length,missing:places.filter(p=>p.websiteKind==='missing').length,unknown:places.filter(p=>p.websiteKind==='unknown').length};
   return res.status(200).json({places,coverage,nextPageToken:data.nextPageToken||null});
  }catch{return res.status(502).json({error:'Não foi possível consultar os estabelecimentos.'});}
 };
}
export default createHandler();
