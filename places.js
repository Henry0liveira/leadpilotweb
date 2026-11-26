import {accessToken} from './supabase.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=x=>{try{const u=new URL(x);return u.protocol==='https:'||u.protocol==='http:'?u.href:''}catch{return ''}};
let owner=null, view='', redraw=()=>{}, request=0;
let s=initial();
function initial(){return {city:'Pindamonhangaba, SP',category:'',only:true,places:[],token:null,busy:false,error:'',searched:false,last:null};}
export function setPlacesContext(id,nextView,render){
  if(owner!==id||view==='prospects'&&nextView!=='prospects'){request++;s=initial();}
  owner=id;view=nextView;redraw=render;
}
export function placesMarkup(){
 const shown=s.places.filter(p=>!s.only||!p.website);
 return '<section class="panel" style="margin-bottom:20px;padding:20px"><div class="panel-header" style="padding:0 0 16px"><div><div class="panel-kicker">GOOGLE PLACES · PESQUISA AO VIVO</div><h3>Buscar estabelecimentos</h3><p>Consulte negócios por localização e segmento.</p></div></div>'+
 '<form id="places-search-form" style="display:flex;gap:12px;flex-wrap:wrap;align-items:end"><label style="flex:1;min-width:170px">Cidade / região<input name="city" required maxlength="120" value="'+esc(s.city)+'" placeholder="Pindamonhangaba, SP" style="width:100%;margin-top:5px"></label><label style="flex:1;min-width:170px">Segmento<input name="category" required maxlength="100" value="'+esc(s.category)+'" placeholder="Restaurantes, clínicas, oficinas..." style="width:100%;margin-top:5px"></label><button class="btn primary" type="submit" '+(s.busy?'disabled':'')+'>'+(s.busy?'Buscando…':'Buscar no Google Places')+'</button></form>'+
 '<label style="display:flex;gap:8px;align-items:center;margin:16px 0"><input type="checkbox" id="places-only" '+(s.only?'checked':'')+'> Somente sem site informado</label>'+
 (s.error?'<p role="alert" style="color:#fca5a5">'+esc(s.error)+'</p>':'')+
 (s.searched?'<p aria-live="polite">'+shown.length+' resultados exibidos de '+s.places.length+' retornados nesta página.</p>':'')+
 (shown.length?'<div class="prospects-table-wrap"><table class="data-table"><thead><tr><th>ESTABELECIMENTO</th><th>TELEFONE</th><th>WEBSITE</th><th>AVALIAÇÃO</th><th>GOOGLE MAPS</th></tr></thead><tbody>'+shown.map(p=>'<tr><td><strong>'+esc(p.name)+'</strong><br><small>'+esc(p.address)+'</small></td><td>'+esc(p.phone||'Não informado')+'</td><td>'+(safe(p.website)?'<a href="'+esc(safe(p.website))+'" target="_blank" rel="noopener noreferrer">Abrir site</a>':'Sem site informado')+'</td><td>'+esc(p.rating??'—')+' ('+esc(p.reviews??0)+')</td><td>'+(safe(p.maps)?'<a href="'+esc(safe(p.maps))+'" target="_blank" rel="noopener noreferrer">Ver no Google Maps</a>':'—')+(p.attributions||[]).map(a=>'<br><small>'+(safe(a.providerUri)?'<a href="'+esc(safe(a.providerUri))+'" target="_blank" rel="noopener noreferrer">'+esc(a.provider)+'</a>':esc(a.provider))+'</small>').join('')+'</td></tr>').join('')+'</tbody></table></div>':'')+
 (s.searched&&!shown.length&&!s.busy?'<p>Nenhum resultado corresponde ao filtro desta página.</p>':'')+
 (s.token?'<button class="btn outline" id="places-next" '+(s.busy?'disabled':'')+' style="margin-top:12px">Próxima página</button>':'')+
 '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center"><span translate="no" style="font-family:Arial,sans-serif;font-weight:600;color:inherit">Google Maps</span><small>Resultados consultados ao vivo, não armazenados no CRM. A ausência de website não comprova que a empresa não possui site.</small></div><small><a href="https://www.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Termos do Google Maps</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacidade</a></small></section>';
}
async function search(next=false){
 if(s.busy||!owner||view!=='prospects')return;
 const q=next?s.last:{city:s.city.trim(),category:s.category.trim()};
 if(!q?.city||!q?.category)return;
 const id=++request;const token=next?s.token:null;
 s.busy=true;s.error='';if(!next){s.places=[];s.token=null;s.searched=false;}redraw();
 try{
  const auth=await accessToken();
  const res=await fetch('/api/places',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+auth},body:JSON.stringify({...q,...(token?{pageToken:token}:{})}),cache:'no-store'});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.error||'Não foi possível consultar a API.');
  if(id!==request)return;
  s.places=data.places||[];s.token=data.nextPageToken||null;s.searched=true;s.last=q;
 }catch(e){if(id===request)s.error=e.message||'Erro ao consultar.';}
 finally{if(id===request){s.busy=false;redraw();}}
}
document.addEventListener('input',e=>{if(e.target.form?.id==='places-search-form'&&['city','category'].includes(e.target.name))s[e.target.name]=e.target.value;});
document.addEventListener('change',e=>{if(e.target.id==='places-only'){s.only=e.target.checked;redraw();}});
document.addEventListener('submit',e=>{if(e.target.id!=='places-search-form')return;e.preventDefault();const f=new FormData(e.target);s.city=String(f.get('city')||'');s.category=String(f.get('category')||'');void search();});
document.addEventListener('click',e=>{if(e.target.closest('#places-next')){e.preventDefault();void search(true);}});
