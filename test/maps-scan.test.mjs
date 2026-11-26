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
