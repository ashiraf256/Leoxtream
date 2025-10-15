/* script.js - LeoXtream public UI */
/* Expects window.LEO_CONFIG.MOVIES_JSON_RAW to be set before init functions are called. */

async function fetchMoviesRaw(){
  const url = (window.LEO_CONFIG && window.LEO_CONFIG.MOVIES_JSON_RAW) || '';
  if(!url) throw new Error('MOVIES_JSON_RAW not configured');
  const res = await fetch(url + '?_=' + Date.now());
  if(!res.ok) throw new Error('Failed to load movies.json');
  const j = await res.json();
  // accept either array or { movies: [] }
  if(Array.isArray(j)) return j;
  if(j && Array.isArray(j.movies)) return j.movies;
  throw new Error('Invalid JSON shape');
}

function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function escapeAttr(s){ return escapeHtml(s).replaceAll('"','&quot;'); }

/* ---------- HOME page init ---------- */
async function initLeoHome(){
  try{
    const movies = await fetchMoviesRaw();
    window._leo_movies = movies.map((m,i)=>({ id: m.id ?? ('m'+i), ...m }));
    const featured = pickFeatured(window._leo_movies);
    renderHero(featured);
    renderSections(window._leo_movies);
    // open detail from ?id= query if present
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    if(id) openOverlay(id);
    // search
    document.getElementById('searchInput').addEventListener('input', (e)=>{
      const q = e.target.value.trim().toLowerCase();
      if(!q) renderSections(window._leo_movies);
      else renderSections(window._leo_movies.filter(m => ((m.title||'') + ' ' + (m.overview||'') + ' ' + (m.category||'')).toLowerCase().includes(q)));
    });
  }catch(err){
    document.getElementById('main').innerHTML = '<div style="color:#f66;padding:18px">Failed to load movie data. Check config.</div>';
    console.error(err);
  }
}

function pickFeatured(list){
  const withDate = list.filter(m=>m.createdAt);
  if(withDate.length) return withDate.sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt))[0];
  return list[0] || null;
}

function renderHero(feature){
  const out = document.getElementById('heroWrap');
  if(!feature) { out.innerHTML=''; return; }
  const poster = feature.poster || '';
  out.innerHTML = `
    <div class="hero">
      <div class="hero-card" aria-hidden="true">
        <div class="bg" style="background-image:url('${escapeAttr(poster)}')"></div>
        <div class="info">
          <div class="hero-title">${escapeHtml(feature.title)}</div>
          <div class="hero-desc">${escapeHtml((feature.overview||'').slice(0,240))}</div>
          <div style="margin-top:12px">
            <a class="pill" href="movie.html?id=${encodeURIComponent(feature.id)}">Watch</a>
            ${feature.trailer ? `<a class="pill" href="${escapeAttr(feature.trailer)}" target="_blank">Trailer</a>` : ''}
          </div>
        </div>
      </div>
      <div class="hero-side">
        <div style="font-weight:700">Featured</div>
        <div style="margin-top:8px;color:var(--muted)">${escapeHtml(feature.category||'')}</div>
        <div style="margin-top:12px" class="meta-row">
          <div class="pill">${escapeHtml(feature.type||'Movie')}</div>
          <div class="pill">${escapeHtml(feature.createdAt? new Date(feature.createdAt).getFullYear() : '')}</div>
        </div>
      </div>
    </div>
  `;
}

function groupByCategory(list){
  const map = {};
  list.forEach(m=>{
    const cat = m.category || 'Unsorted';
    if(!map[cat]) map[cat]=[];
    map[cat].push(m);
  });
  return map;
}

function renderSections(list){
  const sections = document.getElementById('sections');
  sections.innerHTML = '';
  const byCat = groupByCategory(list);
  const latest = list.slice().sort((a,b)=> new Date(b.createdAt||0) - new Date(a.createdAt||0)).slice(0,12);
  const order = [];
  if(byCat['VJ']) order.push('VJ');
  if(byCat['Series']) order.push('Series');
  order.push('Latest');
  Object.keys(byCat).forEach(c => { if(!order.includes(c)) order.push(c); });

  order.forEach(cat=>{
    let items = cat === 'Latest' ? latest : byCat[cat] || [];
    if(!items.length) return;
    const sec = document.createElement('section'); sec.className='section';
    sec.innerHTML = `
      <div class="section-header"><h3>${escapeHtml(cat)}</h3><div class="small" style="color:var(--muted)">${items.length} items</div></div>
      <div class="row" data-cat="${escapeAttr(cat)}"></div>
    `;
    sections.appendChild(sec);
    const row = sec.querySelector('.row');
    items.forEach(m=>{
      const card = document.createElement('div'); card.className='card';
      card.innerHTML = `
        <img class="poster" src="${escapeAttr(m.poster||'')}" alt="${escapeHtml(m.title||'')}" />
        <div class="card-body">
          <div class="title">${escapeHtml(m.title||'')}</div>
          <div class="meta"><div class="small">${escapeHtml(m.type||'')}</div><div><a class="pill" href="movie.html?id=${encodeURIComponent(m.id)}">Play</a></div></div>
        </div>
      `;
      card.addEventListener('click', ()=> { location.href = 'movie.html?id=' + encodeURIComponent(m.id); });
      row.appendChild(card);
    });
  });
}

