import {rows,rest,workspaceOwner,add} from './supabase.js';
import {generateDedupeKey,isSameLead} from './importer.js';
export function matchCandidates(list,lead){const key=generateDedupeKey(lead);return list.filter(x=>isSameLead(x,lead)||(key&&x.dedupe_key===key));}
export function promotionPatch(now=new Date()){return {selected_for_crm:true,selected_at:now.toISOString(),pipeline_stage:'new'};}
export async function promoteLead(id,{getOwner=workspaceOwner,getRows=rows,write=rest}={}){
 const owner=await getOwner();const params={id:'eq.'+id,owner_id:'eq.'+owner};const records=await getRows('leads',{...params,select:'id,selected_for_crm,pipeline_stage',limit:1});
 if(!records.length)throw Error('Lead não encontrado no workspace.');
 if(records[0].selected_for_crm)return {id,already:true};
 const result=await write('leads',{method:'PATCH',params:{...params,selected_for_crm:'eq.false'},body:promotionPatch()});
 if(result.data?.length===1)return {id,already:false};
 const again=await getRows('leads',{...params,select:'id,selected_for_crm',limit:1});
 if(again[0]?.selected_for_crm)return {id,already:true};
 throw Error('O banco não confirmou o envio ao CRM.');
}
export async function findExistingLead(lead,{getOwner=workspaceOwner,getRows=rows}={}){
 const owner=await getOwner(),select='id,business_name,phone,address,google_place_id,google_maps_url,dedupe_key,selected_for_crm,pipeline_stage';
 const common={owner_id:'eq.'+owner,select};
 if(lead.google_place_id){const exact=await getRows('leads',{...common,google_place_id:'eq.'+lead.google_place_id,limit:2});if(exact.length===1)return exact[0];if(exact.length>1)throw Error('Há mais de um registro com este identificador. Revise no CRM.');}
 const key=generateDedupeKey(lead);if(!key&&!lead.phone&&!lead.address)return null;
 // Match independently supplied contact details against the workspace's existing records.
 // Page through the full set, rather than relying on the first 1,000 dashboard records.
 const matches=[];for(let offset=0;;offset+=500){const part=await getRows('leads',{...common,order:'id.asc',limit:500,offset});matches.push(...matchCandidates(part,lead));if(part.length<500)break;}
 if(matches.length>1)throw Error('Mais de um cadastro corresponde aos dados. Revise os candidatos antes de enviar.');
 return matches[0]||null;
}
export function searchKeyword(value){return String(value||'').trim().replace(/\s+/g,' ').slice(0,100);}

export const REFERENCE_NAME='Estabelecimento Google Maps';
export function referenceFields(placeId,now=new Date()){
 if(typeof placeId!=='string'||!/^[A-Za-z0-9_-]{5,200}$/.test(placeId))throw Error('Identificador Google Places inválido.');
 return {business_name:REFERENCE_NAME,google_place_id:placeId,dedupe_key:'google:'+placeId,source:'manual',selected_for_crm:true,selected_at:now.toISOString(),pipeline_stage:'new',website_status:'unknown'};
}
export async function savePlaceReference(placeId,{find=findExistingLead,insert=add,promote=promoteLead,isActive=()=>true}={}){
 const fields=referenceFields(placeId);
 const existing=await find({google_place_id:placeId});if(!isActive())throw Error('Sessão ou tela alterada.');
 if(existing){if(!existing.selected_for_crm)await promote(existing.id);return {id:existing.id,already:!!existing.selected_for_crm};}
 try{const records=await insert('leads',fields);if(!records?.[0]?.id)throw Error('Cadastro não confirmado.');return {id:records[0].id,already:false};}
 catch(error){if(!isActive())throw error;const concurrent=await find({google_place_id:placeId});if(!concurrent||!isActive())throw error;if(!concurrent.selected_for_crm)await promote(concurrent.id);return {id:concurrent.id,already:!!concurrent.selected_for_crm};}
}
