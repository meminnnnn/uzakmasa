'use strict';
const $ = id => document.getElementById(id);
const LS = 'uzakmasa';
const MAXB = 100 * 1024 * 1024;   // en buyuk dosya
const CH = 2400000;               // parca boyu
let S = {};                 // {db, key}
let infoData = {};          // deviceId -> info
let infoES = null;

const RULES = JSON.stringify({rules:{
  info:{'$k':{'.read':'$k.length >= 32','.write':'$k.length >= 32'}},
  q:{'$k':{'.read':'$k.length >= 32','.write':'$k.length >= 32'}},
  fr:{'$k':{'.read':'$k.length >= 32','.write':'$k.length >= 32'}},
  box:{'$k':{'.read':'$k.length >= 32','.write':'$k.length >= 32'}}
}}, null, 2);

function toast(t, ms = 2600){ const e = $('toast'); e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => e.style.display = 'none', ms); }
function copyText(t){
  const done = () => toast('Kopyalandı');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
  function fallback(){ const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try{ document.execCommand('copy'); done(); }catch(e){ toast('Kopyalanamadı, elle seç'); } a.remove(); }
}
function showM(id){ $(id).classList.add('show'); }
function closeM(id){ $(id).classList.remove('show'); }
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id !== 'mSetup') m.classList.remove('show'); }));

function randKey(){ const a = new Uint8Array(40); crypto.getRandomValues(a); return Array.from(a, x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); }
function load(){ try{ S = JSON.parse(localStorage.getItem(LS)) || {}; }catch(e){ S = {}; } }
function save(){ try{ localStorage.setItem(LS, JSON.stringify(S)); }catch(e){} }

/* ---- Firebase RTDB REST ---- */
const U = p => S.db + p + '.json';
async function dbGet(p){ const r = await fetch(U(p), {cache:'no-store'}); if (!r.ok) throw new Error(r.status); return r.json(); }
async function dbPut(p, v){ const r = await fetch(U(p), {method:'PUT', body:JSON.stringify(v)}); if (!r.ok) throw new Error(r.status); return r.json(); }
async function dbPost(p, v){ const r = await fetch(U(p), {method:'POST', body:JSON.stringify(v)}); if (!r.ok) throw new Error(r.status); return r.json(); }
async function dbDel(p){ try{ await fetch(U(p), {method:'DELETE'}); }catch(e){} }
const P = (root, id) => `/${root}/${S.key}` + (id ? `/${id}` : '');