/* ---------- movie page init ---------- */
async function initLeoMoviePage(){
  try{
    const movies = await fetchMoviesRaw();
    const list = movies.map((m,i)=> ({ id: m.id ?? ('m'+i), ...m }));
    const params = new URLSearchParams(location.search);
    const id = params.get('id');
    const target = id ? list.find(x=>String(x.id) === String(id)) : null;
    const out = document.getElementById('pageMain');
    if(!target){ out.innerHTML = '<div style="padding:18px;color:#f66">Movie not found.</div>'; return; }
    const related = list.filter(x=>x.category === target.category && x.id != target.id).slice(0,8);
    out.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 360px;gap:18px;align-items:start">
        <div>
          <div class="player"><iframe src="${escapeAttr(target.video)}" allowfullscreen="allowfullscreen"></iframe></div>
          <div class="details">
            <h1>${escapeHtml(target.title)}</h1>
            <p style="color:var(--muted)">${escapeHtml(target.overview||'')}</p>
            <p><b>Cast:</b> ${escapeHtml(target.cast||'')}</p>
            ${target.download ? `<a class="pill" href="${escapeAttr(target.download)}" target="_blank">Download</a>` : ''}
          </div>
        </div>
        <aside style="background:var(--panel);padding:12px;border-radius:8px">
          <img src="${escapeAttr(target.poster||'')}" style="width:100%;border-radius:6px" />
          <div style="margin-top:10px;color:var(--muted)">${escapeHtml(target.category||'')}</div>
        </aside>
      </div>

      <div style="margin-top:18px">
        <h2 style="color:var(--accent)">You may also like</h2>
        <div class="row">
          ${related.map(r=> `
            <div class="card" onclick="location='movie.html?id=${encodeURIComponent(r.id)}'">
              <img class="poster" src="${escapeAttr(r.poster||'')}" />
              <div class="card-body"><div class="title">${escapeHtml(r.title)}</div></div>
            </div>`).join('')}
        </div>
      </div>
    `;
  }catch(err){
    document.getElementById('pageMain').innerHTML = '<div style="padding:18px;color:#f66">Failed to load movie data.</div>';
    console.error(err);
  }
}

/* helper used by movie page */
async function fetchMoviesRaw(){
  const url = (window.LEO_CONFIG && window.LEO_CONFIG.MOVIES_JSON_RAW) || '';
  if(!url) throw new Error('MOVIES_JSON_RAW not configured');
  const res = await fetch(url + '?_=' + Date.now());
  if(!res.ok) throw new Error('Failed to load movies.json');
  const j = await res.json();
  if(Array.isArray(j)) return j;
  if(j && Array.isArray(j.movies)) return j.movies;
  throw new Error('Invalid JSON shape');
}

/* ---------- overlay detail (home) ---------- */
const overlayEl = typeof document !== 'undefined' ? document.getElementById('overlay') : null;
const detailEl = typeof document !== 'undefined' ? document.getElementById('detail') : null;

function openOverlay(id){
  const m = (window._leo_movies || []).find(x=>String(x.id) === String(id));
  if(!m) return alert('Movie not found');
  if(!overlayEl || !detailEl) { location.href = 'movie.html?id=' + encodeURIComponent(m.id); return; }
  detailEl.innerHTML = `
    <div class="top" style="display:flex;gap:18px">
      <img class="poster-large" src="${escapeAttr(m.poster||'')}" />
      <div class="info">
        <h2>${escapeHtml(m.title)}</h2>
        <div style="color:var(--muted)">${escapeHtml(m.category||'')}</div>
        <p style="margin-top:10px;color:var(--muted)">${escapeHtml(m.overview||'')}</p>
        <div class="player">${m.video ? `<iframe src="${escapeAttr(m.video)}" allowfullscreen="allowfullscreen"></iframe>` : '<div style="color:var(--muted)">No video</div>'}</div>
        <div style="margin-top:8px">${m.download ? `<a class="pill" href="${escapeAttr(m.download)}" target="_blank">Download</a>` : ''} ${m.trailer? `<a class="pill" href="${escapeAttr(m.trailer)}" target="_blank" style="margin-left:8px">Trailer</a>`: ''}</div>
      </div>
    </div>

    <div style="margin-top:18px">
      <h3 style="color:var(--accent)">You may also like</h3>
      <div class="row">
        ${(window._leo_movies||[]).filter(x => x.category === m.category && x.id != m.id).slice(0,8).map(x=>`
          <div class="card" onclick="openOverlay('${x.id}')">
            <img class="poster" src="${escapeAttr(x.poster||'')}" />
            <div class="card-body"><div class="title">${escapeHtml(x.title)}</div></div>
          </div>`).join('')}
      </div>
    </div>
  `;
  overlayEl.classList.add('open');
  overlayEl.setAttribute('aria-hidden','false');
  history.replaceState(null,'','?id=' + encodeURIComponent(m.id));
}

if(typeof document !== 'undefined'){
  document.getElementById('closeOverlay').addEventListener('click', ()=>{ overlayEl.classList.remove('open'); overlayEl.setAttribute('aria-hidden','true'); history.replaceState(null,'', location.pathname); });
  }
