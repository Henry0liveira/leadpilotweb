const socialHosts=['instagram.com','facebook.com','fb.com','tiktok.com','linkedin.com','youtube.com','youtu.be','wa.me','whatsapp.com','linktr.ee','beacons.ai','ifood.com.br'];
export function websiteStatus(p){
 let host='';
 try{const u=new URL(p.website);if(['http:','https:'].includes(u.protocol))host=u.hostname.toLowerCase().replace(/^www\./,'');}catch{}
 if(host)return socialHosts.some(x=>host===x||host.endsWith('.'+x))?'social_only':'website';
 return p.websiteChecked===true?'not_found':'unknown';
}
export function websiteLabel(p){return {website:'Site informado',social_only:'Rede social informada',not_found:'Sem site na ficha',unknown:'Não verificado'}[websiteStatus(p)];}
