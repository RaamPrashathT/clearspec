#!/usr/bin/env node
// Renders the specs once, then builds html/compare.html: every screen at Dense, Standard and Roomy side by side.
// Clicking a box opens that screen at that density in a new tab. "use this" picks a density per screen.
// "Finalize selected" writes wireframes/final/ and a "UI mockups" section into the requirements file.
// Usage: node compare.mjs <wireframesDir> [--flat]
//   --flat  clearspec layout: write the screens and the compare page (as index.html) straight into <wireframesDir>
//           instead of <wireframesDir>/html/compare.html. The web preview opens index.html.
//   <wireframesDir>/specs/app.json and specs/screens/*.json are the input; html/ is the output.
//   <wireframesDir>/source.json (optional): { "requirements": "path relative to the project root" }
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildFinal, applyBlock } from './lib-final.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const FLAT = argv.includes('--flat');
const root = argv.find((a) => !a.startsWith('--')) || 'wireframes';
const PAGE = FLAT ? 'index.html' : 'compare.html';
const rootAbs = path.resolve(root);
const specs = path.join(root, 'specs');
const out = FLAT ? root : path.join(root, 'html');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const BS = String.fromCharCode(92);
const safeJson = (o) => JSON.stringify(o).split('<').join(BS + 'u003c').split(LS).join(BS + 'u2028').split(PS).join(BS + 'u2029');

const r = spawnSync(process.execPath, [path.join(here, 'render.mjs'), specs, out, ...(FLAT ? ['--no-kit'] : [])], { encoding: 'utf8' });
process.stdout.write(r.stdout);
const sd = path.join(specs, 'screens');
const files = fs.existsSync(sd) ? fs.readdirSync(sd).filter((f) => f.endsWith('.json')).sort() : [];
const screens = files.map((f) => readJson(path.join(sd, f))).filter((s) => s?.id);
if (!screens.length) { console.log('ERROR no screens to compare'); process.exit(1); }

const DENS = [['dense', 'Dense'], ['standard', 'Standard'], ['roomy', 'Roomy']];
const docs = {};
for (const s of screens) { try { docs[s.id] = fs.readFileSync(path.join(out, `${s.id}.html`), 'utf8'); } catch { /* render failed */ } }

const rows = screens.map((s) => {
  const keys = Object.keys(s.states || { default: 1 });
  const tags = [...(s.serves || []).map((x) => `<span class="tag">${esc(x)}</span>`), ...(s.edge || []).map((x) => `<span class="tag ec">${esc(x)}</span>`)].join('');
  const sts = keys.length > 1 ? keys.map((k, i) => `<button type="button" data-st="${esc(k)}" aria-pressed="${i === 0}">${esc(s.states?.[k]?.label || k)}</button>`).join('') : '';
  const cols = DENS.map(([d, label]) => `<div class="col" data-d="${d}"><a class="box" href="${esc(s.id)}.html" target="_blank" rel="noopener" title="Open ${esc(s.title)} at ${label} density in a new tab"><div class="shot"></div><span class="hit"></span></a><div class="cap"><b>${label}</b><span class="h"></span><label class="pick"><input type="radio" name="pick-${esc(s.id)}" value="${d}"> use this</label></div></div>`).join('');
  return `<section class="row" data-id="${esc(s.id)}"><header><span class="mid">${esc(s.id)}</span><h2>${esc(s.title)}</h2><div class="tags">${tags}</div><div class="sts">${sts}</div></header><div class="cols">${cols}</div></section>`;
}).join('');

