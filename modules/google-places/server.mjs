// Server-only module (Node 20+). Integrate with the existing authenticated API.
const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.businessStatus,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.googleMapsUri,places.primaryTypeDisplayName,places.attributions,nextPageToken';
export function createPlacesHandler({authorize, fetchImpl=fetch, apiKey=process.env.GOOGLE_PLACES_API_KEY}={}) {
  if(typeof authorize !== 'function') throw new Error('An authenticated authorization/rate-limit guard is required.');
  return async function handler(req,res) {
    res.setHeader('Cache-Control','no-store');
    if(req.method !== 'POST') {res.setHeader('Allow','POST');return res.status(405).json({error:'Método não permitido.'});}
    try {
      if(!await authorize(req)) return res.status(403).json({error:'Acesso não autorizado.'});
      if(!apiKey) return res.status(503).json({error:'Google Places não configurado.'});
      const {category,city,pageToken} = req.body || {};
      if(typeof category !== 'string'||typeof city !== 'string'||!category.trim()||!city.trim()||category.length>100||city.length>120||(pageToken!=null&&(typeof pageToken!=='string'||pageToken.length>4096))) return res.status(400).json({error:'Informe categoria e cidade válidas.'});
      const payload={textQuery:category.trim()+' em '+city.trim()+', Brasil',languageCode:'pt-BR',regionCode:'BR',pageSize:20,...(pageToken?{pageToken}:{})};
      const upstream=await fetchImpl('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':apiKey,'X-Goog-FieldMask':FIELDS},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
      if(!upstream.ok) return res.status(upstream.status===429?429:502).json({error:upstream.status===429?'Limite da API atingido. Tente mais tarde.':'Google Places recusou a consulta. Verifique faturamento, chave e habilitação da API.'});
      const result=await upstream.json();
      return res.status(200).json({places:(result.places||[]).map(p=>({id:p.id,name:p.displayName?.text||'',address:p.formattedAddress||'',status:p.businessStatus||'',website:p.websiteUri||null,phone:p.nationalPhoneNumber||null,rating:p.rating??null,reviews:p.userRatingCount??null,maps:p.googleMapsUri||null,category:p.primaryTypeDisplayName?.text||'',attributions:p.attributions||[]})),nextPageToken:result.nextPageToken||null});
    } catch(e) {return res.status(502).json({error:'Não foi possível consultar os estabelecimentos.'});}
  };
}
