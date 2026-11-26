// Adapted from the visible-card/detail approach in extratorleads by GustavoN-S.
// No hidden RPC interception, CAPTCHA bypass or automatic persistence.
import {websiteStatus} from '../website-status.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const feed='div[role="feed"],div[aria-label^="Resultados"],div[aria-label^="Results"]';
function readCards(){
 const root=document.querySelector('div[role="feed"],div[aria-label^="Resultados"],div[aria-label^="Results"]');
 if(!root)return [];
 return [...root.querySelectorAll('a[href*="/maps/place/"]')].map(a=>{
  const c=a.closest('div.Nv2PK,div.THOPZb,div.bfdHYd')||a.parentElement;
  const txt=s=>c.querySelector(s)?.textContent?.trim()||'';
  const rows=[...c.querySelectorAll('div.W4Efsd')].map(x=>x.textContent.trim());
  const tel=c.querySelector('a[href^="tel:"]')?.getAttribute('href')?.slice(4)||txt('span.UsdlK');
  const w=c.querySelector('a[data-value="Website"],a[data-value="Site"],a[aria-label^="Visitar o site"],a[aria-label^="Visit website"]')?.href||null;
  const name=txt('div.qBF1Pd,div.fontHeadlineSmall')||a.getAttribute('aria-label')||'';
  const rating=Number.parseFloat(txt('span.MW4etd').replace(',','.'));
  const reviews=Number.parseInt(txt('span.UY7F9').replace(/\D/g,''),10);
  return {name,maps:a.href,phone:tel||null,website:w,websiteChecked:!!w,rating:Number.isFinite(rating)?rating:null,reviews:Number.isFinite(reviews)?reviews:null,address:(rows[0]||'').split('·').slice(1).join(' · ').trim(),attributions:[]};
 }).filter(x=>x.name&&x.maps);
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
export class ScanError extends Error{constructor(code,message){super(message);this.code=code;}}
export async function scanMaps({category,city,deadline=Date.now()+40000}){
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
 let stagnant=0;
 const scanDeadline=Math.min(deadline-4000,Date.now()+23000);
 console.info('[maps-scan] result list ready');
 while(results.size<60&&stagnant<4){
  const old=results.size;
  for(const x of await page.evaluate(readCards)){if(isMaps(x.maps)&&results.size<60){const k=keyOf(x),prev=results.get(k);results.set(k,{...x,website:x.website||prev?.website||null,phone:x.phone||prev?.phone||null,websiteChecked:!!(x.website||prev?.website)});}}
  if(Date.now()>=scanDeadline)break;
  stagnant=old===results.size?stagnant+1:0;
  const end=await page.evaluate(sel=>{const f=document.querySelector(sel);if(!f)return true;const t=f.innerText||'';if(/chegou ao fim da lista|reached the end of the list/i.test(t))return true;f.scrollBy(0,Math.max(600,f.clientHeight));return false;},feed);
  if(end)break;
  await pause(1000);
 }
 // Verify a bounded number of missing websites through visible business profiles.
 const detailPage=results.size&&Date.now()<deadline-4500?await browser.newPage():null;
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
 if([...results.values()].some(x=>!x.websiteChecked))notice='Verificação parcial: fichas não concluídas ficam como Não verificado.';
 console.info('[maps-scan] result count',results.size);
 if(!results.size)throw new ScanError('RESULTS_EMPTY','A lista abriu, mas nenhum estabelecimento pôde ser identificado nesta execução.');
 return {places:[...results.values()].map(x=>({...x,id:keyOf(x),websiteStatus:websiteStatus(x)})),notice};
 }catch(e){if(e instanceof ScanError)throw e;console.error('[maps-scan] stage',stage,'error',String(e?.message||'unknown').slice(0,400));if(results.size)return {places:[...results.values()].map(x=>({...x,id:keyOf(x),websiteStatus:websiteStatus(x)})),notice:'Consulta parcial; verificação incompleta.'};throw new ScanError(stage==='browser'?'BROWSER_START_FAILED':stage==='navigation'?'SOURCE_NAVIGATION_FAILED':'RESULTS_UNAVAILABLE',stage==='browser'?'O Chromium não iniciou no servidor.':stage==='navigation'?'Não foi possível abrir o Google Maps no servidor.':'Não foi possível ler os resultados do Google Maps.');}finally{if(browser)await browser.close().catch(()=>{});}
}