/* SSE yardımcısı: RTDB event akışını yerel nesneye uygular */
function setAt(obj, path, val){
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return val;
  let o = obj; if (o === null || typeof o !== 'object') obj = o = {};
  for (let i = 0; i < parts.length - 1; i++){ if (o[parts[i]] === null || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
  const last = parts[parts.length - 1];
  if (val === null) delete o[last]; else o[last] = val;
  return obj;
}
function listen(path, onData){
  let cur = null;
  const es = new EventSource(U(path));
  es.addEventListener('put', e => { const d = JSON.parse(e.data); cur = setAt(cur, d.path, d.data); onData(cur); });
  es.addEventListener('patch', e => { const d = JSON.parse(e.data); for (const k in d.data) cur = setAt(cur, (d.path === '/' ? '' : d.path) + '/' + k, d.data[k]); onData(cur); });
  return es;
}

/* ---- Cihaz listesi ---- */
function startInfo(){
  if (infoES) infoES.close();
  infoES = listen(P('info'), d => { infoData = d || {}; render(); });
}
const fmtUp = m => m >= 1440 ? Math.floor(m/1440) + ' gün' : m >= 60 ? Math.floor(m/60) + ' sa' : m + ' dk';
const cls = p => p >= 90 ? 'b' : p >= 75 ? 'w' : '';
function bar(label, right, pct){ pct = Math.max(0, Math.min(100, pct)); return `<div class="row"><div class="lbl"><span>${label}</span><span>${right}</span></div><div class="bar ${cls(pct)}"><i style="width:${pct}%"></i></div></div>`; }
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const I = {
  mon:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  up:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  moon:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  power:'<path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/>',
  home:'<path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  pin:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  phone:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',
  gear:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  trash:'<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  play:'<path d="M6 4l14 8-14 8z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
  bolt:'<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  cursor:'<path d="M5 3l6 17 2.5-7.5L21 10z"/>',
  scroll:'<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
  dbl:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>',
  menu2:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  kb:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  max:'<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>',
  min:'<path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/>',
  bars:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  clip:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
  remote:'<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="8" r="2"/><path d="M12 14v.01M12 18v.01"/>',
  volup:'<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  voldown:'<path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6"/>',
  mute:'<path d="M4 9v6h4l5 4V5L8 9zM22 9l-6 6M16 9l6 6"/>',
  prev:'<path d="M19 5 9 12l10 7zM5 5v14"/>',
  next:'<path d="M5 5l10 7-10 7zM19 5v14"/>',
  pp:'<path d="M5 4l9 8-9 8zM17 5v14M21 5v14"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  term:'<rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="M6 9l3 3-3 3M12 15h5"/>',
  bat:'<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[n]}</svg>`;
const ago = ts => { if (!ts) return ''; const m = Math.round((Date.now() - ts) / 60000); return m < 60 ? m + ' dk önce' : m < 1440 ? Math.round(m / 60) + ' sa önce' : Math.round(m / 1440) + ' gün önce'; };

const wakeAt = {};
function wakeBtn(id){
  const t = wakeAt[id];
  if (t && Date.now() - t < 25*60000) return `<button class="pri wide" disabled>${ic('power')}Uyanıyor… (en fazla 20 dk)</button>`;
  return `<button class="pri wide" data-a="wake">${ic('power')}Uyandır</button>`;
}
async function defaultWake(){
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('wake|' + S.key));
  return 'umw-' + Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
async function wakeDevice(id){
  try{
    const def = await defaultWake();
    const r = await fetch('https://ntfy.sh/' + encodeURIComponent(def), {method:'POST', body:'ac'});
    if (!r.ok) throw new Error(r.status);
    if (S.wake && S.wake !== def) fetch('https://ntfy.sh/' + encodeURIComponent(S.wake), {method:'POST', body:'ac'}).catch(() => {});
    wakeAt[id] = Date.now(); render();
    toast('Uyandırma sinyali gitti. Bilgisayar 20 dk içinde açılır.', 5000);
  }catch(e){ toast('Sinyal gönderilemedi', 4000); }
}
function render(){
  const ids = Object.keys(infoData);
  $('empty').style.display = ids.length ? 'none' : 'block';
  $('grid').innerHTML = ids.map(id => {
    const d = infoData[id] || {};
    const online = d.ts && (Date.now() - d.ts) < 60000;
    const ramU = (d.ramT - d.ramF) || 0, ramP = d.ramT ? ramU / d.ramT * 100 : 0;
    const disks = (d.disks || []).map(k => bar('Disk ' + esc(k.n), `${(k.t - k.f).toFixed(0)} / ${k.t.toFixed(0)} GB`, k.t ? (k.t - k.f) / k.t * 100 : 0)).join('');
    const chips = online
      ? (d.up != null ? `<span class="chip">Açık <b>${fmtUp(d.up)}</b></span>` : '')
        + (d.mode ? `<span class="chip mode">${d.mode === 'out' ? 'Dışarıdayım · 20 dk\'da bir uyanır' : 'Evdeyim'}</span>` : '')
        + (d.bat >= 0 ? `<span class="chip">Pil <b>%${d.bat}</b>${d.ac ? ' · şarjda' : ''}</span>` : '')
        + (d.fg ? `<span class="chip">Ön planda <b>${esc(d.fg)}</b></span>` : '')
      : `<span class="chip">Son görülme <b>${ago(d.ts)}</b></span>`;
    const acts = online
      ? `<button class="pri wide" data-a="screen">${ic('mon')}Ekranı aç</button>
         <button data-a="apps">${ic('grid')}Uygulamalar</button>
         <button data-a="send">${ic('up')}Gönder</button>
         <button data-a="files">${ic('folder')}Dosyalar</button>
         <div class="pair"><button data-a="clip">${ic('clip')}Pano</button><button data-a="pow">${ic('remote')}Kumanda</button><button data-a="term">${ic('term')}Terminal</button></div>
         <div class="pair">${d.mode ? `<button data-a="mode" data-v="${d.mode === 'out' ? 'home' : 'out'}">${d.mode === 'out' ? ic('home') + 'Evdeyim yap' : ic('pin') + 'Dışarıdayım yap'}</button>` : ''}
         <button data-a="hib">${ic('moon')}Uyut</button></div>`
      : wakeBtn(id);
    return `<div class="card" data-id="${esc(id)}">
      <div class="ch"><div class="av">${ic('mon')}</div>
        <div style="flex:1;min-width:0"><h3>${esc(d.name || id)}</h3><div class="sub">${esc(d.os || '')} · ${esc(d.user || '')}</div></div>
        <span class="pill ${online ? 'on' : ''}"><b></b>${online ? 'Çevrimiçi' : 'Uykuda'}</span></div>
      <div class="meta">${chips}</div>
      ${online ? bar('İşlemci', '%' + (d.cpu || 0), d.cpu || 0) + bar('Bellek', `${ramU.toFixed(1)} / ${(d.ramT || 0).toFixed(0)} GB`, ramP) + disks : ''}
      <div class="acts">${acts}</div>
      <div class="foot"><button class="sm ghost danger" data-a="remove">${ic('trash')}Kaldır</button></div>
    </div>`;
  }).join('');
}
$('grid').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const id = b.closest('.card').dataset.id, a = b.dataset.a;
  if (a === 'screen') openViewer(id);
  else if (a === 'send') { sendTarget = id; $('fileIn').click(); }
  else if (a === 'files') openFiles(id);
  else if (a === 'wake') wakeDevice(id);
  else if (a === 'apps') openApps(id);
  else if (a === 'clip') openClip(id);
  else if (a === 'pow') openPow(id);
  else if (a === 'term') openTerm(id);
  else if (a === 'mode'){ cmd(id, {t:'mode', v:b.dataset.v}); toast('Mod değişiyor… (birkaç saniye)', 4000); }
  else if (a === 'hib'){ if (confirm('Bilgisayar hazırda bekletilsin mi? Sonra ancak Uyandır ile açılır.')){ cmd(id, {t:'hib'}); toast('Uyutuluyor…'); } }
  else if (a === 'remove') removeDevice(id);
});
async function removeDevice(id){
  if (!confirm('Bu bilgisayar panelden kaldırılsın mı? (Ajan çalışmaya devam ederse tekrar görünür; bilgisayarda kaldırma komutunu çalıştır.)')) return;
  await Promise.all(['info','q','fr','box'].map(r => dbDel(P(r, id))));
  toast('Kaldırıldı');
}

/* ---- Komut kuyruğu ---- */
const cmd = (id, c) => dbPost(P('q', id) + '/c', c).catch(() => toast('Gönderilemedi'));
const ping = (id, kind) => dbPut(P('q', id) + '/watch', kind + ':' + Date.now()).catch(() => {});

/* ---- Dosya gönder (büyük dosyalar parça parça) ---- */
const sleep = ms => new Promise(r => setTimeout(r, ms));
function toB64(u8){ let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function fromB64(b){ const bin = atob(b), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : (b / 1024).toFixed(b > 102400 ? 0 : 1) + ' KB';
let sendTarget = null;
$('fileIn').addEventListener('change', async e => {
  const files = Array.from(e.target.files); e.target.value = '';
  const id = sendTarget; if (!id) return;
  for (const f of files){
    if (f.size > MAXB){ toast(`${f.name}: 100 MB'tan büyük, gönderilmedi`, 4000); continue; }
    const fid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const node = P('box', id) + '/in/' + fid;
    try{
      const n = f.size > CH ? Math.ceil(f.size / CH) : 0;
      if (n && (infoData[id] || {}).ver < 14){ toast('Büyük dosya için laptoptaki ajan henüz güncellenmemiş', 4000); continue; }
      if (n){
        await dbPut(node + '/name', f.name);
        for (let i = 0; i < n; i++){
          toast(`${f.name} yükleniyor… %${Math.round(i / n * 100)}`, 60000);
          const buf = new Uint8Array(await f.slice(i * CH, (i + 1) * CH).arrayBuffer());
          await dbPut(node + '/p/' + i, toB64(buf));
        }
      } else {
        toast(`${f.name} yükleniyor…`, 8000);
        const buf = new Uint8Array(await f.arrayBuffer());
        await dbPut(node, {name: f.name, size: f.size, b64: toB64(buf)});
      }
      await cmd(id, n ? {t:'file', id: fid, n} : {t:'file', id: fid});
      let ok = false, last = Date.now(), done = 0;
      while (Date.now() - last < 60000){
        await sleep(1500);
        const st = await dbGet(node).catch(() => undefined);
        if (st === null){ ok = true; break; }
        if (st && st.done > done){ done = st.done; last = Date.now(); }
        if (n) toast(`${f.name} laptopa yazılıyor… %${Math.round(done / n * 100)}`, 60000);
      }
      toast(ok ? `${f.name} teslim edildi (İndirilenler\\UzakMasa)` : `${f.name}: bilgisayar yanıt vermedi`, 4000);
      if (!ok) dbDel(node);
    }catch(err){ toast('Gönderme hatası: ' + err.message, 4000); dbDel(node); }
  }
});

/* ---- Dosya gezgini ---- */
let fDev = null, fRoot = '', fCur = '';
function waitRes(id, rid, tries = 25){
  return (async () => {
    for (let i = 0; i < tries; i++){
      await ping(id, 'p');
      const r = await dbGet(P('box', id) + '/res/' + rid).catch(() => null);
      if (r) { dbDel(P('box', id) + '/res/' + rid); return r; }
      await new Promise(r => setTimeout(r, 1200));
    }
    return null;
  })();
}
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function openFiles(id, path){
  fDev = id; showM('mFiles');
  $('fTitle').textContent = (infoData[id] && infoData[id].name || id) + ' · Dosyalar';
  $('fList').innerHTML = '<div class="sub" style="padding:14px">Yükleniyor…</div>';
  const r = rid(); await cmd(id, {t:'ls', path: path || '', rid: r});
  const res = await waitRes(id, r);
  if (!res) { $('fList').innerHTML = '<div class="warn" style="padding:14px">Bilgisayar yanıt vermedi.</div>'; return; }
  if (res.err) { $('fList').innerHTML = `<div class="warn" style="padding:14px">${esc(res.err)}</div>`; return; }
  fRoot = res.root; fCur = res.path; $('fPath').textContent = fCur;
  let h = '';
  if (fCur.toLowerCase() !== fRoot.toLowerCase()) h += `<div class="fl d"><span class="n" data-up="1">⬆ Üst klasör</span></div>`;
  (res.items || []).forEach(it => {
    h += it.d ? `<div class="fl d"><span class="n" data-dir="${esc(it.n)}">📁 ${esc(it.n)}</span></div>`
              : `<div class="fl"><span class="n">📄 ${esc(it.n)}</span><span class="sub">${fmtSize(it.s)}</span><button class="sm" data-dl="${esc(it.n)}" ${it.s > MAXB ? 'disabled' : ''}>İndir</button></div>`;
  });
  $('fList').innerHTML = h || '<div class="sub" style="padding:14px">Boş klasör</div>';
}
$('fList').addEventListener('click', async e => {
  const t = e.target;
  if (t.dataset.up){ openFiles(fDev, fCur.replace(/\\[^\\]+$/, '')); }
  else if (t.dataset.dir){ openFiles(fDev, fCur + '\\' + t.dataset.dir); }
  else if (t.dataset.dl){
    const name = t.dataset.dl, dev = fDev; toast(name + ' isteniyor…', 8000);
    const r = rid(); await cmd(dev, {t:'dl', path: fCur + '\\' + name, rid: r});
    const res = await waitRes(dev, r, 40);
    if (!res) return toast('Yanıt yok', 3000);
    if (res.err) return toast(res.err, 3500);
    let parts;
    if (res.n){
      parts = [];
      for (let i = 0; i < res.n; i++){
        toast(`${name} indiriliyor… %${Math.round(i / res.n * 100)}`, 60000);
        const p = P('box', dev) + '/out/' + r + '/' + i; let s = null;
        for (let k = 0; k < 80 && !s; k++){ s = await dbGet(p).catch(() => null); if (!s) await sleep(750); }
        if (!s){ dbDel(P('box', dev) + '/out/' + r); return toast('İndirme yarıda kesildi', 4000); }
        parts.push(fromB64(s)); dbDel(p);
      }
    } else parts = [fromB64(res.b64)];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(parts)); a.download = res.name || name; document.body.appendChild(a); a.click(); a.remove();
    toast('İndirildi');
  }
});

/* ---- Uygulamalar ---- */
let aDev = null, aTab = 'run', aRun = [], aAll = null, aBusy = false;
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const appIcon = n => { const h = hue(n || '?'); return `<div class="ai" style="background:linear-gradient(135deg,hsl(${h} 70% 55%),hsl(${(h + 40) % 360} 70% 42%))">${esc((n || '?').trim().charAt(0).toUpperCase())}</div>`; };
async function loadApps(all){
  if (aBusy) return; aBusy = true;
  const dev = aDev, r = rid();
  try{
    await cmd(dev, {t:'apps', rid: r, all: !!all});
    const res = await waitRes(dev, r, 30);
    if (dev !== aDev) return;
    if (!res){ $('aList').innerHTML = '<div class="note">Bilgisayar yanıt vermedi.</div>'; return; }
    aRun = res.run || []; if (res.all) aAll = res.all.slice().sort((x, y) => x.n.localeCompare(y.n, 'tr'));
    renderApps();
  } finally { aBusy = false; }
}
function openApps(id){
  aDev = id; aAll = null; aRun = []; $('aSearch').value = '';
  $('aTitle').textContent = (infoData[id] && infoData[id].name || id) + ' · Uygulamalar';
  showM('mApps'); setTab('run', true);
}
function setTab(t, reload){
  aTab = t; $('tRun').classList.toggle('on', t === 'run'); $('tAll').classList.toggle('on', t === 'all');
  if (reload || (t === 'all' && !aAll)){ $('aList').innerHTML = '<div class="note">Yükleniyor…</div>'; loadApps(t === 'all'); }
  else renderApps();
}
function renderApps(){
  const q = $('aSearch').value.trim().toLocaleLowerCase('tr'), m = s => String(s || '').toLocaleLowerCase('tr').includes(q);
  let h = '';
  if (aTab === 'run'){
    const L = aRun.filter(p => !q || m(p.n) || m(p.t));
    h = L.map(p => `<div class="it">${appIcon(p.t || p.n)}<div class="tx"><div>${esc(p.t)}</div><div class="sub">${esc(p.n)} · ${p.m} MB</div></div>
      <div class="acts2"><button class="sm" data-kill="${p.pid}">${ic('x')}Kapat</button><button class="sm ghost danger" data-force="${p.pid}" title="Zorla kapat">${ic('bolt')}</button></div></div>`).join('');
    if (!h) h = `<div class="note">${q ? 'Eşleşen pencere yok.' : 'Açık pencere yok.'}</div>`;
  } else {
    const L = (aAll || []).map((a, i) => [a, i]).filter(([a]) => !q || m(a.n));
    h = L.slice(0, 200).map(([a, i]) => `<div class="it">${appIcon(a.n)}<div class="tx"><div>${esc(a.n)}</div></div>
      <div class="acts2"><button class="sm pri" data-launch="${i}">${ic('play')}Aç</button></div></div>`).join('');
    if (!h) h = `<div class="note">${aAll ? 'Uygulama bulunamadı.' : 'Yükleniyor…'}</div>`;
  }
  $('aList').innerHTML = h;
}
$('tRun').onclick = () => setTab('run', true);
$('tAll').onclick = () => setTab('all');
$('aSearch').addEventListener('input', renderApps);
$('aRefresh').onclick = () => { if (aTab === 'all') aAll = null; setTab(aTab, true); };
$('aList').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !aDev) return;
  if (b.dataset.kill){ cmd(aDev, {t:'kill', pid: +b.dataset.kill}); b.disabled = true; toast('Kapatılıyor…'); setTimeout(() => aTab === 'run' && loadApps(false), 1800); }
  else if (b.dataset.force){ if (!confirm('Zorla kapatılsın mı? Kaydedilmemiş veriler kaybolur.')) return; cmd(aDev, {t:'kill', pid: +b.dataset.force, force: true}); toast('Zorla kapatıldı'); setTimeout(() => aTab === 'run' && loadApps(false), 1200); }
  else if (b.dataset.launch){ const a = aAll[+b.dataset.launch]; if (!a) return; cmd(aDev, {t:'launch', id: a.id}); toast(a.n + ' açılıyor…', 3000); }
});

