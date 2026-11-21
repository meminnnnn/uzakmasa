/* UzakMasa v16 arayuz: yeni kart tasarimi (render yeniden yazilir, buton data-a'lari ayni kalir) */
(function(){
  I.dots = '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>';
  I.cpu = '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>';
  I.clock = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
  I.app = '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>';
  const sub = document.createElement('div'); sub.id = 'hSub'; sub.className = 'hsub';
  const logo = document.querySelector('.logo'); const wrap = document.createElement('div'); wrap.className = 'logotx';
  wrap.appendChild(document.createTextNode('meminPC')); wrap.appendChild(sub);
  [...logo.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); }); logo.appendChild(wrap);
})();
function ring(label, val, txt){
  const v = Math.max(0, Math.min(100, val || 0)), C = 2 * Math.PI * 26, col = v >= 90 ? 'r' : v >= 75 ? 'y' : 'g';
  return `<div class="gauge ${col}"><svg viewBox="0 0 64 64"><circle class="tr" cx="32" cy="32" r="26"/><circle class="fg" cx="32" cy="32" r="26" stroke-dasharray="${(C * v / 100).toFixed(1)} ${C.toFixed(1)}"/></svg><div class="gv">${txt}</div><div class="gl">${label}</div></div>`;
}
function batIcon(p, ac){
  const w = Math.max(1, Math.round(13 * p / 100)), col = p <= 20 && !ac ? '#ff6b81' : ac ? '#5fe39b' : '#e8e8f2';
  return `<svg viewBox="0 0 24 24" class="bi"><rect x="2" y="7" width="17" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="9" width="${w}" height="6" rx="1" fill="${col}"/><path d="M21.5 10.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>${ac ? '<path d="M11 8.5 8.8 12.3h2.6L10 15.6" fill="none" stroke="#06060b" stroke-width="1.4" stroke-linejoin="round"/>' : ''}</svg>`;
}
const TILES = [['apps','grid','Uygulamalar',265],['send','up','Gönder',200],['files','folder','Dosyalar',40],['clip','clip','Pano',170],['pow','remote','Kumanda',320],['term','term','Terminal',140]];
let uiFirst = !Object.keys(infoData).length;
window.render = function(){
  const ids = Object.keys(infoData);
  if (ids.length) uiFirst = false;
  if (!ids.length && uiFirst && performance.now() < 6000){
    $('empty').style.display = 'none';
    $('grid').innerHTML = '<div class="card skel"><div class="sk a"></div><div class="sk b"></div><div class="sk c"></div><div class="sk d"></div></div>';
    setTimeout(() => render(), 1500); return;
  }
  $('empty').style.display = ids.length ? 'none' : 'block';
  const on = ids.filter(id => { const d = infoData[id] || {}; return d.ts && Date.now() - d.ts < 60000; }).length;
  const hs = $('hSub'); if (hs) hs.textContent = ids.length ? `${ids.length} cihaz · ${on} çevrimiçi` : 'Uzaktan masaüstü';
  $('grid').innerHTML = ids.map(id => {
    const d = infoData[id] || {};
    const online = d.ts && (Date.now() - d.ts) < 60000;
    const ramU = (d.ramT - d.ramF) || 0, ramP = d.ramT ? ramU / d.ramT * 100 : 0;
    const dk = (d.disks || [])[0], dP = dk && dk.t ? (dk.t - dk.f) / dk.t * 100 : 0;
    const head = `<div class="ch"><div class="av ${online ? 'live' : ''}">${ic('mon')}<i></i></div>
        <div class="who"><h3>${esc(d.name || id)}</h3><div class="sub">${esc(d.os || 'Windows')} · ${esc(d.user || '')}${d.ver ? ' · v' + d.ver : ''}</div></div>
        <span class="pill ${online ? 'on' : ''}"><b></b>${online ? 'Çevrimiçi' : 'Uykuda'}</span>
        <button class="ib more" data-more="1" aria-label="Diğer">${ic('dots')}</button>
        <div class="menu"><button data-a="remove" class="danger">${ic('trash')}Panelden kaldır</button></div></div>`;
    if (!online) return `<div class="card off" data-id="${esc(id)}">${head}
        <div class="offmsg">${ic('moon')}<div><b>Uykuda</b><span>Son görülme ${ago(d.ts) || 'bilinmiyor'}</span></div></div>
        <div class="acts">${wakeBtn(id)}</div></div>`;
    const gauges = `<div class="gauges">${ring('İşlemci', d.cpu, '%' + (d.cpu || 0))}${ring('Bellek', ramP, ramU.toFixed(1) + '<small>/' + (d.ramT || 0).toFixed(0) + ' GB</small>')}${dk ? ring('Disk ' + esc(dk.n), dP, Math.round(dP) + '<small>%</small>') : ''}</div>`;
    const chips = (d.bat >= 0 ? `<span class="chip">${batIcon(d.bat, d.ac)}<b>%${d.bat}</b>${d.ac ? ' şarjda' : ''}</span>` : '')
      + (d.up != null ? `<span class="chip">${ic('clock')}<b>${fmtUp(d.up)}</b> açık</span>` : '')
      + (d.fg ? `<span class="chip">${ic('app')}<b>${esc(d.fg)}</b></span>` : '');
    const tiles = TILES.map(t => `<button class="tile" data-a="${t[0]}" style="--h:${t[3]}"><span class="ti">${ic(t[1])}</span>${t[2]}</button>`).join('');
    const mode = d.mode ? `<div class="modesw"><button data-a="mode" data-v="home" class="${d.mode === 'home' ? 'on' : ''}" ${d.mode === 'home' ? 'disabled' : ''}>${ic('home')}Evdeyim</button><button data-a="mode" data-v="out" class="${d.mode === 'out' ? 'on' : ''}" ${d.mode === 'out' ? 'disabled' : ''}>${ic('pin')}Dışarıdayım</button></div>` : '<div></div>';
    return `<div class="card" data-id="${esc(id)}">${head}${gauges}<div class="meta">${chips}</div>
      <button class="pri hero" data-a="screen">${ic('mon')}<span>Ekranı aç<small>Gör, dokun, yaz</small></span><i class="arr">›</i></button>
      <div class="tiles">${tiles}</div>
      <div class="foot2">${mode}<button class="ib sleep" data-a="hib" aria-label="Uyut">${ic('moon')}</button></div>
      ${d.mode === 'out' ? '<div class="hint">Dışarıdayım: kapatınca 20 dakikada bir uyanıp sinyal bekler.</div>' : ''}</div>`;
  }).join('');
};
document.addEventListener('click', e => {
  const m = e.target.closest('[data-more]');
  document.querySelectorAll('.card .menu.show').forEach(x => { if (!m || x !== m.nextElementSibling) x.classList.remove('show'); });
  if (m){ e.stopPropagation(); m.nextElementSibling.classList.toggle('show'); }
}, true);
/* ana koddaki 15 sn'lik zamanlayici eski cizimi tutuyor: eski kart gorunurse hemen yenisini ciz */
new MutationObserver(() => { if (document.querySelector('#grid .foot')) render(); }).observe($('grid'), {childList: true});
render();
