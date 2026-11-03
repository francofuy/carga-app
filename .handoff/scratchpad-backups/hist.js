  /* ================= Historial: libro mayor por fecha + calendario ================= */
  const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const H = { view: 'mayor', f: 'all', closed: new Set(), sel: null, y: null, m: null, day: undefined, dir: 0, lastF: 'all' };
  const hTime = (c) => new Date(c.startAt);
  const chev = '<svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4"/></svg>';

  /** Barra de franjas de una carga en Casa (Valle / Llano / Punta); contorno para las públicas, que no tienen franja. */
  function stackH(c) {
    if (c.location === 'public') return '<div class="outl"></div>';
    const t = c.valleKwh + c.llanoKwh + c.puntaKwh || 1;
    return `<div class="stackh">${[['v1', c.valleKwh], ['v2', c.llanoKwh], ['v3', c.puntaKwh]].map(([k, v]) => `<i class="${k}" style="flex:${v / t}"></i>`).join('')}</div>`;
  }
  const hWhere = (c) => (c.location === 'home' ? `Casa · Valle ${Math.round((c.valleKwh / c.kwh) * 100)}%` : esc(c.network || 'Pública'));
  const hPct = (c) => (c.startPct != null ? ` · ${pctTxt(c.startPct)}→${pctTxt(c.endPct)}%` : '');
  function hDetail(c) {
    const d = hTime(c), kv = (l, v, em = '') => `<div class="dk"><span>${l}</span><b>${v}${em ? `<em>${em}</em>` : ''}</b></div>`;
    let h = '<div class="det">';
    if (c.location === 'home') {
      const e = new Date(c.endAt), p = (k) => Math.round((c[k + 'Kwh'] / c.kwh) * 100);
      h += kv('Horario', `${hhmm(d)} → ${hhmm(e)}`, fmtDur((e - d) / 60000)) + `<div class="dbar">${stackH(c)}</div>` + kv('Franjas', `Valle ${p('valle')}%`, `Llano ${p('llano')}% · Punta ${p('punta')}%`);
    } else h += kv('Red', esc(c.network || 'Pública')) + kv('Precio', `${money2(c.pricePerKwh)}/kWh`, c.fixedFee > 0 ? `+ ${money(c.fixedFee)} fijo` : '');
    if (c.startPct != null) h += kv('Batería', `${pctTxt(c.startPct)} → ${pctTxt(c.endPct)}%`);
    h += kv('Odómetro', c.odometerKm != null ? `${int(c.odometerKm)} km` : '—') + kv('Costo por kWh', money2(c.cost / c.kwh));
    return h + `<button class="ddel" data-del="${c.id}">Eliminar esta carga</button></div>`;
  }
  const hLegend = '<div class="legend"><span class="l1">Valle</span><span class="l2">Llano</span><span class="l3">Punta</span><span class="l4">Pública</span></div>';
  const hTabs = () => `<div class="htabs" role="group" aria-label="Filtrar">${[['all', 'Todas'], ['home', 'Casa'], ['public', 'Pública']].map(([k, l]) => `<button data-f="${k}" aria-pressed="${H.f === k}">${l}</button>`).join('')}</div>`;
  const hList = () => S.charges.filter((c) => H.f === 'all' || c.location === H.f);
  const hSummary = (list) => `<p class="hsub"><b>${money(list.reduce((a, c) => a + c.cost, 0))}</b> · ${int(list.reduce((a, c) => a + c.kwh, 0))} kWh · ${list.length} ${list.length === 1 ? 'carga' : 'cargas'}</p>`;

  /* ----- Libro mayor: meses con su total y barras comparables, cada carga se despliega en el lugar ----- */
  function mayorHtml() {
    const all = [...S.charges], maxCost = Math.max(...all.map((c) => c.cost), 1), list = hList();
    const groups = new Map();
    [...list].sort((a, b) => hTime(b) - hTime(a)).forEach((c) => { const k = `${hTime(c).getFullYear()}-${hTime(c).getMonth()}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
    const totals = [...groups.values()].map((g) => g.reduce((a, c) => a + c.cost, 0)), maxT = Math.max(...totals, 1);
    const rowHtml = (c) => `<li class="rw${H.sel === c.id ? ' open' : ''}" data-id="${c.id}"><button class="rwb" aria-expanded="${H.sel === c.id}"><span class="d">${shortDate(hTime(c))}</span><span><b>${kwhTxt(c.kwh)} kWh</b><i>${hWhere(c)}${hPct(c)}</i></span><span class="c">${money(c.cost)}</span></button>`
      + `<div class="rbar"><div style="width:${Math.max(1.5, (c.cost / maxCost) * 100)}%;height:100%">${stackH(c)}</div></div><div class="exp"><div>${H.sel === c.id ? hDetail(c) : ''}</div></div></li>`;
    const body = [...groups].map(([k, g], i) => {
      const open = !H.closed.has(k), t = totals[i], kwh = g.reduce((a, c) => a + c.kwh, 0), m = hTime(g[0]);
      return `<section class="mon" data-open="${open}" data-k="${k}"><button data-m="${k}" aria-expanded="${open}"><span class="n">${chev}${MONTHS[m.getMonth()]}</span><span class="t">${money(t)}</span></button><div class="s"><span>${g.length} ${g.length === 1 ? 'carga' : 'cargas'} · ${int(kwh)} kWh</span><span>${money2(t / kwh)}/kWh</span></div><div class="mbar" style="width:${(t / maxT) * 100}%"></div></section>`
        + `<div class="rows" data-open="${open}" data-k="${k}"><ul>${g.map(rowHtml).join('')}</ul></div>`;
    }).join('');
    return `<div class="hh">${hSummary(list)}${hTabs()}</div><div class="hscroll" id="hscroll">${body || '<p class="note">No hay cargas para mostrar.</p>'}${hLegend}</div>`;
  }

  /* ----- Calendario: cada día es una barra de energía apilada por franja ----- */
  function calHtml() {
    const list = hList();
    if (H.y == null) { const last = [...S.charges].sort((a, b) => hTime(b) - hTime(a))[0], d = last ? hTime(last) : new Date(); H.y = d.getFullYear(); H.m = d.getMonth(); }
    const first = new Date(H.y, H.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(H.y, H.m + 1, 0).getDate(), now = new Date();
    const inMonth = list.filter((c) => hTime(c).getFullYear() === H.y && hTime(c).getMonth() === H.m);
    const byDay = new Map(); inMonth.forEach((c) => { const d = hTime(c).getDate(); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(c); });
    // al cambiar de mes (o filtro) se elige solo el último día con cargas; un toque en un día vacío se respeta
    if (H.day === undefined || (H.day != null && H.f !== H.lastF)) H.day = byDay.size ? Math.max(...byDay.keys()) : null;
    H.lastF = H.f; calCache = { byDay };
    const maxKwh = Math.max(...S.charges.map((c) => c.kwh), 1), cells = [];
    for (let i = 0; i < Math.ceil((lead + days) / 7) * 7; i++) {
      const d = i - lead + 1;
      if (d < 1 || d > days) { cells.push('<span></span>'); continue; }
      const cs = byDay.get(d) || [], isToday = H.y === now.getFullYear() && H.m === now.getMonth() && d === now.getDate();
      const bars = cs.map((c) => {
        const h = Math.max(4, (c.kwh / maxKwh) * 38);
        if (c.location === 'public') return `<span style="height:${h}px"><div class="outl"></div></span>`;
        const t = c.valleKwh + c.llanoKwh + c.puntaKwh;
        return `<span style="height:${h}px"><span class="stackv">${[['v1', c.valleKwh], ['v2', c.llanoKwh], ['v3', c.puntaKwh]].filter(([, v]) => v / t > 0.001).map(([k, v]) => `<i class="${k}" style="flex:${v / t}"></i>`).join('')}</span></span>`;
      }).join('');
      const lbl = `${d} de ${MONTHS[H.m]}${cs.length ? `, ${cs.length} ${cs.length === 1 ? 'carga' : 'cargas'}, ${kwhTxt(cs.reduce((a, c) => a + c.kwh, 0))} kWh` : ', sin cargas'}`;
      cells.push(`<button class="day${isToday ? ' today' : ''}" data-d="${d}" aria-label="${lbl}" aria-pressed="${H.day === d}"><span class="dn">${d}</span><span class="dbars">${bars}</span></button>`);
    }
    const nav = (k, p) => `<button class="mnav" data-nav="${k}" aria-label="${k < 0 ? 'Mes anterior' : 'Mes siguiente'}"><svg width="20" height="20" viewBox="0 0 20 20"><path d="${p}"/></svg></button>`;
    const anim = H.dir ? ` slide${H.dir < 0 ? ' back' : ''}` : '';
    H.dir = 0;
    return `<div class="hh">${hSummary(inMonth)}${hTabs()}<div class="mhead"><h3>${MONTHS[H.m]} ${H.y}</h3><div>${nav(-1, 'M12 4l-6 6 6 6')}${nav(1, 'M8 4l6 6-6 6')}</div></div>`
      + `<div class="wk">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<span>${x}</span>`).join('')}</div><div class="gridwrap${anim}"><div class="cgrid">${cells.join('')}</div></div>${hLegend}</div><div class="cal-det" id="caldet">${calDetail()}</div>`;
  }
  let calCache = { byDay: new Map() };
  function calDetail() {
    if (H.day == null) return '<p class="none">Tocá un día para ver sus cargas.</p>';
    const d = new Date(H.y, H.m, H.day), cs = calCache.byDay.get(H.day) || [];
    return `<h4>${cap(DOW[d.getDay()])} ${d.getDate()} de ${MONTHS[d.getMonth()]}</h4>`
      + (cs.map((c) => `<div class="cd"><div class="top"><b>${kwhTxt(c.kwh)} kWh</b><span>${money(c.cost)}</span></div><div class="l2">${hWhere(c)}${hPct(c)}</div>${hDetail(c)}</div>`).join('') || '<p class="none">Sin cargas ese día.</p>');
  }

  function renderList() {
    document.querySelectorAll('#hView button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === H.view));
    $('#hist').innerHTML = H.view === 'mayor' ? mayorHtml() : calHtml();
  }
  const calGo = (k) => { const d = new Date(H.y, H.m + k, 1); H.y = d.getFullYear(); H.m = d.getMonth(); H.day = undefined; H.dir = k; renderList(); };
  $('#hView').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b && b.dataset.view !== H.view) { H.view = b.dataset.view; renderList(); } });
  $('#hist').addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]'), m = e.target.closest('[data-m]'), del = e.target.closest('[data-del]'), row = e.target.closest('.rwb'), nav = e.target.closest('[data-nav]'), day = e.target.closest('[data-d]');
    if (f) { H.f = f.dataset.f; H.sel = null; renderList(); }
    else if (del) {
      if (confirm('¿Eliminar esta carga? No se puede deshacer.')) { S.charges = S.charges.filter((c) => c.id !== Number(del.dataset.del)); H.sel = null; persist(); renderAll(); }
    } else if (m) { // plegar o abrir un mes sin redibujar: la altura se anima
      const k = m.dataset.m, open = H.closed.has(k);
      open ? H.closed.delete(k) : H.closed.add(k);
      $('#hist').querySelectorAll(`[data-k="${k}"]`).forEach((el) => (el.dataset.open = open));
      m.setAttribute('aria-expanded', open);
    } else if (row) { // desplegar una carga en el lugar
      const li = row.closest('.rw'), id = Number(li.dataset.id), prev = H.sel;
      H.sel = prev === id ? null : id;
      if (prev != null) { const p = $('#hist').querySelector(`.rw[data-id="${prev}"]`); if (p) { p.classList.remove('open'); p.querySelector('.rwb').setAttribute('aria-expanded', 'false'); } }
      if (H.sel === id) { const c = S.charges.find((x) => x.id === id); const box = li.querySelector('.exp > div'); if (!box.firstChild) box.innerHTML = hDetail(c); li.classList.add('open'); row.setAttribute('aria-expanded', 'true'); }
    } else if (nav) calGo(Number(nav.dataset.nav));
    else if (day) { // elegir un día: cambia la selección y el detalle, no la grilla
      H.day = Number(day.dataset.d);
      $('#hist').querySelectorAll('.day').forEach((b) => b.setAttribute('aria-pressed', b === day));
      $('#caldet').innerHTML = calDetail();
    }
  });
  (function swipeMonths() { // deslizar el calendario cambia de mes
    let x0 = null, y0 = 0;
    $('#hist').addEventListener('pointerdown', (e) => { if (H.view === 'cal' && e.target.closest('.gridwrap')) { x0 = e.clientX; y0 = e.clientY; } });
    $('#hist').addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) calGo(dx < 0 ? 1 : -1);
    });
  })();

