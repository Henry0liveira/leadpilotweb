// Public, visible business contact fields only.
export function visiblePhone(raw,explicit=false){
 const s=String(raw||'').replace(/[\uE000-\uF8FF]/g,' ').trim();
 const candidates=explicit?[s]:[...s.matchAll(/(?:\+55[\s.-]*)?(?:\(\d{2}\)|\b\d{2})[\s.-]*9?\d{4}[\s.-]?\d{4}(?!\d)|\b(?:0800|0300)[\s.-]*\d{3}[\s.-]*\d{4}(?!\d)/g)].map(m=>m[0]);
 for(const val of candidates){let v=val.replace(/^tel:/i,'');try{v=decodeURIComponent(v)}catch{}const n=v.replace(/\D/g,'');if(/^(?:55)?[1-9]\d(?:9\d{8}|[2-5]\d{7})$/.test(n)||/^(0800|0300)\d{7}$/.test(n))return v.trim();}
 return '';
}
export function visibleWebsite(raw){
 try{if(!raw)return '';let u=new URL(raw,'https://www.google.com');if(/(^|\.)google\.[a-z.]+$/i.test(u.hostname)&&u.pathname==='/url'){const target=u.searchParams.get('q')||u.searchParams.get('url');if(!target)return '';u=new URL(target);}
 const h=u.hostname.toLowerCase();if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return '';
 if(h==='sites.google.com')return u.href;
 if(/(^|\.)(google\.[a-z.]+|googleusercontent\.com|gstatic\.com|ggpht\.com|googleapis\.com|googleadservices\.com|goo\.gl|g\.co|withgoogle\.com|schema\.org)$/i.test(h))return '';
 return u.href;}catch{return '';}
}
export function normalizeContact(raw){
 const {phoneCandidates=[],phoneTexts=[],websiteCandidates=[],...rest}=raw;
 const phone=phoneCandidates.map(t=>visiblePhone(t,true)||visiblePhone(t)).find(Boolean)||phoneTexts.map(t=>visiblePhone(t)).find(Boolean)||null;
 const website=websiteCandidates.map(visibleWebsite).find(Boolean)||null;
 return {...rest,phone,website,phoneChecked:!!phone||raw.detailLoaded===true,websiteChecked:!!website||raw.detailLoaded===true};
}