/* ---- Pano ---- */
let cDev = null;
function openClip(id){ cDev = id; $('cTitle').textContent = (infoData[id] && infoData[id].name || id) + ' · Pano'; showM('mClip'); }
$('cGet').onclick = async () => {
  const dev = cDev, r = rid(); toast('Pano isteniyor…', 6000);
  await cmd(dev, {t:'clip', a:'get', rid: r});
  const res = await waitRes(dev, r, 15);
  if (!res) return toast('Bilgisayar yanıt vermedi (ajan güncel mi?)', 4000);
  $('cText').value = res.text || ''; toast(res.text ? 'Pano alındı' : 'Laptopun panosu boş');
};
$('cSet').onclick = () => { const t = $('cText').value; if (!t) return toast('Önce metin yaz ya da yapıştır'); cmd(cDev, {t:'clip', a:'set', text: t}); toast('Laptopun panosuna gönderildi'); };
$('cCopy').onclick = () => { if ($('cText').value) copyText($('cText').value); };

/* ---- Kumanda (ses, medya, parlaklık, güç) ---- */
let pDev = null;
const POW1 = [['voldown','voldown','Ses −'],['mute','mute','Sessiz'],['volup','volup','Ses +'],['prev','prev','Önceki'],['play','pp','Oynat/Durdur'],['next','next','Sonraki']];
const POW2 = [['lock','lock','Kilitle'],['restart','refresh','Yeniden başlat'],['off','power','Bilgisayarı kapat']];
function openPow(id){
  pDev = id; $('pTitle').textContent = (infoData[id] && infoData[id].name || id) + ' · Kumanda';
  const mk = L => L.map(x => `<button data-p="${x[0]}">${ic(x[1])}${x[2]}</button>`).join('');
  $('pGrid1').innerHTML = mk(POW1); $('pGrid2').innerHTML = mk(POW2); showM('mPow');
}
$('mPow').addEventListener('click', e => {
  const b = e.target.closest('button[data-p]'); if (!b || !pDev) return; const a = b.dataset.p;
  if (a === 'restart' && !confirm('Bilgisayar yeniden başlatılsın mı? Açık işler kapanır.')) return;
  if (a === 'off' && !confirm('Bilgisayar tamamen kapatılsın mı? Kapalıyken uzaktan açılamaz.')) return;
  cmd(pDev, {t:'pow', a}); if (a === 'lock' || a === 'restart' || a === 'off') toast('Gönderildi');
});
$('pBright').addEventListener('change', e => { if (pDev) cmd(pDev, {t:'pow', a:'bright', v: +e.target.value}); });