const app = readJson(path.join(specs, 'app.json')) || {};
const invFile = path.join(rootAbs, 'inventory.md');
const data = {
  app, screens, base: path.relative(process.cwd(), rootAbs).split(path.sep).join('/'),
  inventory: fs.existsSync(invFile) ? fs.readFileSync(invFile, 'utf8') : '',
  source: readJson(path.join(rootAbs, 'source.json')),
};
if (!data.source && FLAT) {
  // clearspec layout: <project>/clearspec/<name>/mockups/ next to <project>/clearspec/<name>/REQUIREMENTS.md
  const req = path.join(rootAbs, '..', 'REQUIREMENTS.md');
  if (fs.existsSync(req)) data.source = { requirements: path.relative(process.cwd(), req).split(path.sep).join('/') };
}

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wireframes: pick a density</title><style>
:root{--ink:#161616;--mute:#6f6f6f;--line:#d6d6d6;--fill:#f4f4f4;--page:#ececec}*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;background:var(--page);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.top{position:sticky;top:0;z-index:20;background:#161616;color:#fff;padding:10px 16px;display:flex;flex-wrap:wrap;gap:8px 22px;align-items:center}
.top h1{margin:0;font-size:15px}.seg{display:flex;align-items:center;gap:2px}.seg>span{color:#9a9a9a;font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-right:6px}
.top button{font:600 12.5px/1 inherit;color:#cfcfcf;background:transparent;border:0;border-radius:8px;padding:7px 10px;cursor:pointer}.top button[aria-pressed="true"]{background:#fff;color:#161616}
.top .go{background:#fff;color:#161616;padding:9px 14px}.top .go:hover{background:#e8e8e8}.top .go:disabled{opacity:.6;cursor:wait}.top .push{margin-left:auto;display:flex;gap:12px;align-items:center}
#msg{font-size:12.5px;color:#cfcfcf;max-width:520px}#msg.err{color:#ffb4a8}#msg.ok{color:#a8e6b8}
main{padding:16px;display:grid;gap:20px;max-width:1700px;margin:0 auto}
.row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.row header{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}.row h2{margin:0;font-size:16px}
.mid{font:600 12px/1 ui-monospace,Menlo,Consolas,monospace;border:1px solid var(--line);padding:4px 7px;border-radius:6px}
.tags{display:flex;flex-wrap:wrap;gap:6px}.tag{font:600 11.5px/1 ui-monospace,Menlo,Consolas,monospace;background:#e6e6e6;padding:4px 6px;border-radius:5px}.tag.ec{background:transparent;border:1px dashed var(--mute)}
.sts{margin-left:auto;display:flex;flex-wrap:wrap;gap:4px}.sts button{font:600 12px/1 inherit;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 10px;cursor:pointer}.sts button[aria-pressed="true"]{background:#161616;color:#fff;border-color:#161616}
.cols{display:grid;gap:14px;grid-template-columns:repeat(3,minmax(0,1fr));align-items:start}
.box{position:relative;display:block;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;cursor:pointer;color:inherit;text-decoration:none;transition:box-shadow .12s,border-color .12s}
.box:hover{border-color:#161616;box-shadow:0 6px 20px rgba(0,0,0,.14)}
.shot{position:relative;overflow:hidden;min-height:120px}.shot iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;background:#fff;pointer-events:none}
.hit{position:absolute;inset:0}
.cap{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin-top:6px}.cap .h,.pick{white-space:nowrap}.cap .h{color:var(--mute);font-size:12.5px}.pick{margin-left:auto;display:flex;gap:6px;align-items:center;font-weight:600;cursor:pointer}
.col.sel .box{outline:3px solid #161616;outline-offset:-1px}.col.sel .cap b::after{content:" \\2713"}
</style></head><body>
<div class="top"><h1>Pick a density per screen</h1>
<div class="seg"><span>View</span><button data-v="desktop" aria-pressed="true">Desktop</button><button data-v="tablet" aria-pressed="false">Tablet</button><button data-v="mobile" aria-pressed="false">Mobile</button></div>
<div class="seg"><span>Use for all</span><button class="all" data-all="dense" aria-pressed="false">Dense</button><button class="all" data-all="standard" aria-pressed="false">Standard</button><button class="all" data-all="roomy" aria-pressed="false">Roomy</button></div>
<div class="push"><span id="msg"></span><button class="go" id="fin">Finalize selected (<span id="cnt">0</span>/${screens.length})</button></div></div>
<main>${rows}</main>
<script id="docs" type="application/json">${safeJson(docs)}</script>
<script id="data" type="application/json">${safeJson(data)}</script>
<script>
${buildFinal.toString()}
${applyBlock.toString()}
(()=>{const $=(s,r=document)=>[...r.querySelectorAll(s)];const DOCS=JSON.parse(document.getElementById('docs').textContent),DATA=JSON.parse(document.getElementById('data').textContent);
const W={desktop:1200,tablet:820,mobile:390},H={desktop:700,tablet:800,mobile:760};let view='desktop';const states={},heights=new Map();
const href=(id,d)=>id+'.html?density='+d+'&view='+view+(states[id]?'&state='+encodeURIComponent(states[id]):'');
function post(f){const row=f.closest('.row'),d=f.closest('.col').dataset.d;try{f.contentWindow.postMessage({wf:1,embed:1,view,density:d,state:states[row.dataset.id]||null},'*')}catch(_){}}
function fit(){$('.col').forEach(col=>{const f=$('iframe',col)[0];if(!f)return;const sh=$('.shot',col)[0],w=W[view],h=Math.min(heights.get(f)||H[view],2400),sc=sh.clientWidth/w;f.style.width=w+'px';f.style.height=h+'px';f.style.transform='scale('+sc+')';sh.style.height=Math.round(h*sc)+'px'})}
function links(){$('.row').forEach(r=>$('.col',r).forEach(c=>{$('a.box',c)[0].href=href(r.dataset.id,c.dataset.d)}))}
$('.row').forEach(r=>$('.col',r).forEach(c=>{const f=document.createElement('iframe');f.title=r.dataset.id+' '+c.dataset.d;f.tabIndex=-1;f.srcdoc=DOCS[r.dataset.id]||'<p>render failed</p>';f.addEventListener('load',()=>post(f));$('.shot',c)[0].appendChild(f)}));
addEventListener('message',e=>{if(!e.data||e.data.wfh==null)return;const f=$('iframe').find(x=>x.contentWindow===e.source);if(!f)return;heights.set(f,e.data.wfh);const h=$('.h',f.closest('.col'))[0];h.textContent='\\u2248 '+e.data.wfh+' px tall';fit()});
const press=(sel,attr,val)=>$(sel).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[attr]===val)));
const sel=()=>{const o={};$('.row').forEach(r=>{const c=r.querySelector('input:checked');if(c)o[r.dataset.id]=c.value});return o};
const say=(t,kind)=>{const m=document.getElementById('msg');m.textContent=t||'';m.className=kind||''};
function refreshSel(){$('.col').forEach(c=>c.classList.toggle('sel',!!c.querySelector('input:checked')));const s=sel();document.getElementById('cnt').textContent=Object.keys(s).length;say('');try{localStorage.setItem('wf-sel',JSON.stringify(s))}catch(_){}}
async function put(dir,path,text){const parts=path.split('/');let d=dir;for(const p of parts.slice(0,-1))d=await d.getDirectoryHandle(p,{create:true});const fh=await d.getFileHandle(parts[parts.length-1],{create:true});const w=await fh.createWritable();await w.write(text);await w.close()}
async function readText(dir,path){const parts=path.split('/');let d=dir;for(const p of parts.slice(0,-1))d=await d.getDirectoryHandle(p);const fh=await d.getFileHandle(parts[parts.length-1]);return (await fh.getFile()).text()}
async function finalize(){
 const picks=sel(),missing=DATA.screens.filter(s=>!picks[s.id]);
 if(missing.length){say('Pick a density for every screen first ('+missing.length+' left).','err');return}
 if(!window.showDirectoryPicker){say('This browser cannot save to a folder. Use Chrome or Edge, or run assemble.mjs.','err');return}
 let root;try{root=await window.showDirectoryPicker({mode:'readwrite'})}catch(e){say('Cancelled.','');return}
 const btn=document.getElementById('fin');btn.disabled=true;
 try{
  let wf=root;try{for(const seg of DATA.base.split('/'))wf=await wf.getDirectoryHandle(seg)}catch(e){say('Pick the project folder (the one that contains "'+DATA.base.split('/')[0]+'/').','err');return}
  const res=buildFinal({app:DATA.app,specs:DATA.screens,picks,inventory:DATA.inventory,date:new Date().toISOString().slice(0,10),base:DATA.base});
  try{await wf.removeEntry('final',{recursive:true})}catch(e){}
  for(const f of res.files)await put(wf,'final/'+f.path,f.text);
  for(const s of DATA.screens){const h=(DOCS[s.id]||'').replace(/(<body[^>]*data-density=")[a-z]+(")/,'$1'+picks[s.id]+'$2');await put(wf,'final/html/'+s.id+'.html',h)}
  let msg='Saved '+DATA.screens.length+' screens to '+DATA.base+'/final/.';
  if(DATA.source&&DATA.source.requirements){try{const old=await readText(root,DATA.source.requirements);await put(root,DATA.source.requirements,applyBlock(old,res.block));msg+=' Added a "UI mockups" section to '+DATA.source.requirements+'.'}catch(e){msg+=' Could not update '+DATA.source.requirements+' ('+e.message+').'}}
  else msg+=' No requirements file was recorded, so nothing was appended.';
  say(msg,'ok')
 }catch(e){say('Failed: '+e.message,'err')}finally{btn.disabled=false}}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.v){view=b.dataset.v;press('[data-v]','v',view);heights.clear();$('iframe').forEach(post);links();fit()}
 else if(b.dataset.st){const r=b.closest('.row');states[r.dataset.id]=b.dataset.st;$('[data-st]',r).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('iframe',r).forEach(post);links()}
 else if(b.dataset.all){$('.row').forEach(r=>{const i=r.querySelector('input[value="'+b.dataset.all+'"]');if(i)i.checked=true});press('.all','all',b.dataset.all);refreshSel()}
 else if(b.id==='fin'){finalize()}});
document.addEventListener('change',e=>{if(e.target.type==='radio')refreshSel()});
try{const s=JSON.parse(localStorage.getItem('wf-sel')||'{}');Object.entries(s).forEach(([id,v])=>{const i=document.querySelector('.row[data-id="'+id+'"] input[value="'+v+'"]');if(i)i.checked=true});refreshSel()}catch(_){}
addEventListener('resize',fit);links();fit();window.__wf={sel,finalize};})();
</script>
</body></html>`;
fs.writeFileSync(path.join(out, PAGE), page);
console.log(`compare: ${screens.length} screens x 3 densities -> ${out}/${PAGE}`);
process.exit(r.status || 0);
