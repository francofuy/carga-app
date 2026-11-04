/*
 * Laboratorio de efectos: una capa OPCIONAL sobre la app real. Se carga solo desde lab.html (nunca desde carga.html).
 * Todo empieza apagado (la app se ve idéntica); el botón «Lab» abre la hoja con los efectos. Los ajustes quedan en 'carga.lab.fx'.
 * Los efectos usan solo el DOM de la app (#bg, #rail, .tray, .fn, svg.chip…): no tocan su código ni sus datos.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement, app = $('#app'), bg = $('#bg'), rail = $('#rail'), KEY = 'carga.lab.fx';
  if (!app || !bg || !rail) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const DEF = { tilt: 0, shine: false, spin: 0, pop: false, filled: false, tex: 'ninguna', hue: 0, sat: 100, chipColor: null, edgeColor: null,
    particles: 0, aurora: false, grain: 0, vignette: 0, wave: 0, waveN: 3, waveOpa: 100,
    spot: false, glass: 0, blur: 0, rad: 44, trans: 'normal', stagger: false, haptic: false, sound: false, font: 'normal' };
  let FX = { ...DEF };
  try { Object.assign(FX, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(FX)); } catch (_) {} };

  /* ---------- Texturas extra para las fichas (trazos planos sobre un círculo de 126) ---------- */
  const r1 = (n) => Math.round(n * 10) / 10, rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const TEX = {
    panal: [() => { const R = 9, w = Math.sqrt(3) * R; let d = ''; for (let row = -1; row <= 16; row++) for (let col = -1; col <= 16; col++) { const cx = col * w + (row % 2 ? w / 2 : 0), cy = row * 1.5 * R; let p = ''; for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; p += `${k ? 'L' : 'M'}${r1(cx + R * Math.cos(a))} ${r1(cy + R * Math.sin(a))}`; } d += p + 'z'; } return d; }, 1.2, 'round'],
    circuito: [() => { const g = 14, R = rng(11); let d = ''; for (let y = 0; y <= 126; y += g) for (let x = 0; x <= 126; x += g) { const a = R(); if (a < 0.28) d += `M${x} ${y}h${g}`; else if (a < 0.5) d += `M${x} ${y}v${g}`; else if (a < 0.62) d += `M${x} ${y}l${g} ${g}`; if (R() < 0.2) d += `M${x} ${y}h0`; } return d; }, 1.5, 'round'],
    topografia: [() => { let d = ''; for (let k = 1; k <= 8; k++) { const r0 = k * 7.5; for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2, r = r0 * (1 + 0.16 * Math.sin(a * 3 + k * 0.9) + 0.1 * Math.sin(a * 5 - k * 0.6)); d += `${i ? 'L' : 'M'}${r1(63 + r * Math.cos(a))} ${r1(63 + r * Math.sin(a))}`; } d += 'z'; } return d; }, 1.3, 'round'],
    estrellas: [() => { const R = rng(5); let d = ''; for (let i = 0; i < 46; i++) { const x = R() * 126, y = R() * 126, s = 2 + R() * 3.5; d += `M${r1(x - s)} ${r1(y)}h${r1(2 * s)}M${r1(x)} ${r1(y - s)}v${r1(2 * s)}`; } return d; }, 1.2, 'round'],
    carbono: [() => { const s = 8; let d = ''; for (let j = 0; j <= 16; j++) for (let i = 0; i <= 16; i++) { const x = i * s, y = j * s; d += (i + j) % 2 ? `M${x} ${y}l${s} ${s}` : `M${x} ${y + s}l${s} ${-s}`; } return d; }, 1.4, 'butt'],
    cruces: [() => { let d = ''; for (let y = 7; y < 126; y += 14) for (let x = Math.round(y / 14) % 2 ? 7 : 0; x < 126; x += 14) d += `M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5`; return d; }, 1.3, 'round'],
    zigzag: [() => { let d = ''; for (let y = 6; y < 132; y += 12) { d += `M-2 ${y}`; for (let i = 0; i < 28; i++) d += `l5 ${i % 2 ? -5 : 5}`; } return d; }, 1.5, 'round'],
  };
  const texPath = {};
  let uid = 0;
  function injectTex(svg) {
    const T = TEX[FX.tex], body = svg.querySelector('circle.body');
    if (!T || !body || svg.querySelector('.lab-txg')) return;
    const id = `labc${++uid}`, g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'lab-txg');
    g.innerHTML = `<clipPath id="${id}"><circle cx="63" cy="63" r="63"/></clipPath><g clip-path="url(#${id})"><path class="lab-tx" d="${texPath[FX.tex] ??= T[0]()}" stroke-width="${T[1]}" stroke-linecap="${T[2]}"/></g>`;
    body.after(g);
  }
  function applyTex() { $$('.lab-txg').forEach((g) => g.remove()); if (TEX[FX.tex]) $$('svg.chip').forEach(injectTex); }
  // las fichas se vuelven a dibujar al personalizarlas: la textura se pone de nuevo
  new MutationObserver((list) => {
    if (!TEX[FX.tex]) return;
    for (const m of list) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches('svg.chip')) injectTex(n); else n.querySelectorAll('svg.chip').forEach(injectTex); } });
  }).observe(app, { childList: true, subtree: true });

  /* ---------- Carrusel 3D: cada ficha sabe cuánto se aleja del centro ---------- */
  function tilt() { const p = rail.scrollLeft / 100; $$('.slot', rail).forEach((s, i) => s.firstElementChild.style.setProperty('--lab-d', FX.tilt > 0 ? Math.max(-2, Math.min(2, i - p)).toFixed(3) : '0')); }
  rail.addEventListener('scroll', () => { if (FX.tilt > 0) requestAnimationFrame(tilt); }, { passive: true });

  /* ---------- Rebote al elegir la ficha del centro ---------- */
  rail.addEventListener('pointerdown', (e) => {
    const c = FX.pop && e.target.closest('.slot') && e.target.closest('.slot').firstElementChild;
    if (c && parseFloat(getComputedStyle(c).getPropertyValue('--k')) > 0.9 && c.animate) c.animate([{ scale: 1 }, { scale: 0.88, offset: 0.25 }, { scale: 1.08, offset: 0.6 }, { scale: 1 }], { duration: 460, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  });

  /* ---------- Capas del fondo ---------- */
  const layer = (name, cls, html = '') => { let el = $('.' + name, bg); if (!el) { el = document.createElement('div'); el.className = `lab-layer ${cls || ''} ${name}`; el.innerHTML = html; bg.appendChild(el); } return el; };
  const dropLayer = (name) => { const el = $('.' + name, bg); if (el) el.remove(); };
  const NOISE = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>')}")`;

  /* ---------- Partículas ---------- */
  let pc = null, pctx = null, parts = [], raf = 0, last = 0;
  function sizeCanvas() { if (!pc) return; const d = Math.min(2, devicePixelRatio || 1), w = bg.clientWidth, h = bg.clientHeight; pc.width = w * d; pc.height = h * d; pctx.setTransform(d, 0, 0, d, 0, 0); }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!pc || document.hidden || app.classList.contains('fn-open')) return;
    const w = bg.clientWidth, h = bg.clientHeight;
    pctx.clearRect(0, 0, w, h);
    pctx.fillStyle = getComputedStyle(root).getPropertyValue('--bgk').trim() || '#4fb58a';
    for (const p of parts) {
      p.y -= p.v * dt; p.ph += dt * p.f;
      if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
      pctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.ph * 2));
      pctx.beginPath(); pctx.arc(p.x + Math.sin(p.ph) * 14, p.y, p.r, 0, 7); pctx.fill();
    }
  }
  function particles() {
    cancelAnimationFrame(raf); const old = $('.lab-particles', bg); if (old) old.remove(); pc = null;
    if (!(FX.particles > 0) || reduce.matches) return;
    pc = document.createElement('canvas'); pc.className = 'lab-layer lab-particles'; bg.appendChild(pc);
    pctx = pc.getContext('2d'); sizeCanvas();
    const w = bg.clientWidth, h = bg.clientHeight;
    parts = Array.from({ length: FX.particles }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 1.8, v: 8 + Math.random() * 18, a: 0.25 + Math.random() * 0.4, ph: Math.random() * 6, f: 0.4 + Math.random() * 0.8 }));
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  addEventListener('resize', () => { if (pc) particles(); });

  /* ---------- Luz que sigue al dedo en la bandeja ---------- */
  const tray = $('.tray');
  const spot = (e) => { if (!FX.spot || !tray) return; const r = tray.getBoundingClientRect(); tray.style.setProperty('--mx', `${e.clientX - r.left}px`); tray.style.setProperty('--my', `${e.clientY - r.top}px`); };
  if (tray) { tray.addEventListener('pointermove', spot); tray.addEventListener('pointerdown', spot); }

  /* ---------- Háptica (interruptor invisible de Safari) y sonido ---------- */
  const hl = Object.assign(document.createElement('label'), { style: 'position:fixed;left:-80px;top:0;opacity:0;pointer-events:none' }), hi = document.createElement('input');
  hi.type = 'checkbox'; hi.setAttribute('switch', ''); hl.appendChild(hi); document.body.appendChild(hl);
  let ac = null;
  const buzz = () => { if (FX.haptic) { try { hl.click(); } catch (_) {} } };
  const blip = () => {
    if (!FX.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = 'sine'; o.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.06);
    } catch (_) {}
  };
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('button, .slot') && !e.target.closest('.lab-sheet')) { buzz(); blip(); } }, true);
  let lastI = -1;
  rail.addEventListener('touchmove', () => { const i = Math.round(rail.scrollLeft / 100); if (i !== lastI) { lastI = i; buzz(); blip(); } }, { passive: true });

  /* ---------- Entrada escalonada de las listas ---------- */
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: Array.from({ length: 12 }, (_, i) => `html.fx-stagger .fn.open :is(.scroll, .hh, .center) > :nth-child(${i + 1}) { animation: labrise 520ms var(--ease-out) ${(i + 1) * 40}ms backwards; }`).join('\n') }));

  /* ---------- Aplicar todo ---------- */
  function apply() {
    const cl = root.classList, st = root.style, on = (c, v) => cl.toggle(c, !!v);
    on('fx-tilt', FX.tilt > 0); st.setProperty('--fx-tilt', FX.tilt); tilt();
    on('fx-shine', FX.shine); on('fx-spin', FX.spin > 0); st.setProperty('--fx-spin', FX.spin || 60); on('fx-filled', FX.filled);
    on('fx-hue', FX.hue !== 0 || FX.sat !== 100); st.setProperty('--fx-hue', FX.hue); st.setProperty('--fx-sat', FX.sat);
    on('fx-cc', FX.chipColor); if (FX.chipColor) st.setProperty('--fx-cc', FX.chipColor);
    on('fx-ce', FX.edgeColor); if (FX.edgeColor) st.setProperty('--fx-ce', FX.edgeColor);
    applyTex();
    FX.aurora ? layer('lab-aurora', 'lab-aurora', '<i></i><i></i><i></i>') : dropLayer('lab-aurora');
    if (FX.grain > 0) { const g = layer('lab-grain', 'lab-grain'); g.style.backgroundImage = NOISE; g.style.opacity = FX.grain / 100; } else dropLayer('lab-grain');
    if (FX.vignette > 0) layer('lab-vig', '').style.background = `radial-gradient(ellipse at 50% 42%, transparent 50%, rgba(0, 0, 0, ${FX.vignette / 100}) 100%)`; else dropLayer('lab-vig');
    particles();
    on('fx-wave', FX.wave > 0); st.setProperty('--fx-wave', FX.wave || 9); on('fx-wave1', FX.waveN === 1); on('fx-wave2', FX.waveN === 2); st.setProperty('--fx-wopa', FX.waveOpa / 100);
    on('fx-spot', FX.spot); on('fx-glass', FX.glass > 0); st.setProperty('--fx-ga', FX.glass); on('fx-blur', FX.blur > 0); st.setProperty('--fx-blur', FX.blur); on('fx-rad', FX.rad !== 44); st.setProperty('--fx-rad', FX.rad);
    ['push', 'sheet', 'zoom', 'fade'].forEach((t) => on('fx-tr-' + t, FX.trans === t));
    on('fx-stagger', FX.stagger);
    ['rounded', 'serif', 'mono'].forEach((f) => on('fx-font-' + f, FX.font === f));
    save(); showJson();
  }

  /* ---------- Hoja del laboratorio ---------- */
  const el = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls || '', innerHTML: html });
  const TEXES = [['ninguna', 'Ninguna'], ['panal', 'Panal'], ['circuito', 'Circuito'], ['topografia', 'Topografía'], ['estrellas', 'Estrellas'], ['carbono', 'Carbono'], ['cruces', 'Cruces'], ['zigzag', 'Zigzag']];
  const UI = [
    ['Fichas', [
      ['rg', 'tilt', 'Carrusel 3D', 'Las fichas se inclinan al pasar', 0, 60, 2, '°'],
      ['sw', 'shine', 'Destello', 'Un reflejo cruza la ficha activa'],
      ['rg', 'spin', 'Aro que gira', 'Segundos por vuelta (0 = quieto)', 0, 120, 5, ' s'],
      ['sw', 'pop', 'Rebote al elegir', 'La ficha del centro salta al tocarla'],
      ['sw', 'filled', 'Íconos rellenos'],
      ['sg', 'tex', 'Textura extra', 'Sobre la textura de cada ficha', TEXES],
      ['rg', 'hue', 'Matiz', 'Gira todos los colores', -180, 180, 5, '°'],
      ['rg', 'sat', 'Saturación', '', 0, 200, 5, '%'],
      ['co', 'chipColor', 'Color libre de las fichas'],
      ['co', 'edgeColor', 'Color libre del borde'],
    ]],
    ['Fondo del inicio', [
      ['rg', 'particles', 'Partículas', 'Puntitos que suben despacio', 0, 80, 5, ''],
      ['sw', 'aurora', 'Aurora', 'Manchas de color que se mueven'],
      ['rg', 'grain', 'Grano de película', '', 0, 40, 2, '%'],
      ['rg', 'vignette', 'Viñeta', 'Oscurece los bordes', 0, 80, 5, '%'],
      ['rg', 'wave', 'Ondas: segundos por ciclo', '0 = como en la app (9 s)', 0, 20, 1, ' s'],
      ['sg', 'waveN', 'Cantidad de ondas', '', [[1, '1'], [2, '2'], [3, '3']]],
      ['rg', 'waveOpa', 'Intensidad de las ondas', '', 0, 200, 10, '%'],
    ]],
    ['Bandeja y cristal', [
      ['sw', 'spot', 'Luz que sigue al dedo', 'Un brillo sobre la bandeja'],
      ['rg', 'glass', 'Opacidad del cristal', '0 = como en la app (82 %)', 0, 100, 5, '%'],
      ['rg', 'blur', 'Desenfoque del cristal', '0 = como en la app (14 px)', 0, 40, 2, ' px'],
      ['rg', 'rad', 'Esquinas de la bandeja', 'Como en la app: 44', 0, 70, 2, ' px'],
    ]],
    ['Movimiento', [
      ['sg', 'trans', 'Al abrir una pantalla', '', [['normal', 'Normal'], ['push', 'Desde el costado'], ['sheet', 'Desde abajo'], ['zoom', 'Zoom'], ['fade', 'Aparece']]],
      ['sw', 'stagger', 'Entrada escalonada', 'Las filas aparecen una tras otra'],
      ['sw', 'haptic', 'Vibración al tocar', 'Solo en iPhone con iOS 18 o más'],
      ['sw', 'sound', 'Sonido suave al tocar'],
    ]],
    ['Tipografía', [['sg', 'font', 'Letra', '', [['normal', 'Normal'], ['rounded', 'Redondeada'], ['serif', 'Serif en títulos'], ['mono', 'Monoespaciada']]]]],
  ];
  const PRESETS = [
    ['Aurora', { aurora: true, grain: 12, vignette: 35, glass: 70, blur: 22, trans: 'zoom' }],
    ['Neón', { shine: true, spin: 30, particles: 30, wave: 6, waveOpa: 140, glass: 55, tex: 'circuito', vignette: 50 }],
    ['Cristal', { glass: 55, blur: 28, rad: 60, spot: true, tilt: 26, shine: true, trans: 'sheet' }],
    ['Retro', { grain: 30, vignette: 55, font: 'serif', tex: 'carbono', trans: 'fade', stagger: true }],
    ['Todo apagado', {}],
  ];
  const btn = el('button', 'lab-btn', 'Lab'), sheet = el('div', 'lab-sheet'), body = el('div', 'lab-body');
  btn.setAttribute('aria-label', 'Laboratorio de efectos'); sheet.inert = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Laboratorio de efectos');
  sheet.innerHTML = '<div class="lab-head"><div><h2>Laboratorio</h2><p>Todo apagado = idéntica a la app. Probá y decime qué te gusta.</p></div><button class="lab-x" aria-label="Cerrar">×</button></div>';
  sheet.appendChild(body);
  const open = (v) => { sheet.classList.toggle('open', v); sheet.inert = !v; };
  btn.addEventListener('click', () => open(!sheet.classList.contains('open')));
  $('.lab-x', sheet).addEventListener('click', () => open(false));
  // tocar fuera de la hoja la cierra
  document.addEventListener('pointerdown', (e) => { if (sheet.classList.contains('open') && !e.target.closest('.lab-sheet, .lab-btn')) open(false); }, true);

  function row(it) {
    const [kind, key, label, sub] = it, r = el('div', 'lab-row'), text = el('div', '', `${label}${sub ? `<small>${sub}</small>` : ''}`);
    r.appendChild(text);
    if (kind === 'sw') {
      const s = el('button', 'lab-sw'); s.setAttribute('role', 'switch'); s.setAttribute('aria-checked', !!FX[key]);
      s.addEventListener('click', () => { FX[key] = !FX[key]; s.setAttribute('aria-checked', FX[key]); apply(); }); r.appendChild(s);
    } else if (kind === 'rg') {
      const [, , , , min, max, step, unit] = it, i = el('input'), o = el('output', '', `${FX[key]}${unit}`);
      Object.assign(i, { type: 'range', min, max, step, value: FX[key] }); i.setAttribute('aria-label', label);
      i.addEventListener('input', () => { FX[key] = Number(i.value); o.textContent = `${FX[key]}${unit}`; apply(); }); r.append(o, i);
    } else if (kind === 'sg') {
      const opts = it[4], g = el('div', 'lab-seg');
      opts.forEach(([v, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(FX[key]) === String(v)); b.addEventListener('click', () => { FX[key] = typeof v === 'number' ? v : v; $$('button', g).forEach((x) => x.setAttribute('aria-pressed', x === b)); apply(); }); g.appendChild(b); });
      r.appendChild(g);
    } else if (kind === 'co') {
      const wrap = el('div', 'lab-seg'), c = el('input'), x = el('button', '', FX[key] ? 'Quitar' : 'Sin usar');
      Object.assign(c, { type: 'color', value: FX[key] || '#4fb58a' }); c.setAttribute('aria-label', label);
      c.addEventListener('input', () => { FX[key] = c.value; x.textContent = 'Quitar'; apply(); });
      x.addEventListener('click', () => { FX[key] = null; x.textContent = 'Sin usar'; apply(); });
      wrap.append(c, x); r.appendChild(wrap);
    }
    return r;
  }
  const json = el('pre', 'lab-json');
  function showJson() { const d = Object.fromEntries(Object.entries(FX).filter(([k, v]) => v !== DEF[k])); json.textContent = Object.keys(d).length ? JSON.stringify(d, null, 1) : 'Sin cambios: igual a la app.'; }
  function build() {
    body.innerHTML = '';
    const pr = el('div', 'lab-presets'); PRESETS.forEach(([n, v]) => { const b = el('button', '', n); b.addEventListener('click', () => { FX = { ...DEF, ...v }; apply(); build(); }); pr.appendChild(b); });
    body.append(el('h4', '', 'Combinaciones'), pr);
    UI.forEach(([title, rows]) => { body.appendChild(el('h4', '', title)); rows.forEach((it) => body.appendChild(row(it))); });
    body.append(el('h4', '', 'Lo que está encendido (para contarme)'), json); showJson();
  }
  build(); document.body.append(btn, sheet);
  apply();
})();
