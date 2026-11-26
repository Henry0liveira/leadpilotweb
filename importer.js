/* Leitura de exportações JSON do Google Maps com seleção manual no CRM. */
const norm = value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const text=(value,max=300)=>(typeof value==='string'||typeof value==='number'?String(value).trim().slice(0,max):'');
function field(obj,...keys){
  const entries=Object.entries(obj||{});
  for(const key of keys){const found=entries.find(([name])=>norm(name)===norm(key));if(found?.[1]!=null)return found[1];}
}
function safeUrl(value){
  try {const u=new URL(text(value,700));return /^https?:$/.test(u.protocol)?u.href.slice(0,700):null;}
  catch{return null;}
}
function list(payload){
  if(Array.isArray(payload))return payload;
  if(!payload||typeof payload!=='object')throw new Error('O JSON deve conter uma lista de empresas.');
  for(const key of ['leads','items','results','data','businesses','companies','estabelecimentos']){
    const value=field(payload,key);
    if(Array.isArray(value))return value;
    if(value&&typeof value==='object')for(const nested of ['leads','results','items']){
      const arr=field(value,nested);if(Array.isArray(arr))return arr;
    }
  }
  throw new Error('Nenhuma lista encontrada. Utilize array JSON ou objeto com leads/items/results/data.');
}
export function parseImport(payload){
  const input=list(payload);
  if(input.length>1500)throw new Error('Máximo de 1.500 registros por arquivo. Divida a exportação.');
  const output=[]; let invalid=0,duplicate=0;
  for(const record of input){
    if(!record||typeof record!=='object'||Array.isArray(record)){invalid++;continue;}
    const business_name=text(field(record,'name','nome','empresa','businessName','business','title','estabelecimento'),180);
    const address=text(field(record,'address','endereco','formattedAddress','fullAddress'),300);
    const city=text(field(record,'city','cidade','municipio','cityState'),100);
    const phone=text(field(record,'phone','telefone','phoneNumber','internationalPhoneNumber','nationalPhoneNumber','celular'),60);
    const google_place_id=text(field(record,'placeId','googlePlaceId'),160)||null;
    const google_maps_url=safeUrl(field(record,'maps','googleMapsUrl','mapsUrl','googleMapsUri','mapsLink','linkMaps','urlGoogleMaps','placeUrl'));
    const website_url=safeUrl(field(record,'website','site','websiteUrl','siteUrl','urlSite'));
    const category=text(field(record,'category','categoria','type','tipo','segmento'),120)||null;
    if(!business_name||(!address&&!city&&!phone&&!google_maps_url&&!google_place_id)){invalid++;continue;}
    const explicitStatus=norm(field(record,'websiteStatus','siteStatus','statusSite'));
    const absent=['semsite','nosite','absent','naotemsite'].includes(explicitStatus)||field(record,'noWebsite','noSite','semSite')===true;
    const social=/instagram\.com|facebook\.com|linktr\.ee|wa\.me|whatsapp\.com/.test(website_url||'');
    const website_status=absent?'absent':website_url&&!social?'present':'unknown';
    const rawScore=Number(field(record,'score','priorityScore','leadScore','pontuacao'));
    const lead_score=Number.isFinite(rawScore)&&rawScore>=0&&rawScore<=100&&field(record,'score','priorityScore','leadScore','pontuacao')!==undefined?Math.round(rawScore):null;
    const rawRating=Number(String(field(record,'rating','nota','stars')??'').replace(',','.'));
    const rating=Number.isFinite(rawRating)&&rawRating>=0&&rawRating<=5?rawRating:null;
    const rawReviews=Number(field(record,'reviewCount','reviewsCount','totalReviews','ratingCount','userRatingCount'));
    const review_count=Number.isInteger(rawReviews)&&rawReviews>=0?rawReviews:null;
    const candidate={business_name,category,phone:phone||null,website_url,website_status,address:address||null,city:city||null,
      google_place_id,google_maps_url,lead_score,rating,review_count,
      source:'json_import',selected_for_crm:false,pipeline_stage:'new'};
    if(output.some(x=>isSameLead(x,candidate))){duplicate++;continue;}
    candidate.dedupe_key=generateDedupeKey(candidate);
    output.push(candidate);
  }
  return {rows:output,inputCount:input.length,invalid,duplicate};
}
export function fingerprints(lead){
  const tokens=new Set(); const n=norm(lead.business_name),a=norm(lead.address),p=String(lead.phone||'').replace(/\D/g,'');
  if(lead.google_place_id)tokens.add('google:'+lead.google_place_id);
  if(lead.google_maps_url)tokens.add('maps:'+lead.google_maps_url.split('?')[0].replace(/\/$/,''));
  if(n&&a.length>=8)tokens.add('address:'+n+':'+a);
  if(n&&p.length>=10)tokens.add('phone:'+n+':'+p);
  return tokens;
}
export function isSameLead(a,b){const x=fingerprints(a),y=fingerprints(b);return [...x].some(v=>y.has(v));}
export function generateDedupeKey(lead){
  const tokens=fingerprints(lead);
  return [...tokens][0]?.slice(0,450)||null;
}
