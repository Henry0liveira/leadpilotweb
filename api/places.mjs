const fields='places.id,places.displayName,places.formattedAddress,places.businessStatus,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.googleMapsUri,places.attributions,nextPageToken';
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
   const {category,city,pageToken,limit=20,placeId}=req.body||{};
   const details=placeId!==undefined;
   if(details&&(typeof placeId!=='string'||!/^[A-Za-z0-9_-]{5,200}$/.test(placeId)))return res.status(400).json({error:'Identificador inválido.'});
   if(![20,40,60].includes(limit))return res.status(400).json({error:'Limite inválido.'});
   if(!details&&(typeof city!=='string'||typeof category!=='string'||!city.trim()||!category.trim()||city.length>120||category.length>100||(pageToken!=null&&(typeof pageToken!=='string'||pageToken.length>4096))))return res.status(400).json({error:'Informe cidade e segmento válidos.'});
   const base=url.replace(/\/$/,'');const headers={apikey:key,Authorization:token};
   const auth=await fetchImpl(base+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});
   if(!auth.ok)return res.status(401).json({error:'Sessão inválida.'});
   const user=await auth.json();
   if(!user.id||user.is_anonymous)return res.status(403).json({error:'Acesso não autorizado.'});
   const membership=await fetchImpl(base+'/rest/v1/workspace_members?select=user_id&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1',{headers,signal:AbortSignal.timeout(8000)});
   if(!membership.ok||!(await membership.json()).some(m=>m.user_id===user.id))return res.status(403).json({error:'Acesso restrito à equipe LeadPilot.'});
   const time=now();for(const [id,v] of limits)if(time-v.start>=3600000)limits.delete(id);
   const quota=limits.get(user.id)||{start:time,last:0,count:0};
   if(quota.count+limit/20>30||(quota.count&&time-quota.last<2500))return res.status(429).json({error:'Limite de consultas atingido. Aguarde antes de pesquisar novamente.'});
   limits.set(user.id,{start:quota.start,last:time,count:quota.count+limit/20});
   if(details){
    const r=await fetchImpl('https://places.googleapis.com/v1/places/'+encodeURIComponent(placeId),{headers:{'X-Goog-Api-Key':google,'X-Goog-FieldMask':'id,displayName,formattedAddress,websiteUri,nationalPhoneNumber,internationalPhoneNumber,rating,userRatingCount,googleMapsUri,attributions'},signal:AbortSignal.timeout(10000)});
    if(!r.ok)return res.status(r.status===429?429:502).json({error:'Não foi possível consultar a ficha (HTTP '+r.status+').'});
    const p=await r.json();return res.status(200).json({place:{id:p.id,name:p.displayName?.text||'',address:p.formattedAddress||'',phone:p.nationalPhoneNumber||p.internationalPhoneNumber||null,website:p.websiteUri||null,rating:p.rating??null,reviews:p.userRatingCount??null,maps:p.googleMapsUri||null,attributions:p.attributions||[]}});
   }
   const places=[],seen=new Set();let cursor=pageToken||null,notice='';
   for(let i=0;i<limit/20;i++){
    const r=await fetchImpl('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':google,'X-Goog-FieldMask':fields},body:JSON.stringify({textQuery:category.trim()+' em '+city.trim()+', Brasil',languageCode:'pt-BR',regionCode:'BR',pageSize:20,...(cursor?{pageToken:cursor}:{})}),signal:AbortSignal.timeout(10000)});
    if(!r.ok){if(places.length){notice='Consulta parcial: o Google recusou a próxima página (HTTP '+r.status+').';break;}return res.status(r.status===429?429:502).json({error:r.status===429?'Limite da API Google atingido.':'Google Places recusou a consulta (HTTP '+r.status+'). Verifique faturamento, restrições da chave e Places API (New).'});}
    const data=await r.json();if(data.places!=null&&!Array.isArray(data.places))throw Error('Formato inválido');
    for(const p of data.places||[]){if(!p?.id||seen.has(p.id)||p.businessStatus==='CLOSED_PERMANENTLY')continue;seen.add(p.id);places.push({id:p.id,name:p.displayName?.text||'',address:p.formattedAddress||'',phone:p.nationalPhoneNumber?.trim()||p.internationalPhoneNumber?.trim()||null,phoneChecked:true,website:p.websiteUri?.trim()||null,websiteChecked:true,rating:p.rating??null,reviews:p.userRatingCount??null,maps:p.googleMapsUri||null,attributions:p.attributions||[]});}
    cursor=data.nextPageToken||null;if(!cursor)break;
   }
   return res.status(200).json({places,nextPageToken:cursor,notice,coverage:{total:places.length,withPhone:places.filter(p=>p.phone).length,withWebsite:places.filter(p=>p.website).length}});
  }catch{return res.status(502).json({error:'Não foi possível consultar os estabelecimentos.'});}
 };
}
export default createHandler();
