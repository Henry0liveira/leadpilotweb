const socialHosts=['instagram.com','facebook.com','fb.com','tiktok.com','linkedin.com','youtube.com','youtu.be','wa.me','whatsapp.com','linktr.ee','beacons.ai','ifood.com.br'];
export function siteStatus(value,checked=false){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return 'unknown';return socialHosts.some(s=>u.hostname===s||u.hostname.endsWith('.'+s))?'social':'present';}catch{return checked&&!String(value||'').trim()?'absent':'unknown';}}
export const hasRealSite=value=>siteStatus(value)==='present';
export function celularBR(value){const s=String(value||'').trim();if(!/^[+\d\s().-]+$/.test(s))return '';let d=s.replace(/\D/g,'');if(d.length===13&&d.startsWith('55'))d=d.slice(2);return /^[1-9][1-9]9\d{8}$/.test(d)?'55'+d:'';}
export function formatCelular(value){const n=celularBR(value);return n?'('+n.slice(2,4)+') '+n.slice(4,9)+'-'+n.slice(9):'';}
export const whatsappLink=value=>{const n=celularBR(value);return n?'https://wa.me/'+n:'';};
export function scorePlace(p){const status=siteStatus(p.website,p.websiteChecked===true),reasons=[];let score=0;const add=(v,r)=>{score+=v;reasons.push(r);};if(status==='absent')add(55,'Sem site confirmado');else if(status==='social')add(45,'Rede social informada');else if(status==='present')add(-25,'Site próprio informado');if(p.phone)add(18,'Telefone informado');if(celularBR(p.phone))add(10,'Celular brasileiro');if(Number.isFinite(p.reviews)&&p.reviews>0&&p.reviews<30)add(8,'Poucas avaliações');if(Number.isFinite(p.rating)&&p.rating>=4)add(5,'Boa avaliação');const total=Math.max(0,Math.min(100,Math.round(score)));return {score:total,reasons,status,priority:total>=70?'Quente':total>=40?'Morno':'Frio'};}
const networkHosts=['instagram.com','facebook.com','fb.com','tiktok.com','linkedin.com','youtube.com','youtu.be','threads.net','x.com','twitter.com','pinterest.com'];
const platformHosts=['wa.me','whatsapp.com','linktr.ee','beacons.ai','ifood.com.br','rappi.com.br','bio.site'];
export function linkKind(value){
 try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return 'unknown';const h=u.hostname.toLowerCase();if(networkHosts.some(x=>h===x||h.endsWith('.'+x)))return 'social';if(platformHosts.some(x=>h===x||h.endsWith('.'+x)))return 'platform';return 'website';}catch{return 'unknown';}
}
export function digitalPresence(p,source='places'){
 const links=[...new Set([p.website,p.websiteUrl,p.websiteUri,...(Array.isArray(p.websiteLinks)?p.websiteLinks:[]),...(Array.isArray(p.socialLinks)?p.socialLinks:[])].filter(v=>typeof v==='string'&&v.trim()))];
 const ownWebsite=links.find(x=>linkKind(x)==='website')||null,socialLinks=links.filter(x=>linkKind(x)==='social'),platformLinks=links.filter(x=>linkKind(x)==='platform');
 const checked=source==='places'||p.websiteChecked===true;
 return {ownWebsite,socialLinks,platformLinks,websiteState:ownWebsite?'present':checked&&!links.some(x=>linkKind(x)==='unknown')?'absent':'unknown',socialState:socialLinks.length?'present':p.socialChecked===true?'absent':'unknown'};
}
export function enrich(p,source='places'){return {...p,...digitalPresence(p,source),googlePlaceId:source==='places'?p.id:null,cellular:celularBR(p.phone)};}
