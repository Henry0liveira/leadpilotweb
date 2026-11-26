import {cp,mkdir,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const url=String(process.env.SUPABASE_URL||''),key=String(process.env.SUPABASE_PUBLISHABLE_KEY||'');
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))throw Error('SUPABASE_URL inválida');
if(!key.startsWith('sb_publishable_')&&!(key.startsWith('eyJ')&&JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role==='anon'))throw Error('Use somente chave pública anon');
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const f of ['index.html','styles.css','app.js','supabase.js','importer.js','kanban.js','kanban.css','orbyta.css','orbyta.js','places.js','leadscore.js','website-status.mjs']){if(f.endsWith('.js'))execFileSync(process.execPath,['--check',f],{stdio:'inherit'});await cp(f,'dist/'+f);}
execFileSync(process.execPath,['--test','test/places.test.mjs','test/leadscore.test.mjs','test/maps-scan.test.mjs'],{stdio:'inherit'});
await writeFile('dist/config.js','window.LEADPILOT_CONFIG='+JSON.stringify({url:url.replace(/\/$/,''),key}).replace(/</g,'\\u003c')+';\n');
