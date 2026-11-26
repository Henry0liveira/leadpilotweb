import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteStatus} from '../website-status.mjs';
import {createHandler} from '../api/maps-scan.mjs';
test('no blank-field false positives',()=>{assert.equal(websiteStatus({website:null}),'unknown');assert.equal(websiteStatus({websiteChecked:false}),'unknown');assert.equal(websiteStatus({websiteChecked:true}),'not_found');assert.equal(websiteStatus({website:'https://instagram.com/example'}),'social_only');assert.equal(websiteStatus({website:'https://instagram.com.example.org'}),'website');});
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test'};
const req={method:'POST',headers:{authorization:'Bearer aaa.bbb.ccc'},body:{city:'Taubaté',category:'Cafés'}};
function res(){return {code:0,data:null,setHeader(){},status(c){this.code=c;return this},json(d){this.data=d;return this}}}
test('scan requires workspace membership',async()=>{let n=0;const r=res();await createHandler({env,fetchImpl:async()=>({ok:true,json:async()=>++n===1?{id:' outsider'}:[]}),scan:()=>{throw Error('unexpected')}})(req,r);assert.equal(r.code,403);});
test('scan works without Google Places key',async()=>{let n=0;const r=res();await createHandler({env,fetchImpl:async()=>({ok:true,json:async()=>++n===1?{id:'member'}:[{user_id:'member'}]}),scan:async x=>{assert.equal(x.city,'Taubaté');return {places:[{name:'Test'}]}}})(req,r);assert.equal(r.code,200);assert.equal(r.data.places[0].name,'Test');});

import {ScanError} from '../lib/maps-scan.mjs';
test('source errors are distinct and do not expose secrets',async()=>{let n=0;const r=res();await createHandler({env,fetchImpl:async()=>({ok:true,json:async()=>++n===1?{id:'member-error'}:[{user_id:'member-error'}]}),scan:async()=>{throw new ScanError('BROWSER_START_FAILED','O Chromium não iniciou no servidor.')}})(req,r);assert.equal(r.code,502);assert.equal(r.data.code,'BROWSER_START_FAILED');});

import {mergeCard} from '../lib/maps-scan.mjs';
test('virtualized card updates preserve known contacts and ratings',()=>{const m=mergeCard({phone:'123',website:'https://example.com',websiteChecked:true,rating:4.5,address:'Rua A'},{phone:null,website:null,websiteChecked:false,rating:null,address:''});assert.equal(m.phone,'123');assert.equal(m.website,'https://example.com');assert.equal(m.websiteChecked,true);assert.equal(m.rating,4.5);assert.equal(m.address,'Rua A');});
test('scan validates limit and mode before upstream',async()=>{const r=res();await createHandler({env,fetchImpl:()=>{throw Error('unexpected')}})({...req,body:{...req.body,limit:999}},r);assert.equal(r.code,400);});
test('default scan prioritizes contact completion with limit 100',async()=>{const r=res();let n=0;await createHandler({env,fetchImpl:async()=>({ok:true,json:async()=>++n===1?{id:'member-volume'}:[{user_id:'member-volume'}]}),scan:async x=>{assert.equal(x.limit,100);assert.equal(x.detailMode,'complete');return {places:[]}}})(req,r);assert.equal(r.code,200);});

import {visiblePhone,visibleWebsite,normalizeContact} from '../lib/maps-contact.mjs';
test('Brazilian business phones are parsed from visible text',()=>{assert.equal(visiblePhone('Aberto · (12) 99999-1234'),'(12) 99999-1234');assert.equal(visiblePhone('+551234567890',true),'+551234567890');assert.equal(visiblePhone('CEP 12400-000'),'');assert.equal(visiblePhone('4,9 (185 avaliações)'),'');});
test('website actions resolve Google redirect and reject internal URLs',()=>{assert.equal(visibleWebsite('/url?q=https%3A%2F%2Fexample.org%2F'),'https://example.org/');assert.equal(visibleWebsite('https://sites.google.com/view/test'),'https://sites.google.com/view/test');assert.equal(visibleWebsite('https://www.google.com/maps/place/test'),'');});
test('unread cards do not turn into missing contacts',()=>{const a=normalizeContact({detailLoaded:false});assert.equal(a.websiteChecked,false);assert.equal(a.phoneChecked,false);const b=normalizeContact({detailLoaded:true});assert.equal(b.websiteChecked,true);assert.equal(b.phoneChecked,true);const d=normalizeContact({phoneTexts:['(12) 99999-1234'],websiteCandidates:['https://example.org']});assert.ok(d.phone&&d.website&&d.phoneChecked&&d.websiteChecked);});