/* ---- Bildirim konusu (ajanla aynı hesap: anahtarın SHA-256'sının ilk 24 hanesi) ---- */
async function ntfyTopic(){
  try{ const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(S.key)); return 'um-' + Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, '0')).join('').slice(0, 24); }
  catch(e){ return '(hesaplanamadı)'; }
}

/* ---- Ekran görüntüleyici + kontrol ---- */
/* Dokunmatikte güvenilir basma: parmak kalkınca hemen çalışır, ardından gelen click yok sayılır */
function tap(el, fn){
  let down = null, last = 0;
  el.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') down = {x: e.clientX, y: e.clientY, t: e.target}; });
  el.addEventListener('pointerup', e => {
    if (!down || e.pointerType === 'mouse') return;
    const d = down; down = null;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 30) return;
    last = Date.now(); if (d.t.tagName !== 'INPUT') e.preventDefault(); fn(e, d.t);
  });
  el.addEventListener('pointercancel', () => { down = null; });
  el.addEventListener('click', e => { if (Date.now() - last < 700) return; fn(e, e.target); });
}
let vDev = null, vES = null, vBeat = null, vLast = 0, vTimer = null, rightNext = false, dblNext = false, scrollMode = false;
/* Kareleri sırayla göster: telefon bir öncekini çizmeden yenisini basma, yoksa dokunuşlar kaçar */
let vPend = null, vBusy = false;
function showFrame(src){ vPend = src; if (!vBusy) nextFrame(); }
function nextFrame(){
  if (!vPend) return;
  const s = vPend; vPend = null; vBusy = true;
  const im = $('vimg'); im.onload = im.onerror = () => { vBusy = false; setTimeout(nextFrame, 0); };
  im.src = s;
}
function setBtn(id, icon, label){ $(id).innerHTML = ic(icon) + '<span>' + label + '</span>'; }
function syncBar(){
  setBtn('vMode', scrollMode ? 'scroll' : 'cursor', scrollMode ? 'Kaydır' : 'Tıkla');
  setBtn('vDbl', 'dbl', 'Çift tık'); setBtn('vRight', 'menu2', 'Sağ tık'); setBtn('vKbT', 'kb', 'Klavye');
  const full = $('viewer').classList.contains('full'); setBtn('vFull', full ? 'min' : 'max', full ? 'Küçült' : 'Tam ekran');
  $('vMode').classList.toggle('on', scrollMode); $('vDbl').classList.toggle('on', dblNext); $('vRight').classList.toggle('on', rightNext);
  $('vKbT').classList.toggle('on', $('vkb').classList.contains('show'));
}
function openViewer(id){
  setLive(live);
  vDev = id; $('viewer').classList.add('show'); $('vimg').removeAttribute('src'); $('vstat').textContent = 'bağlanıyor…';
  vPend = null; vBusy = false; resetZ();
  ping(id, 's'); vBeat = setInterval(() => ping(id, zs > 1.3 ? 'S' : 's'), 3000);
  let lastC = 0;
  vES = listen(P('fr', id), d => { if (d && d.img){ if (d.c){ if (d.c < lastC) return; lastC = d.c; } showFrame(d.img); vLast = Date.now(); } });
  vTimer = setInterval(() => {
    const d = infoData[vDev] || {}, ok = d.ts && Date.now() - d.ts < 15000;
    $('vstat').classList.toggle('ok', !!ok);
    $('vstat').textContent = ok ? '● Bağlı' : (vLast ? 'Bağlantı bekleniyor…' : 'bağlanıyor…');
  }, 1000);
  setFull(land.matches); syncBar();
}
function setFull(on){
  const v = $('viewer');
  v.classList.toggle('full', on); if (!on) v.classList.remove('menu');
  try{
    if (on && !document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }catch(e){}
  syncBar();
}
function closeViewer(){
  clearInterval(vBeat); clearInterval(vTimer); if (vES) vES.close(); vES = null; vLast = 0; vPend = null;
  setFull(false);
  $('viewer').classList.remove('show'); $('vkb').classList.remove('show'); vDev = null;
}
const land = window.matchMedia('(orientation: landscape)');
const onOrient = () => { if (vDev){ setFull(land.matches); resetZ(); } };
if (land.addEventListener) land.addEventListener('change', onOrient); else land.addListener(onOrient);
tap($('vFull'), () => setFull(!$('viewer').classList.contains('full')));
tap($('vfab'), () => $('viewer').classList.toggle('menu'));
tap($('vClose'), closeViewer);
tap($('vKbT'), () => { $('vkb').classList.toggle('show'); syncBar(); });
tap($('vMode'), () => { scrollMode = !scrollMode; syncBar(); });
tap($('vDbl'), () => { dblNext = !dblNext; rightNext = false; syncBar(); });
tap($('vRight'), () => { rightNext = !rightNext; dblNext = false; syncBar(); });
/* Canlı klavye: yazılan her şey anında gider. Kutuda görünmez bir işaret tutulur ki boşken de silme tuşu algılansın */
const SENT = '​';
let live = true, kq = Promise.resolve(), kbuf = '', kt = null;
function kflush(){ clearTimeout(kt); kt = null; if (!kbuf || !vDev) { kbuf = ''; return; } const t = kbuf, d = vDev; kbuf = ''; kq = kq.then(() => cmd(d, {t:'k', text:t})); }
function kkey(k){ kflush(); const d = vDev; if (d) kq = kq.then(() => cmd(d, {t:'k', key:k, mods:[]})); }
function setLive(on){
  live = on; $('vLive').classList.toggle('on', on); $('vSend').style.display = on ? 'none' : '';
  $('vText').value = on ? SENT : ''; $('vText').placeholder = on ? 'Yaz, anında gider' : "Yaz, Gönder'e bas";
}
$('vText').addEventListener('focus', () => { if (live) $('vText').value = SENT; });
$('vText').addEventListener('input', e => {
  if (!live) return;
  const el = e.target, ty = e.inputType || '';
  if (ty.indexOf('delete') === 0) kkey('BACKSPACE');
  else if (ty === 'insertLineBreak') kkey('ENTER');
  else { const v = el.value.split(SENT).join(''); if (v){ kbuf += v; clearTimeout(kt); kt = setTimeout(kflush, 120); } }
  el.value = SENT;
});
tap($('vLive'), () => setLive(!live));
tap($('vSend'), () => { const t = $('vText').value.split(SENT).join(''); if (t && !live){ cmd(vDev, {t:'k', text:t}); $('vText').value = ''; toast('Gönderildi', 1200); } });
$('vText').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); if (live) kkey('ENTER'); else $('vSend').click(); } });
tap($('vkb'), (e, t) => { const b = t && t.closest && t.closest('button[data-k]'); if (!b) return; kflush(); cmd(vDev, {t:'k', key:b.dataset.k, mods: b.dataset.m ? [b.dataset.m] : []}); });

