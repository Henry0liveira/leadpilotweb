// Adapted from the visible-card/detail approach in extratorleads by GustavoN-S.
// No hidden RPC interception, CAPTCHA bypass or automatic persistence.
import {websiteStatus} from '../website-status.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const feed='div[role="feed"],div[aria-label^="Resultados"],div[aria-label^="Results"]';
function readCards(){
 const root=document.querySelector('div[role="feed"],div[aria-label^="Resultados"],div[aria-label^="Results"]');
 if(!root)return [];
 return [...root.querySelectorAll('a.hfpxzc,a[href*="/maps/place/"]')].map(a=>{
  let c=a.closest('div.Nv2PK,div.THOPZb,div.bfdHYd');if(!c){c=a.parentElement;for(let i=0,p=c;i<3&&p;i++,p=p.parentElement){if(p.querySelector('a[href]:not([href*="/maps/place/"])')){c=p;break;}}}if(!c)return null;
  const txt=s=>c.querySelector(s)?.textContent?.trim()||'';
  const rows=[...c.querySelectorAll('div.W4Efsd')].map(x=>x.textContent.trim());
  const tel=c.querySelector('a[href^="tel:"]')?.getAttribute('href')?.slice(4)||txt('span.UsdlK');
  const w=c.querySelector('a[data-value="Website"],a[data-value="Site"],a[aria-label^="Visitar o site"],a[aria-label^="Visit website"],a.lcr4fd,div.Rwjeuc a[href]')?.href||null;
  let website=null;try{const u=new URL(w);if(['http:','https:'].includes(u.protocol)&&!/(^|\.)google\.(com|com\.br)$/.test(u.hostname))website=u.href;}catch{}
  const name=txt('div.qBF1Pd,div.fontHeadlineSmall')||a.getAttribute('aria-label')||'';
  const info=rows.find(r=>r.includes('·'))||rows[0]||'';
  const pieces=info.split('·').map(x=>x.trim()).filter(Boolean);
  const rating=Number.parseFloat(txt('span.MW4etd').replace(',','.'));
  const reviews=Number.parseInt(txt('span.UY7F9').replace(/\D/g,''),10);
  return {name,maps:a.href,phone:tel||null,website,websiteChecked:!!website,rating:Number.isFinite(rating)?rating:null,reviews:Number.isFinite(reviews)?reviews:null,address:pieces[1]||'',category:pieces[0]||'',attributions:[]};
 }).filter(x=>x?.name&&x.maps);
}
function readDetail(){
 const p=document.querySelector('div[role="main"][aria-label],div.m6QErb[role="main"]');
 if(!p)return null;
 const name=p.querySelector('h1')?.textContent?.trim();
 const addr=p.querySelector('button[data-item-id="address"]');
 const tel=p.querySelector('button[data-item-id^="phone:tel:"]');
 const website=p.querySelector('a[data-item-id="authority"],a[data-tooltip="Abrir site"],a[data-tooltip="Open website"]')?.href||null;
 if(!name||!addr)return null;
 return {name,address:addr.getAttribute('aria-label')?.replace(/^Endereço:\s*/i,'')||addr.textContent.trim(),phone:tel?.getAttribute('data-item-id')?.split('tel:')[1]||null,website,websiteChecked:true};
}
const keyOf=p=>{try{const u=new URL(p.maps);return u.pathname.split('/data=')[0]+'|'+(u.href.match(/!1s([^!?#]+)/)?.[1]||'');}catch{return p.maps;}};
const isMaps=u=>{try{const p=new URL(u);return p.protocol==='https:'&&['www.google.com','maps.google.com','www.google.com.br'].includes(p.hostname)&&p.pathname.startsWith('/maps/place/');}catch{return false;}};
export function mergeCard(prev,x){return {...prev,...x,address:x.address||prev?.address||'',phone:x.phone||prev?.phone||null,website:x.website||prev?.website||null,websiteChecked:!!(x.website||prev?.website||prev?.websiteChecked||x.websiteChecked),rating:x.rating??prev?.rating??null,reviews:x.reviews??prev?.reviews??null};}
export class ScanError extends Error{constructor(code,message){super(message);this.code=code;}}
export async function scanMaps({category,city,limit=100,detailMode='fast',deadline=Date.now()+40000}){
 let browser,stage='browser';
 const results=new Map();let notice='';
 try{
 const [{default:chromium},{default:puppeteer}]=await Promise.all([import('@sparticuz/chromium'),import('puppeteer-core')]);
 chromium.setGraphicsMode=false;
 browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:'shell',timeout:15000});
 console.info('[maps-scan] browser ready');stage='navigation';
 const page=await browser.newPage();await page.setViewport({width:1280,height:900});
 await page.setExtraHTTPHeaders({'Accept-Language':'pt-BR,pt;q=0.9'});
 const response=await page.goto('https://www.google.com/maps/search/'+encodeURIComponent(category+' em '+city+', Brasil')+'?hl=pt-BR',{waitUntil:'domcontentloaded',timeout:15000});
 if(response?.status()===429||response?.status()===403)throw new ScanError('SOURCE_RESTRICTED','O Google Maps recusou a consulta automatizada.');
 const restricted=await page.evaluate(()=>/consent\.google\.|\/sorry\//i.test(location.href)||!!document.querySelector('iframe[src*="recaptcha"],form#captcha-form'));
 if(restricted)throw new ScanError('SOURCE_RESTRICTED','O Google Maps exige consentimento ou verificação. A extração foi interrompida.');
 stage='results';
 try{await page.waitForSelector(feed,{timeout:12000});}catch{
  const details=await page.evaluate(readDetail);
  if(details&&isMaps(page.url())){const item={...details,maps:page.url(),rating:null,reviews:null,attributions:[]};return {places:[{...item,id:keyOf(item),websiteStatus:websiteStatus(item)}]};}
  throw new ScanError('RESULTS_UNAVAILABLE','Não foi possível localizar a lista de resultados do Google Maps.');
 }
 let stagnant=0,stopReason='deadline';
 const scanDeadline=deadline-(detailMode==='complete'?12000:3500);
 console.info('[maps-scan] result list ready');
 const collect=async()=>{
  for(const x of await page.evaluate(readCards)){
   if(!isMaps(x.maps))continue;
   const k=keyOf(x),prev=results.get(k);
   if(!prev&&results.size>=limit)continue;
   results.set(k,mergeCard(prev,x));
  }
 };
 // Re-check the rendered list, including delayed/virtualized results, before stopping.
 while(Date.now()<scanDeadline){
  const old=results.size;await collect();
  if(results.size>=limit){stopReason='limit';break;}
  const info=await page.evaluate(sel=>{
   const f=document.querySelector(sel);if(!f)return {missing:true};
   const end=[...f.querySelectorAll('span.HlvSq,div.PbZDve p,p.fontBodyMedium > span > span')].some(n=>/chegou ao fim da lista|reached the end of the list|final da lista|llegaste al final/i.test(n.textContent||''));
   const cards=f.querySelectorAll('a.hfpxzc,a[href*="/maps/place/"]');
   const before={height:f.scrollHeight,count:cards.length,last:cards[cards.length-1]?.href||''};
   if(!end)f.scrollTo({top:f.scrollHeight,behavior:'instant'});
   return {...before,end};
  },feed);
  if(info.missing){stopReason='feed_missing';break;}
  if(info.end){await collect();stopReason='end_of_list';break;}
  const wait=Math.min(3500,scanDeadline-Date.now());
  if(wait>0){
   try{await page.waitForFunction((sel,before)=>{
    const f=document.querySelector(sel);if(!f)return false;
    const cards=f.querySelectorAll('a.hfpxzc,a[href*="/maps/place/"]');
    return f.scrollHeight>before.height||cards.length>before.count||(cards.length>0&&cards[cards.length-1]?.href!==before.last)||[...f.querySelectorAll('span.HlvSq,div.PbZDve p,p.fontBodyMedium > span > span')].some(n=>/chegou ao fim da lista|reached the end of the list|final da lista/i.test(n.textContent||''));
   },{timeout:wait,polling:250},feed,info);}catch{}
  }
  await collect();
  stagnant=results.size===old?stagnant+1:0;
  if(results.size>=limit){stopReason='limit';break;}
  if(stagnant>=4){stopReason='stalled';break;}
 }
 await collect();
 if(results.size>=limit)stopReason='limit';
 // Verify a bounded number of missing websites through visible business profiles.
 const detailPage=detailMode==='complete'&&results.size&&Date.now()<deadline-4500?await browser.newPage():null;
 for(const item of results.values()){
  if(!detailPage)break;
  if(Date.now()>deadline-4500)break;
  if(item.websiteChecked&&item.phone)continue;
  try{
   await detailPage.goto(item.maps,{waitUntil:'domcontentloaded',timeout:Math.max(1000,Math.min(4500,deadline-Date.now()-1000))});
   await detailPage.waitForSelector('button[data-item-id="address"]',{timeout:Math.max(500,Math.min(2500,deadline-Date.now()-1000))});
   const d=await detailPage.evaluate(readDetail);
   if(d&&d.name.trim().toLowerCase()===item.name.trim().toLowerCase())Object.assign(item,{address:d.address||item.address,phone:d.phone||item.phone,website:d.website||item.website,websiteChecked:d.websiteChecked});
  }catch{}
 }
 if(['deadline','stalled','feed_missing'].includes(stopReason))notice='Coleta parcial: '+({deadline:'limite de tempo do servidor',stalled:'a lista parou de carregar novos resultados',feed_missing:'lista indisponível'}[stopReason])+'. ';
 if([...results.values()].some(x=>!x.websiteChecked))notice+='Sites sem confirmação ficam como Não verificado.';
 console.info('[maps-scan] result count',results.size);
 if(!results.size)throw new ScanError('RESULTS_EMPTY','A lista abriu, mas nenhum estabelecimento pôde ser identificado nesta execução.');
 return {places:[...results.values()].map(x=>({...x,id:keyOf(x),websiteStatus:websiteStatus(x)})),notice,stopReason};
 }catch(e){if(e instanceof ScanError)throw e;console.error('[maps-scan] stage',stage,'error',String(e?.message||'unknown').slice(0,400));if(results.size)return {places:[...results.values()].map(x=>({...x,id:keyOf(x),websiteStatus:websiteStatus(x)})),notice:'Consulta parcial; verificação incompleta.'};throw new ScanError(stage==='browser'?'BROWSER_START_FAILED':stage==='navigation'?'SOURCE_NAVIGATION_FAILED':'RESULTS_UNAVAILABLE',stage==='browser'?'O Chromium não iniciou no servidor.':stage==='navigation'?'Não foi possível abrir o Google Maps no servidor.':'Não foi possível ler os resultados do Google Maps.');}finally{if(browser)await browser.close().catch(()=>{});}
}