function norm(ev){
  const img = $('vimg'), r = img.getBoundingClientRect();
  const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
  const sc = Math.min(r.width / nw, r.height / nh), w = nw * sc, h = nh * sc;
  const ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
  const x = (ev.clientX - ox) / w, y = (ev.clientY - oy) / h;
  return (x < 0 || x > 1 || y < 0 || y > 1) ? null : {x: +x.toFixed(4), y: +y.toFixed(4)};
}
const mouse = (a, p, d) => vDev && cmd(vDev, Object.assign({t:'m', a}, p || {}, d != null ? {d} : {}));
/* Yakınlaştırma: iki parmakla büyüt, büyükken tek parmakla kaydır, dokunuş yine doğru noktaya gider */
let zs = 1, zx = 0, zy = 0;
function applyZ(){
  const el = $('vimg'), w = el.offsetWidth, hh = el.offsetHeight;
  if (zs <= 1.02){ zs = 1; zx = 0; zy = 0; }
  zx = Math.min(0, Math.max(w * (1 - zs), zx)); zy = Math.min(0, Math.max(hh * (1 - zs), zy));
  el.style.transform = zs === 1 ? '' : `translate(${zx}px,${zy}px) scale(${zs})`;
  $('vZoom').style.display = zs > 1 ? '' : 'none';
  const hi = zs > 1.3; if (vDev && hi !== applyZ.hi){ applyZ.hi = hi; ping(vDev, hi ? 'S' : 's'); }
}
function resetZ(){ zs = 1; zx = 0; zy = 0; applyZ(); }
(function(){
  const wrap = $('vwrap'), el = $('vimg'), pts = new Map();
  let st = null, lastMove = 0, lastY = 0, pz = null;
  const origin = () => { const r = wrap.getBoundingClientRect(); return {x: r.left + el.offsetLeft, y: r.top + el.offsetTop}; };
  function pinchInfo(){ const [a, b] = [...pts.values()], o = origin(); return {d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - o.x, my: (a.y + b.y) / 2 - o.y}; }
  el.addEventListener('contextmenu', e => { e.preventDefault(); const p = norm(e); if (p) mouse('right', p); });
  el.addEventListener('wheel', e => { e.preventDefault(); mouse('scroll', null, e.deltaY > 0 ? -120 : 120); }, {passive:false});
  function ripple(x, y){
    const r = wrap.getBoundingClientRect(), d = document.createElement('div');
    d.className = 'rip'; d.style.left = (x - r.left) + 'px'; d.style.top = (y - r.top) + 'px';
    wrap.appendChild(d); setTimeout(() => d.remove(), 550);
  }
  wrap.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    if (e.isPrimary){ pts.clear(); pz = null; }
    try{ wrap.setPointerCapture(e.pointerId); }catch(_){}
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pts.size === 2){
      if (st && st.drag) mouse('up', st.p);
      st = null; const i = pinchInfo(); pz = {d: i.d, s0: zs, lx: (i.mx - zx) / zs, ly: (i.my - zy) / zs}; return;
    }
    if (pts.size > 2) return;
    st = {x: e.clientX, y: e.clientY, t: Date.now(), moved: false, drag: false, pan: false, p: norm(e), zx, zy}; lastY = e.clientY;
  });
  wrap.addEventListener('pointermove', e => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pz && pts.size >= 2){
      const i = pinchInfo(); zs = Math.min(5, Math.max(1, pz.s0 * i.d / pz.d));
      zx = i.mx - zs * pz.lx; zy = i.my - zs * pz.ly; applyZ(); return;
    }
    if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.moved && Math.hypot(dx, dy) > 16) st.moved = true;
    if (!st.moved) return;
    if (scrollMode){ if (Math.abs(e.clientY - lastY) > 14){ mouse('scroll', null, e.clientY > lastY ? 120 : -120); lastY = e.clientY; } return; }
    if (zs > 1 && !st.drag){ st.pan = true; zx = st.zx + dx; zy = st.zy + dy; applyZ(); return; }
    const now = Date.now(), p = norm(e);
    if (!st.drag && st.p){ st.drag = true; mouse('down', st.p); }
    if (st.drag && p && now - lastMove > 120){ lastMove = now; mouse('move', p); }
  });
  const end = e => {
    pts.delete(e.pointerId);
    if (pz){ if (pts.size < 2) pz = null; st = null; return; }
    if (!st || e.type === 'pointercancel'){ st = null; return; }
    const p = norm(e), s = st; st = null;
    if (s.pan) return;
    if (s.moved){ if (!scrollMode && s.drag) mouse('up', p || s.p); return; }
    if (!s.p) return;
    const long = Date.now() - s.t > 700;
    ripple(s.x, s.y);
    if (rightNext || long) mouse('right', s.p); else if (dblNext) mouse('dbl', s.p); else mouse('click', s.p);
    if (rightNext || dblNext){ rightNext = dblNext = false; syncBar(); }
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
})();
tap($('vZoom'), resetZ);


/* ---- Terminal (PIN ile imzali; PIN sadece bu telefonda durur) ---- */
(function(){
  const css = document.createElement('style');
  css.textContent = `#tOut{background:#05050a;border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;height:46vh;overflow:auto;font:12.5px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;word-break:break-word;color:#d6d6e6;margin:0}
  #tOut .c{color:#a98bff}#tOut .e{color:#ff8a9a}#tOut .d{color:#6f6f86}
  .trow{display:flex;gap:8px;margin-top:10px}.trow input{flex:1;font-family:ui-monospace,Menlo,Consolas,monospace}
  .tq{display:flex;gap:6px;overflow-x:auto;margin-top:10px;padding-bottom:2px}.tq button{flex:none}`;
  document.head.appendChild(css);
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'mTerm';
  m.innerHTML = `<div class="sheet"><div class="shead"><h2 id="tTitle">Terminal</h2><button class="sm" id="tPin">PIN</button></div>
    <pre id="tOut"></pre>
    <div class="tq" id="tQuick"></div>
    <div class="trow"><input type="text" id="tIn" placeholder="PowerShell komutu" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"><button class="pri" id="tRun">Çalıştır</button></div>
    <div class="btns"><button id="tClear">Temizle</button><button onclick="closeM('mTerm')">Kapat</button></div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
})();
const QUICK = ['Get-Process | Sort-Object CPU -Desc | Select -First 10 Name,Id,CPU', 'ipconfig', 'Get-ChildItem', 'cd ..', 'Get-PSDrive -PSProvider FileSystem', 'whoami'];
let tDev = null, tHist = [], tHi = -1, tBusy = false;
const PINK = 'uzakmasa-pin';
const hexb = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
function tLine(t, cls){ const o = $('tOut'), s = document.createElement('span'); if (cls) s.className = cls; s.textContent = t + '\n'; o.appendChild(s); o.scrollTop = o.scrollHeight; }
function getPin(force){
  let p = null; try{ p = localStorage.getItem(PINK); }catch(e){}
  if (!p || force){ p = prompt('Terminal PIN\'i (laptopta Terminal-PIN.cmd ile belirlenen):'); if (!p) return null; try{ localStorage.setItem(PINK, p); }catch(e){} }
  return p;
}
const kCache = {};
async function sign(pin, dev, msg){
  const ck = dev + '|' + pin;
  if (!kCache[ck]){
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    kCache[ck] = await crypto.subtle.deriveBits({name:'PBKDF2', hash:'SHA-256', salt: new TextEncoder().encode('uzakmasa-term|' + dev), iterations: 200000}, base, 256);
  }
  const key = await crypto.subtle.importKey('raw', kCache[ck], {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  return hexb(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
}
function openTerm(id){
  tDev = id; const d = infoData[id] || {};
  $('tTitle').textContent = (d.name || id) + ' · Terminal';
  $('tQuick').innerHTML = QUICK.map((q, i) => `<button class="sm" data-q="${i}">${esc(q.length > 22 ? q.slice(0, 22) + '…' : q)}</button>`).join('');
  if (!$('tOut').textContent) tLine(d.sh ? 'Hazır. Komutlar laptopta PowerShell ile çalışır.' : (d.ver >= 15 ? 'Laptopta PIN belirlenmemiş: masaüstündeki Terminal-PIN.cmd\'yi çalıştır.' : 'Laptoptaki ajan henüz güncellenmemiş (v15 gerekir).'), 'd');
  showM('mTerm'); setTimeout(() => $('tIn').focus(), 250);
}
async function tRun(text){
  text = (text || '').trim(); if (!text || tBusy || !tDev) return;
  const pin = getPin(); if (!pin) return;
  tBusy = true; $('tRun').disabled = true;
  tHist.unshift(text); tHi = -1; $('tIn').value = '';
  tLine('> ' + text, 'c');
  try{
    const n = rid() + rid(), ts = Date.now(), r = rid();
    const sig = await sign(pin, tDev, `${n}|${ts}|${text}`);
    await cmd(tDev, {t:'sh', cmd: text, ts, n, sig, rid: r});
    const res = await waitRes(tDev, r, 80);
    if (!res) tLine('Yanıt yok (laptop uykuda ya da komut çok uzun sürdü).', 'e');
    else if (res.err){ tLine(res.err, 'e'); if (/PIN/.test(res.err)) { try{ localStorage.removeItem(PINK); }catch(e){} } }
    else { if (res.out) tLine(res.out); if (res.cwd) tLine(res.cwd + (res.code ? '  (kod ' + res.code + ')' : ''), 'd'); }
  }catch(e){ tLine('Hata: ' + e.message, 'e'); }
  tBusy = false; $('tRun').disabled = false;
}
$('tRun').onclick = () => tRun($('tIn').value);
$('tIn').addEventListener('keydown', e => {
  if (e.key === 'Enter'){ e.preventDefault(); tRun($('tIn').value); }
  else if (e.key === 'ArrowUp' && tHist.length){ e.preventDefault(); tHi = Math.min(tHist.length - 1, tHi + 1); $('tIn').value = tHist[tHi]; }
  else if (e.key === 'ArrowDown'){ e.preventDefault(); tHi = Math.max(-1, tHi - 1); $('tIn').value = tHi < 0 ? '' : tHist[tHi]; }
});
$('tQuick').addEventListener('click', e => { const b = e.target.closest('button[data-q]'); if (b) tRun(QUICK[+b.dataset.q]); });
$('tClear').onclick = () => { $('tOut').textContent = ''; };
$('tPin').onclick = () => { getPin(true); };

/* ---- Ekle / telefon / ayarlar ---- */
function addCommand(){
  const name = $('addName').value.trim().replace(/'/g, '');
  const parts = [`$env:UM_KEY='${S.key}'`, `$env:UM_DB='${S.db}'`, `$env:UM_URL='${location.origin}'`];
  if (name) parts.push(`$env:UM_NAME='${name}'`);
  parts.push('irm "$env:UM_URL/install.ps1" | iex');
  return parts.join('; ');
}
function showAdd(){
  $('addCmd').textContent = addCommand();
  $('rmCmd').textContent = `$env:UM_REMOVE='1'; $env:UM_URL='${location.origin}'; irm "$env:UM_URL/install.ps1" | iex`;
  showM('mAdd');
}
$('addName').addEventListener('input', () => { $('addCmd').textContent = addCommand(); });
$('bAdd').onclick = showAdd;
$('bPhone').onclick = () => { $('phoneLink').textContent = `${location.origin}/#db=${encodeURIComponent(S.db)}&key=${S.key}` + (S.wake ? `&wake=${encodeURIComponent(S.wake)}` : ''); showM('mPhone'); };
$('bSet').onclick = () => { ntfyTopic().then(t => $('setNtfy').textContent = t); defaultWake().then(w => $('setWake').value = S.wake || w); $('setDb').value = S.db || ''; showM('mSet'); };
function cleanDb(v){ v = v.trim().replace(/\/+$/, ''); return /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebaseio\.com|firebasedatabase\.app)$/i.test(v) ? v : null; }
function parseConn(v){
  v = String(v || '').trim();
  const i = v.indexOf('#');
  if (i >= 0){
    const h = new URLSearchParams(v.slice(i + 1));
    const db = cleanDb(h.get('db') || ''), key = h.get('key') || '';
    if (db && /^[a-z0-9]{32,}$/.test(key)) return {db, key};
  }
  return {db: cleanDb(v)};
}
async function trySave(v, errEl){
  const c = parseConn(v), db = c.db; if (!db){ errEl.textContent = 'Adres ya da "Telefona bağla" bağlantısı yapıştır.'; return false; }
  try{
    const old = S.db, oldKey = S.key; S.db = db; if (c.key) S.key = c.key;
    const r = await fetch(U(`/info/${S.key}`), {cache:'no-store'});
    if (!r.ok){ S.db = old; S.key = oldKey; errEl.textContent = r.status === 401 || r.status === 403 ? 'Erişim reddedildi: Rules kısmını yapıştırıp Publish dedin mi?' : 'Bağlanılamadı (' + r.status + ')'; return false; }
  }catch(e){ errEl.textContent = 'Bağlanılamadı. Adres doğru mu?'; return false; }
  save(); errEl.textContent = ''; return true;
}
$('bSave').onclick = async () => { if (await trySave($('dbIn').value, $('setupErr'))){ closeM('mSetup'); boot(); } };
$('bSetSave').onclick = async () => { S.wake = $('setWake').value.trim(); save(); const e = document.createElement('p'); if (await trySave($('setDb').value, e)){ closeM('mSet'); boot(); toast('Kaydedildi'); } else toast(e.textContent, 4000); };
$('bKeyNew').onclick = () => { if (confirm('Yeni anahtar üretilsin mi? Tüm bilgisayarları yeniden eklemen gerekir.')){ S.key = randKey(); save(); infoData = {}; render(); boot(); toast('Yeni anahtar üretildi'); } };

function boot(){
  if (!S.db){ $('rules').textContent = RULES; showM('mSetup'); return; }
  startInfo();
}
(function init(){
  load();
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('db') && h.get('key') && h.get('key').length >= 32){ S.db = cleanDb(h.get('db')) || S.db; S.key = h.get('key'); if (h.get('wake')) S.wake = h.get('wake'); save(); history.replaceState(null, '', location.pathname); }
  if (!S.key || S.key.length < 32){ S.key = randKey(); save(); }
  $('logoI').innerHTML = ic('mon'); $('bAdd').innerHTML = ic('plus'); $('bPhone').innerHTML = ic('phone'); $('bSet').innerHTML = ic('gear'); $('aRefresh').innerHTML = ic('refresh'); $('vClose').innerHTML = ic('x'); $('vfab').innerHTML = ic('bars'); syncBar();
  setInterval(render, 15000);
  boot();
})();
