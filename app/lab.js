/*
 * Laboratorio de efectos: una capa OPCIONAL sobre la app real. Se carga solo desde lab.html (nunca desde carga.html).
 * Todo empieza apagado (la app se ve idéntica); el botón «Lab» abre la hoja con los efectos. Los ajustes quedan en 'carga.lab.fx'.
 * Los efectos usan solo el DOM de la app (#bg, #rail, .tray, .fn, svg.chip…): no tocan su código ni sus datos.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement, app = $('#app'), bg = $('#bg'), rail = $('#rail'), head = $('#head'), KEY = 'carga.lab.fx', MIX_KEY = 'carga.lab.mixes';
  if (!app || !bg || !rail) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), r1 = (n) => Math.round(n * 10) / 10;
  const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hex2rgb = (h) => { h = String(h || '').trim(); if (/^#[0-9a-f]{6}$/i.test(h)) return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const m = h.match(/[\d.]+/g); return m && m.length >= 3 ? m.slice(0, 3).map((v) => (h.startsWith('color(') ? v * 255 : +v)) : [79, 181, 138]; };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`, mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), light = (c, t) => mix(c, [255, 255, 255], t);
  const rgb2hex = (c) => '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

  const DEF = {
    // fichas
    tilt: 0, shine: false, spin: 0, pop: false, float: false, shadow: false, glow: 0, filled: false, chipSize: 100, metal: 'ninguno', bevel: 0, bevelAng: 135,
    tex: 'ninguna', texOpa: 55, texSpin: 0, hue: 0, sat: 100, chipColor: null, edgeColor: null,
    // fondo
    tint: 14, bgkFree: null, gradA: null, gradB: null, gradAng: 180, breathe: false, bgTex: 'ninguna', bgTexOpa: 8, bgTexMove: 0,
    particles: 0, aurora: false, grain: 0, vignette: 0, wave: 0, waveN: 3, waveOpa: 100,
    // escenas
    scene: 'ninguna', sceneInt: 50, sceneSpd: 100, allbg: false, dim: 35, quality: 'alta',
    // luz
    sky: 0, skyAuto: true, skyHour: 12, chipLight: 0, rays: 0, bokeh: 0, flare: 0, leak: 0, fog: 0, rim: false, spot: false, tiltLight: false, titleGlow: 0, shimmer: false,
    // color
    look: 'ninguno', temp: 0, bright: 100, contrast: 100, satG: 100, hueG: 0, toneColor: null, toneOpa: 20, toneMode: 'soft-light', duo: false, duoA: null, duoB: null, spread: 0,
    // iluminación
    key: 0, keyAng: 225, keyColor: null, cone: 0, ambient: 0, stateLight: 0, orbit: 0, touchLight: false, neon: 0, neonCycle: false, chipRim: false,
    // bandeja
    glass: 0, blur: 0, rad: 44, mat: 'ninguno', matOpa: 30,
    // movimiento
    trans: 'normal', stagger: false, intro: false, titleBlur: false, titlePar: false, haptic: false, sound: false,
    // texto y color
    font: 'normal', hw: 300, ls: -35, accent: null,
  };
  let FX = { ...DEF };
  try { Object.assign(FX, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(FX)); } catch (_) {} };
  const Q = () => ({ alta: { dpr: Math.min(2, devicePixelRatio || 1), fps: 60 }, media: { dpr: Math.min(1.5, devicePixelRatio || 1), fps: 40 }, baja: { dpr: 1, fps: 30 } }[FX.quality] || { dpr: 1, fps: 30 });
  const S = () => (window.__carga && window.__carga.S) || { chips: {}, charges: [] };

  /* =====================================================================================================
   * Texturas (trazos planos): cada una dibuja en un rectángulo de w × h. Sirven para las fichas (126 × 126, recortadas al
   * círculo), para el fondo y para la bandeja.
   * ===================================================================================================== */
  const hexLattice = (w, h, ys) => {
    const R = 9, dx = Math.sqrt(3) * R; let d = '';
    for (let row = -1; row <= Math.ceil(h / (1.5 * R)) + 1; row++) for (let col = -1; col <= Math.ceil(w / dx) + 1; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0), cy = row * 1.5 * R, v = (k) => [r1(cx + R * Math.cos(Math.PI / 6 + k * Math.PI / 3)), r1(cy + R * Math.sin(Math.PI / 6 + k * Math.PI / 3))];
      for (let k = 0; k < 6; k++) d += `${k ? 'L' : 'M'}${v(k).join(' ')}`;
      d += 'z'; if (ys) for (const k of [0, 2, 4]) d += `M${r1(cx)} ${r1(cy)}L${v(k).join(' ')}`;
    }
    return d;
  };
  const GEN = {
    panal: (w, h) => hexLattice(w, h, false),
    isometrico: (w, h) => hexLattice(w, h, true),
    circuito: (w, h) => { const g = 14, R = rng(11); let d = ''; for (let y = 0; y <= h; y += g) for (let x = 0; x <= w; x += g) { const a = R(); if (a < 0.28) d += `M${x} ${y}h${g}`; else if (a < 0.5) d += `M${x} ${y}v${g}`; else if (a < 0.62) d += `M${x} ${y}l${g} ${g}`; if (R() < 0.2) d += `M${x} ${y}h0`; } return d; },
    topografia: (w, h) => { const cx = w / 2, cy = h / 2, K = Math.ceil(Math.hypot(w, h) / 2 / 7.5); let d = ''; for (let k = 1; k <= K; k++) { const r0 = k * 7.5, n = clamp(48 + k * 3, 48, 140); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, r = r0 * (1 + 0.16 * Math.sin(a * 3 + k * 0.9) + 0.1 * Math.sin(a * 5 - k * 0.6)); d += `${i ? 'L' : 'M'}${r1(cx + r * Math.cos(a))} ${r1(cy + r * Math.sin(a))}`; } d += 'z'; } return d; },
    fibonacci: (w, h) => { const R = Math.hypot(w, h) / 2, c = Math.max(3.9, R / 38), n = Math.round((R / c) ** 2); let d = ''; for (let i = 0; i < n; i++) { const r = c * Math.sqrt(i), a = i * 2.39996323; d += `M${r1(w / 2 + r * Math.cos(a))} ${r1(h / 2 + r * Math.sin(a))}h0`; } return d; },
    estrellas: (w, h) => { const R = rng(5), n = Math.min(600, Math.round(46 * w * h / 15876)); let d = ''; for (let i = 0; i < n; i++) { const x = R() * w, y = R() * h, s = 2 + R() * 3.5; d += `M${r1(x - s)} ${r1(y)}h${r1(2 * s)}M${r1(x)} ${r1(y - s)}v${r1(2 * s)}`; } return d; },
    carbono: (w, h) => { const s = 8; let d = ''; for (let j = 0; j <= h / s; j++) for (let i = 0; i <= w / s; i++) { const x = i * s, y = j * s; d += (i + j) % 2 ? `M${x} ${y}l${s} ${s}` : `M${x} ${y + s}l${s} ${-s}`; } return d; },
    cruces: (w, h) => { let d = ''; for (let y = 7; y < h; y += 14) for (let x = Math.round(y / 14) % 2 ? 7 : 0; x < w; x += 14) d += `M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5`; return d; },
    zigzag: (w, h) => { let d = ''; for (let y = 6; y < h + 6; y += 12) { d += `M-2 ${y}`; for (let i = 0; i < Math.ceil(w / 5) + 2; i++) d += `l5 ${i % 2 ? -5 : 5}`; } return d; },
    neumatico: (w, h) => { let d = ''; for (let y = 0, row = 0; y < h + 11; y += 11, row++) for (let x = row % 2 ? -7 : 0; x < w + 14; x += 14) d += `M${x} ${y + 6}l7 -6l7 6`; return d; },
    seigaiha: (w, h) => { const R = 9; let d = ''; for (let y = 0, row = 0; y < h + 2 * R; y += 5, row++) for (let x = row % 2 ? R : 0; x < w + 2 * R; x += 2 * R) for (const r of [R, R * 0.66, R * 0.33]) d += `M${r1(x - r)} ${y}A${r1(r)} ${r1(r)} 0 0 1 ${r1(x + r)} ${y}`; return d; },
    azulejos: (w, h) => { const s = 18, R = rng(3), q = s / 2; let d = ''; for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) d += R() < 0.5 ? `M${x + q} ${y}A${q} ${q} 0 0 1 ${x} ${y + q}M${x + s} ${y + q}A${q} ${q} 0 0 0 ${x + q} ${y + s}` : `M${x + q} ${y}A${q} ${q} 0 0 0 ${x + s} ${y + q}M${x} ${y + q}A${q} ${q} 0 0 1 ${x + q} ${y + s}`; return d; },
    halftone: (w, h) => { const D = Math.hypot(w, h) / 2; let d = ''; for (let y = 4; y < h; y += 9) for (let x = 4; x < w; x += 9) { const r = 3.4 * Math.max(0, 1 - Math.hypot(x - w / 2, y - h / 2) / D * 1.05); if (r > 0.4) d += `M${r1(x - r)} ${y}a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0`; } return d; },
    marmol: (w, h) => {
      const R = rng(9); let d = '';
      const walk = (x, y, a, n, st) => { d += `M${r1(x)} ${r1(y)}`; for (let i = 0; i < n; i++) { a += (R() - 0.5) * 0.55; x += Math.cos(a) * st; y += Math.sin(a) * st; d += `L${r1(x)} ${r1(y)}`; if (st > 4 && R() < 0.07) { const sx = x, sy = y, sa = a + (R() < 0.5 ? 1 : -1) * 0.9; d += `M${r1(x)} ${r1(y)}`; let bx = sx, by = sy, ba = sa; for (let j = 0; j < 14; j++) { ba += (R() - 0.5) * 0.7; bx += Math.cos(ba) * 3; by += Math.sin(ba) * 3; d += `L${r1(bx)} ${r1(by)}`; } d += `M${r1(x)} ${r1(y)}`; } } };
      for (let i = 0; i < Math.max(5, Math.round(w * h / 2300)); i++) walk(R() * w, R() < 0.5 ? -4 : h + 4, R() * Math.PI * 2, Math.round(Math.hypot(w, h) / 6.5), 6.5);
      return d;
    },
    madera: (w, h) => { let d = ''; const kx = w * 0.55, ky = h * 0.45; for (let y = 0; y <= h; y += 6) { d += `M0 ${y}`; for (let x = 0; x <= w; x += 4) d += `L${x} ${r1(y + 2.5 * Math.sin(x / 21 + y / 15) + Math.sign(y - ky) * 10 * Math.exp(-(((x - kx) ** 2) / 2200 + ((y - ky) ** 2) / 260)))}`; } return d; },
    cuero: (w, h) => { const R = rng(21), c = 9; let d = ''; for (let gy = 0; gy <= h / c; gy++) for (let gx = 0; gx <= w / c; gx++) { const cx = (gx + 0.5 + (R() - 0.5) * 0.6) * c, cy = (gy + 0.5 + (R() - 0.5) * 0.6) * c, rr = 3.2 + R() * 1.4; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + R() * 0.5, q = rr * (0.85 + R() * 0.3); d += `${k ? 'L' : 'M'}${r1(cx + q * Math.cos(a))} ${r1(cy + q * Math.sin(a))}`; } d += 'z'; } return d; },
    tela: (w, h) => { let d = ''; for (let y = 0; y <= h; y += 3) d += `M0 ${y}H${w}`; for (let x = 0; x <= w; x += 3) d += `M${x} 0V${h}`; return d; },
  };
  const STR = { panal: [1.2, 'round'], isometrico: [1.1, 'round'], circuito: [1.5, 'round'], topografia: [1.3, 'round'], fibonacci: [2.6, 'round'], estrellas: [1.2, 'round'], carbono: [1.4, 'butt'], cruces: [1.3, 'round'], zigzag: [1.5, 'round'],
    neumatico: [1.8, 'round'], seigaiha: [1.2, 'round'], azulejos: [2.2, 'round'], halftone: [1.1, 'round'], marmol: [1.1, 'round'], madera: [1, 'round'], cuero: [1, 'round'], tela: [0.5, 'butt'] };
  const TEXN = [['ninguna', 'Ninguna'], ['panal', 'Panal'], ['isometrico', 'Cubos'], ['circuito', 'Circuito'], ['topografia', 'Topografía'], ['fibonacci', 'Girasol'], ['estrellas', 'Estrellas'], ['carbono', 'Carbono'], ['cruces', 'Cruces'], ['zigzag', 'Zigzag'],
    ['neumatico', 'Neumático'], ['seigaiha', 'Olas japonesas'], ['azulejos', 'Azulejos'], ['halftone', 'Puntos grandes'], ['marmol', 'Mármol'], ['madera', 'Madera'], ['cuero', 'Cuero'], ['tela', 'Tela']];
  const texMemo = {};
  const texPath = (id, w, h) => (texMemo[`${id}|${w}|${h}`] ??= GEN[id](w, h));
  const texUrl = (id, w, h, opa) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${texPath(id, w, h)}" fill="none" stroke="#fff" stroke-opacity="${opa}" stroke-width="${STR[id][0]}" stroke-linecap="${STR[id][1]}"/></svg>`)}")`;

  /* ---------- Texturas de las fichas ---------- */
  let uid = 0;
  function injectTex(svg) {
    const body = svg.querySelector('circle.body'), id = FX.tex;
    if (!GEN[id] || !body || svg.querySelector('.lab-txg')) return;
    const cid = `labc${++uid}`, g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'lab-txg');
    g.innerHTML = `<clipPath id="${cid}"><circle cx="63" cy="63" r="63"/></clipPath><g clip-path="url(#${cid})"><path class="lab-tx" d="${texPath(id, 126, 126)}" stroke-width="${STR[id][0]}" stroke-linecap="${STR[id][1]}"/></g>`;
    body.after(g);
  }
  // reflejo de la luz principal sobre cada ficha (un círculo con degradé compartido, #labKG)
  function injectKey(svg) {
    const body = svg.querySelector('circle.body');
    if (!(FX.key > 0) || !body || svg.querySelector('.lab-kl')) return;
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('class', 'lab-kl'); c.setAttribute('cx', 63); c.setAttribute('cy', 63); c.setAttribute('r', 63); c.setAttribute('fill', 'url(#labKG)');
    (svg.querySelector('.lab-txg') || body).after(c);
  }
  const injectAll = (svg) => { injectTex(svg); injectKey(svg); };
  const wantInject = () => !!GEN[FX.tex] || FX.key > 0;
  let texSig = '';
  function applyTex() { const sig = `${FX.tex}|${FX.key > 0}`; if (sig === texSig) return; texSig = sig; $$('.lab-txg, .lab-kl').forEach((g) => g.remove()); $$('svg.chip').forEach(injectAll); }

  /* ---------- Relieve (iluminación sobre las fichas) ---------- */
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="labBevel" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="2.4" result="b"/><feSpecularLighting in="b" surfaceScale="4" specularConstant="0.9" specularExponent="24" lighting-color="#fff" result="s"><feDistantLight azimuth="135" elevation="55"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="s2"/><feComposite in="SourceGraphic" in2="s2" operator="arithmetic" k1="0" k2="1" k3="0.6" k4="0"/></filter></svg>');
  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><radialGradient id="labKG" cx="0.3" cy="0.3" r="0.75"><stop id="labKG0" offset="0" stop-color="#fff1d6" stop-opacity="0.9"/><stop id="labKG1" offset="1" stop-color="#fff1d6" stop-opacity="0"/></radialGradient>'
    + '<filter id="labDuo" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/><feComponentTransfer><feFuncR id="duoR" type="table" tableValues="0 1"/><feFuncG id="duoG" type="table" tableValues="0 1"/><feFuncB id="duoB" type="table" tableValues="0 1"/></feComponentTransfer></filter></svg>');
  let lightAz = 0;
  function setBevel() { const f = $('#labBevel'); if (!f) return; $('feSpecularLighting', f).setAttribute('surfaceScale', String(FX.bevel * 0.9 || 1)); $('feDistantLight', f).setAttribute('azimuth', String((FX.key > 0 ? FX.keyAng : FX.bevelAng + lightAz) % 360)); }

  /* ---------- Colores de cada ficha y posición del carril ---------- */
  const chipIds = () => Object.keys(S().chips);
  const chipColors = () => chipIds().map((id) => hex2rgb((S().chips[id] || {}).color));
  function colorAt(p) { const cs = chipColors(), n = cs.length || 1, lo = clamp(Math.floor(p), 0, n - 1), hi = Math.min(n - 1, lo + 1); return cs.length ? mix(cs[lo], cs[hi], clamp(p - lo, 0, 1)) : [79, 181, 138]; }
  function slotColors() { const cs = chipColors(); $$('.slot', rail).forEach((s, i) => { const c = s.firstElementChild; c.style.setProperty('--lab-i', i); if (cs[i]) c.style.setProperty('--lab-c', rgb2hex(cs[i])); }); }
  let railRaf = 0;
  function onRail() {
    railRaf = 0; const p = rail.scrollLeft / 100;
    root.style.setProperty('--lab-cc', rgb2hex(colorAt(p)));
    if (FX.tilt > 0 || FX.metal !== 'ninguno') $$('.slot', rail).forEach((s, i) => s.firstElementChild.style.setProperty('--lab-d', clamp(i - p, -2, 2).toFixed(3)));
    if (FX.titlePar && head) { const f = p - Math.round(p); head.style.translate = `${(-f * 46).toFixed(1)}px 0`; head.style.opacity = String(1 - Math.min(0.85, Math.abs(f) * 1.5)); } else if (head) { head.style.translate = ''; head.style.opacity = ''; }
    const t = $('.lab-bgtex', bg); if (t) t.style.setProperty('--lab-px', `${((p / 6 - 0.5) * -34).toFixed(1)}px`);
  }
  rail.addEventListener('scroll', () => { if (!railRaf) railRaf = requestAnimationFrame(onRail); }, { passive: true });
  new MutationObserver(() => { slotColors(); if (wantInject()) $$('svg.chip', rail).forEach(injectAll); }).observe(rail, { childList: true, subtree: true });
  // las fichas también se dibujan en el taller de fichas
  new MutationObserver((list) => { if (!wantInject()) return; for (const m of list) m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.matches('svg.chip')) injectAll(n); else n.querySelectorAll('svg.chip').forEach(injectAll); } }); }).observe($('#fichas') || app, { childList: true, subtree: true });

  /* ---------- Rebote al elegir la ficha del centro ---------- */
  rail.addEventListener('pointerdown', (e) => {
    const c = FX.pop && e.target.closest('.slot') && e.target.closest('.slot').firstElementChild;
    if (c && parseFloat(getComputedStyle(c).getPropertyValue('--k')) > 0.9 && c.animate) c.animate([{ scale: 1 }, { scale: 0.88, offset: 0.25 }, { scale: 1.08, offset: 0.6 }, { scale: 1 }], { duration: 460, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  });

  /* =====================================================================================================
   * Capas del fondo (dentro de .bg, detrás del texto)
   * ===================================================================================================== */
  const ORDER = ['lab-grad', 'lab-breathe', 'lab-bgtex', 'lab-sky', 'lab-scene', 'lab-particles', 'lab-aurora', 'lab-orbit', 'lab-bokeh', 'lab-rays', 'lab-cone', 'lab-key', 'lab-flare', 'lab-leak', 'lab-fog', 'lab-state', 'lab-clight', 'lab-pulses', 'lab-grain', 'lab-vig', 'lab-dim'];
  const reorder = () => ORDER.forEach((n) => { const e = $('.' + n, bg); if (e) bg.appendChild(e); });
  const layer = (name, html = '', tag = 'div') => { let el = $('.' + name, bg); if (!el) { el = document.createElement(tag); el.className = `lab-layer ${name}`; el.innerHTML = html; bg.appendChild(el); reorder(); } return el; };
  const drop = (name) => { const el = $('.' + name, bg); if (el) el.remove(); };
  const NOISE = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.9 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>')}")`;

  /* ---------- Partículas ---------- */
  let pc = null, pctx = null, parts = [], pRaf = 0, pLast = 0;
  function sizeCanvas(cv, g) { const d = Q().dpr, w = bg.clientWidth, h = bg.clientHeight; cv.width = Math.round(w * d); cv.height = Math.round(h * d); g.setTransform(d, 0, 0, d, 0, 0); }
  function pFrame(t) {
    pRaf = requestAnimationFrame(pFrame);
    const dt = Math.min(0.05, (t - pLast) / 1000); pLast = t;
    if (!pc || document.hidden || (app.classList.contains('fn-open') && !FX.allbg)) return;
    const w = bg.clientWidth, h = bg.clientHeight; pctx.clearRect(0, 0, w, h); pctx.fillStyle = rgba(light(hex2rgb(getComputedStyle(root).getPropertyValue('--bgk')), 0.25), 1);
    for (const p of parts) { p.y -= p.v * dt; p.ph += dt * p.f; if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; } pctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.ph * 2)); pctx.beginPath(); pctx.arc(p.x + Math.sin(p.ph) * 14, p.y, p.r, 0, 7); pctx.fill(); }
  }
  function particles() {
    cancelAnimationFrame(pRaf); drop('lab-particles'); pc = null;
    if (!(FX.particles > 0) || reduce.matches) return;
    pc = layer('lab-particles', '', 'canvas'); pctx = pc.getContext('2d'); sizeCanvas(pc, pctx);
    const w = bg.clientWidth, h = bg.clientHeight;
    parts = Array.from({ length: FX.particles }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 1.8, v: 8 + Math.random() * 18, a: 0.25 + Math.random() * 0.4, ph: Math.random() * 6, f: 0.4 + Math.random() * 0.8 }));
    pLast = performance.now(); pRaf = requestAnimationFrame(pFrame);
  }

  /* =====================================================================================================
   * Escenas animadas (canvas 2D): cada una dibuja cosas reales detrás de la app
   * ===================================================================================================== */
  const sprite = (size, stops) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; };
  const lastPct = () => { const c = [...S().charges].filter((x) => x.endPct != null).sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0]; return c ? c.endPct : 80; };
  const drops = (w, h, n, slant) => Array.from({ length: n }, () => ({ x: Math.random() * (w + 120), y: Math.random() * h, l: 10 + Math.random() * 22, v: 650 + Math.random() * 500, a: 0.12 + Math.random() * 0.3, s: slant }));
  const rain = (g, dt, w, h, list, col) => { g.lineWidth = 1; g.lineCap = 'round'; for (const p of list) { p.y += p.v * dt; p.x -= p.v * dt * p.s; if (p.y > h + 30) { p.y = -30; p.x = Math.random() * (w + 120); } g.strokeStyle = `rgba(${col},${p.a})`; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + p.l * p.s, p.y - p.l); g.stroke(); } };
  const bolt = (x0, y0, x1, y1, depth) => { let pts = [[x0, y0], [x1, y1]], off = Math.hypot(x1 - x0, y1 - y0) / 4; for (let i = 0; i < depth; i++) { const nx = []; for (let j = 0; j < pts.length - 1; j++) { const a = pts[j], b = pts[j + 1]; nx.push(a, [(a[0] + b[0]) / 2 + (Math.random() - 0.5) * off, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * off * 0.4]); } nx.push(pts[pts.length - 1]); pts = nx; off /= 2; } return pts; };
  const SCENES = {
    lluvia: { init: (w, h, n) => ({ d: drops(w, h, Math.round(50 + 260 * n), 0.18) }), draw: (g, dt, t, w, h, c, n, s) => rain(g, dt, w, h, s.d, '190,215,255') },
    vidrio: {
      init: (w, h, n) => ({ d: Array.from({ length: Math.round(25 + 90 * n) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 1.5 + Math.random() * 5, vy: 0, wait: Math.random() * 8 })) }),
      draw(g, dt, t, w, h, c, n, s) {
        for (const p of s.d) {
          p.wait -= dt; if (p.wait < 0 && p.vy === 0 && p.r > 3) p.vy = 20 + Math.random() * 60;
          if (p.vy > 0) { p.y += p.vy * dt; p.vy = Math.max(8, p.vy * 0.996 + (Math.random() - 0.4) * 12 * dt); g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = p.r * 0.55; g.beginPath(); g.moveTo(p.x, p.y - p.vy * 0.5); g.lineTo(p.x, p.y); g.stroke(); if (p.y > h + 12) { p.y = -6; p.x = Math.random() * w; p.vy = 0; p.wait = 3 + Math.random() * 8; } }
          g.fillStyle = 'rgba(255,255,255,0.06)'; g.strokeStyle = 'rgba(255,255,255,0.26)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(p.x, p.y, p.r * 0.85, p.r, 0, 0, 7); g.fill(); g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.25, 0, 7); g.fill();
        }
      },
    },
    nieve: {
      init: (w, h, n) => ({ d: Array.from({ length: Math.round(40 + 220 * n) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 2.6, v: 18 + Math.random() * 40, ph: Math.random() * 6 })) }),
      draw(g, dt, t, w, h, c, n, s) { for (const p of s.d) { p.y += p.v * dt; p.ph += dt * (0.6 + p.r * 0.2); if (p.y > h + 6) { p.y = -6; p.x = Math.random() * w; } g.fillStyle = `rgba(255,255,255,${0.25 + p.r * 0.12})`; g.beginPath(); g.arc(p.x + Math.sin(p.ph) * 16, p.y, p.r, 0, 7); g.fill(); } },
    },
    estrellas: {
      init: (w, h, n) => ({ d: Array.from({ length: Math.round(70 + 260 * n) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.3, ph: Math.random() * 6, sp: 0.8 + Math.random() * 2.4 })), next: 2 + Math.random() * 3, sh: null }),
      draw(g, dt, t, w, h, c, n, s) {
        for (const p of s.d) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.7 * (0.5 + 0.5 * Math.sin(t * p.sp + p.ph))})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
        s.next -= dt; if (s.next < 0 && !s.sh) { s.sh = { x: Math.random() * w * 0.8, y: Math.random() * h * 0.4, vx: 420 + Math.random() * 200, vy: 170 + Math.random() * 110, life: 0 }; s.next = 5 + Math.random() * 7; }
        if (s.sh) { const q = s.sh; q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; const a = Math.max(0, 1 - q.life / 0.9), gr = g.createLinearGradient(q.x, q.y, q.x - q.vx * 0.22, q.y - q.vy * 0.22); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.strokeStyle = gr; g.lineWidth = 1.6; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * 0.22, q.y - q.vy * 0.22); g.stroke(); if (q.life > 0.9) s.sh = null; }
      },
    },
    vialactea: {
      init(w, h, n) {
        const W = Math.round(w * 1.6), H = Math.round(h * 1.6), o = document.createElement('canvas'); o.width = W; o.height = H; const g = o.getContext('2d'), cols = [[120, 90, 255], [60, 160, 255], [255, 110, 180], [80, 220, 200]];
        for (let i = 0; i < 6; i++) { const x = Math.random() * W, y = Math.random() * H, r = 160 + Math.random() * 260, col = cols[i % 4], gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, 0.2)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
        for (let i = 0; i < 400 + 900 * n; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.7})`; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 0.3 + Math.random() * 1.1, 0, 7); g.fill(); }
        return { o, W, H };
      },
      draw(g, dt, t, w, h, c, n, s) { g.save(); g.translate(w / 2, h / 2); g.rotate(t * 0.012); g.drawImage(s.o, -s.W / 2, -s.H / 2); g.restore(); },
    },
    luciernagas: {
      init: (w, h, n) => ({ sp: sprite(64, [[0, 'rgba(230,255,150,0.95)'], [0.25, 'rgba(190,255,120,0.35)'], [1, 'rgba(190,255,120,0)']]), d: Array.from({ length: Math.round(10 + 36 * n) }, () => ({ x: Math.random() * w, y: Math.random() * h, a: Math.random() * 6, v: 14 + Math.random() * 26, ph: Math.random() * 6, sz: 22 + Math.random() * 26 })) }),
      draw(g, dt, t, w, h, c, n, s) { g.globalCompositeOperation = 'lighter'; for (const b of s.d) { b.a += (Math.random() - 0.5) * dt * 4; b.x += Math.cos(b.a) * b.v * dt; b.y += Math.sin(b.a) * b.v * dt; if (b.x < -20) b.x = w + 20; if (b.x > w + 20) b.x = -20; if (b.y < -20) b.y = h + 20; if (b.y > h + 20) b.y = -20; g.globalAlpha = clamp(0.5 + 0.55 * Math.sin(t * 1.6 + b.ph), 0, 1); g.drawImage(s.sp, b.x - b.sz / 2, b.y - b.sz / 2, b.sz, b.sz); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; },
    },
    ciudad: {
      init(w, h) {
        const R = Math.random, mk = (hmin, hmax, wmin, wmax) => { const out = []; let x = -10; while (x < w + 40) { const bw = wmin + R() * (wmax - wmin), bh = h * (hmin + R() * (hmax - hmin)), cols = Math.max(1, Math.floor(bw / 8)), rows = Math.max(1, Math.floor(bh / 11)); out.push({ x, bw, bh, cols, rows, win: Array.from({ length: cols * rows }, () => R() < 0.42) }); x += bw + R() * 3; } return out; };
        return { back: mk(0.2, 0.42, 24, 48), front: mk(0.08, 0.28, 22, 62), stars: Array.from({ length: 50 }, () => [R() * w, R() * h * 0.5, R() * 1.2 + 0.3, R() * 6]) };
      },
      draw(g, dt, t, w, h, c, n, s) {
        for (const q of s.stars) { g.fillStyle = `rgba(255,255,255,${0.25 + 0.4 * Math.sin(t + q[3])})`; g.beginPath(); g.arc(q[0], q[1], q[2], 0, 7); g.fill(); }
        const tw = Math.ceil(dt * 8 * (0.4 + n)); [s.back, s.front].forEach((layer, li) => {
          for (let k = 0; k < tw; k++) { const b = layer[(Math.random() * layer.length) | 0]; if (b) { const i = (Math.random() * b.win.length) | 0; b.win[i] = !b.win[i]; } }
          const fill = rgba(c.map((v) => v * (li ? 0.05 : 0.1)), li ? 0.92 : 0.7);
          for (const b of layer) {
            g.fillStyle = fill; g.fillRect(b.x, h - b.bh, b.bw, b.bh); g.fillStyle = li ? 'rgba(255,214,130,0.75)' : 'rgba(255,225,160,0.4)';
            for (let r = 0; r < b.rows; r++) for (let q = 0; q < b.cols; q++) if (b.win[r * b.cols + q]) g.fillRect(b.x + 3 + q * 8, h - b.bh + 5 + r * 11, 4, 5);
          }
        });
      },
    },
    carretera: {
      init: () => ({}),
      draw(g, dt, t, w, h, c) {
        const vx = w / 2, vy = h * 0.56, H = h - vy, hg = g.createRadialGradient(vx, vy, 0, vx, vy, w * 0.7); hg.addColorStop(0, rgba(light(c, 0.2), 0.35)); hg.addColorStop(1, rgba(c, 0)); g.fillStyle = hg; g.fillRect(0, vy - w * 0.4, w, w * 0.8);
        g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(vx, vy); g.lineTo(-w * 0.35, h); g.moveTo(vx, vy); g.lineTo(w * 1.35, h); g.stroke();
        const K = 14;
        for (let k = 0; k < K; k++) { const z = ((k + t * 0.9) % K) / K, z2 = Math.min(1, z + 0.045), y1 = vy + H * z * z, y2 = vy + H * z2 * z2; g.strokeStyle = `rgba(255,255,255,${0.12 + 0.4 * z})`; g.lineWidth = 1 + z * z * 9; g.beginPath(); g.moveTo(vx, y1); g.lineTo(vx, y2); g.stroke(); }
        for (let k = 0; k < K; k++) { const z = ((k + 0.5 + t * 0.9) % K) / K, y = vy + H * z * z, off = 30 + z * z * w * 0.78, r = 0.8 + z * z * 5; for (const sd of [-1, 1]) { g.fillStyle = rgba(light(c, 0.5), 0.25 + 0.55 * z); g.beginPath(); g.arc(vx + sd * off, y - z * z * 30, r, 0, 7); g.fill(); } }
      },
    },
    olas: {
      init: () => ({}),
      draw(g, dt, t, w, h, c) {
        for (let i = 0; i < 4; i++) {
          const base = h * (0.66 + i * 0.07), amp = 8 + i * 4, k = 0.012 + i * 0.004, sp = 0.9 + i * 0.35; g.beginPath(); g.moveTo(0, h);
          for (let x = 0; x <= w + 6; x += 6) g.lineTo(x, base + Math.sin(x * k + t * sp + i * 2) * amp + Math.sin(x * k * 2.1 - t * sp * 1.3) * amp * 0.4);
          g.lineTo(w, h); g.closePath(); g.fillStyle = rgba(c, 0.1 + i * 0.05); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; g.stroke();
        }
      },
    },
    nubes: {
      init(w, h, n) { const sp = sprite(128, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]), cl = document.createElement('canvas'); cl.width = 280; cl.height = 120; const g = cl.getContext('2d'); for (let i = 0; i < 9; i++) g.drawImage(sp, 20 + Math.random() * 150, 8 + Math.random() * 30, 70 + Math.random() * 60, 70 + Math.random() * 50); return { cl, d: Array.from({ length: Math.round(4 + 6 * n) }, () => ({ x: Math.random() * w, y: Math.random() * h * 0.8, s: 0.6 + Math.random() * 1.1, v: 6 + Math.random() * 14, a: 0.1 + Math.random() * 0.16 })) }; },
      draw(g, dt, t, w, h, c, n, s) { for (const p of s.d) { p.x += p.v * dt; if (p.x > w + 20) p.x = -280 * p.s; g.globalAlpha = p.a; g.drawImage(s.cl, p.x, p.y, 280 * p.s, 120 * p.s); } g.globalAlpha = 1; },
    },
    brasas: {
      init: (w, h, n) => ({ sp: sprite(40, [[0, 'rgba(255,220,120,1)'], [0.3, 'rgba(255,120,40,0.5)'], [1, 'rgba(255,60,0,0)']]), d: Array.from({ length: Math.round(24 + 110 * n) }, () => ({ x: Math.random() * w, y: Math.random() * h, v: 25 + Math.random() * 70, w: Math.random() * 6, ph: Math.random() * 6, life: Math.random(), sz: 4 + Math.random() * 12 })) }),
      draw(g, dt, t, w, h, c, n, s) { g.globalCompositeOperation = 'lighter'; for (const e of s.d) { e.y -= e.v * dt; e.x += Math.sin(e.ph + t * 1.5) * e.w * dt * 8; e.life -= dt * 0.12; if (e.y < -10 || e.life <= 0) { e.y = h + 10; e.x = Math.random() * w; e.life = 0.6 + Math.random() * 0.4; } g.globalAlpha = clamp(e.life, 0, 1) * (0.55 + 0.45 * Math.sin(t * 9 + e.ph)); g.drawImage(s.sp, e.x - e.sz / 2, e.y - e.sz / 2, e.sz, e.sz); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; },
    },
    tormenta: {
      init: (w, h, n) => ({ d: drops(w, h, Math.round(80 + 240 * n), 0.4), next: 1.5 + Math.random() * 3, b: null, f: 0 }),
      draw(g, dt, t, w, h, c, n, s) {
        rain(g, dt, w, h, s.d, '190,205,240'); s.next -= dt;
        if (s.next < 0) { const x = Math.random() * w; s.b = bolt(x, 0, x + (Math.random() - 0.5) * 220, h * 0.55, 6); s.f = 1; s.next = 4 + Math.random() * 8; }
        if (s.f > 0) { g.fillStyle = `rgba(210,220,255,${s.f * 0.2})`; g.fillRect(0, 0, w, h); if (s.b && s.f > 0.3) { g.save(); g.strokeStyle = `rgba(235,240,255,${s.f})`; g.lineWidth = 2.2; g.shadowBlur = 18; g.shadowColor = '#9fb4ff'; g.beginPath(); s.b.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.restore(); } s.f -= dt * 2.2; }
      },
    },
    red: {
      init(w, h, n) {
        const N = Math.round(12 + 18 * n), nodes = Array.from({ length: N }, () => ({ x: Math.random() * w, y: Math.random() * h })), edges = [], seen = new Set();
        nodes.forEach((a, i) => nodes.map((b, j) => [Math.hypot(a.x - b.x, a.y - b.y), j]).filter((q) => q[1] !== i).sort((p, q) => p[0] - q[0]).slice(0, 2).forEach(([, j]) => { const k = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(k)) { seen.add(k); edges.push([i, j]); } }));
        return { nodes, edges, pulses: [], tm: 0, sp: sprite(36, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]) };
      },
      draw(g, dt, t, w, h, c, n, s) {
        g.strokeStyle = rgba(c, 0.2); g.lineWidth = 1; g.beginPath(); s.edges.forEach(([a, b]) => { g.moveTo(s.nodes[a].x, s.nodes[a].y); g.lineTo(s.nodes[b].x, s.nodes[b].y); }); g.stroke();
        g.fillStyle = rgba(light(c, 0.3), 0.55); s.nodes.forEach((p) => { g.beginPath(); g.arc(p.x, p.y, 2.2, 0, 7); g.fill(); });
        s.tm -= dt; if (s.tm < 0 && s.edges.length) { s.pulses.push({ e: s.edges[(Math.random() * s.edges.length) | 0], t: 0, d: Math.random() < 0.5, sp: 0.5 + Math.random() * 0.8 }); s.tm = 0.5 - n * 0.4; }
        g.globalCompositeOperation = 'lighter'; s.pulses = s.pulses.filter((p) => p.t < 1);
        for (const p of s.pulses) { p.t += dt * p.sp; const a = s.nodes[p.d ? p.e[0] : p.e[1]], b = s.nodes[p.d ? p.e[1] : p.e[0]], x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t; g.globalAlpha = 0.9; g.drawImage(s.sp, x - 14, y - 14, 28, 28); }
        g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      },
    },
    burbujas: {
      init: (w, h, n) => ({ d: Array.from({ length: Math.round(10 + 40 * n) }, () => { const r = 4 + Math.random() * 18; return { x: Math.random() * w, y: Math.random() * h, r, v: 14 + (40 * 10) / (r + 6) + Math.random() * 14, ph: Math.random() * 6 }; }) }),
      draw(g, dt, t, w, h, c, n, s) { for (const b of s.d) { b.y -= b.v * dt; if (b.y < -b.r * 2) { b.y = h + b.r * 2; b.x = Math.random() * w; } const x = b.x + Math.sin(t * 1.2 + b.ph) * 10; g.fillStyle = 'rgba(255,255,255,0.035)'; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.beginPath(); g.arc(x, b.y, b.r, 0, 7); g.fill(); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x, b.y, b.r * 0.7, Math.PI * 1.1, Math.PI * 1.45); g.stroke(); } },
    },
    nivel: {
      init: (w, h) => ({ cur: 0, target: clamp(lastPct(), 5, 100) / 100, b: Array.from({ length: 22 }, () => ({ x: Math.random() * w, y: h, r: 1.5 + Math.random() * 3.5, v: 18 + Math.random() * 40, ph: Math.random() * 6 })) }),
      draw(g, dt, t, w, h, c, n, s) {
        s.cur += (s.target - s.cur) * dt * 0.6; const top = h * (1 - s.cur * 0.92);
        for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w + 6; x += 6) g.lineTo(x, top + Math.sin(x * 0.02 + t * (1.1 + i * 0.5) + i * 2) * (6 + i * 3)); g.lineTo(w, h); g.closePath(); g.fillStyle = rgba(c, i ? 0.12 : 0.2); g.fill(); }
        g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1;
        for (const b of s.b) { b.y -= b.v * dt; if (b.y < top + 6) { b.y = h + 4; b.x = Math.random() * w; } g.beginPath(); g.arc(b.x + Math.sin(t + b.ph) * 4, b.y, b.r, 0, 7); g.stroke(); }
      },
    },
    boreal: {
      init: () => ({}),
      draw(g, dt, t, w, h) {
        g.globalCompositeOperation = 'lighter'; const cols = [[80, 255, 170], [90, 190, 255], [170, 110, 255]];
        cols.forEach((col, i) => {
          const base = h * (0.2 + 0.1 * i), amp = 30 + 20 * i, pts = []; for (let x = 0; x <= w + 8; x += 8) pts.push([x, base + Math.sin(x * 0.008 + t * 0.4 + i * 2) * amp + Math.sin(x * 0.021 - t * 0.3) * amp * 0.35]);
          const gr = g.createLinearGradient(0, base - amp, 0, base + h * 0.34); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.18, rgba(col, 0.3)); gr.addColorStop(1, rgba(col, 0));
          g.fillStyle = gr; g.beginPath(); pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let k = pts.length - 1; k >= 0; k--) g.lineTo(pts[k][0], pts[k][1] + h * 0.34 + Math.sin(k * 0.4 + t + i) * 14); g.closePath(); g.fill();
        });
        g.globalCompositeOperation = 'source-over';
      },
    },
  };
  const SCENEN = [['ninguna', 'Ninguna'], ['lluvia', 'Lluvia'], ['vidrio', 'Lluvia en el vidrio'], ['tormenta', 'Tormenta'], ['nieve', 'Nieve'], ['estrellas', 'Estrellas y fugaces'], ['vialactea', 'Vía Láctea'], ['boreal', 'Aurora boreal'], ['luciernagas', 'Luciérnagas'], ['ciudad', 'Ciudad de noche'],
    ['carretera', 'Ruta de noche'], ['olas', 'Mar'], ['nubes', 'Nubes'], ['brasas', 'Brasas'], ['red', 'Red eléctrica'], ['burbujas', 'Burbujas'], ['nivel', 'Nivel de batería']];
  let sc = null, sg = null, sT = 0, sLast = 0, sRaf = 0, sState = null, sCol = [79, 181, 138], sColT = 0;
  function sFrame(t) {
    sRaf = requestAnimationFrame(sFrame);
    const q = Q(); if (t - sLast < 1000 / q.fps - 2) return;
    const dt = Math.min(0.06, (t - sLast) / 1000) * (FX.sceneSpd / 100); sLast = t; sT += dt;
    if (!sc || document.hidden || (app.classList.contains('fn-open') && !FX.allbg)) return;
    if (t - sColT > 300) { sCol = hex2rgb(getComputedStyle(root).getPropertyValue('--bgk')); sColT = t; }
    const w = bg.clientWidth, h = bg.clientHeight; sg.clearRect(0, 0, w, h);
    SCENES[FX.scene].draw(sg, dt, sT, w, h, sCol, FX.sceneInt / 100, sState);
  }
  function scene() {
    cancelAnimationFrame(sRaf); drop('lab-scene'); sc = null;
    if (!SCENES[FX.scene] || reduce.matches) return;
    sc = layer('lab-scene', '', 'canvas'); sg = sc.getContext('2d'); sizeCanvas(sc, sg);
    sState = SCENES[FX.scene].init(bg.clientWidth, bg.clientHeight, FX.sceneInt / 100); sLast = performance.now(); sRaf = requestAnimationFrame(sFrame);
  }
  addEventListener('resize', () => { if (pc) particles(); if (sc) scene(); texLayers(); });

  /* ---------- Fondo en todas las pantallas: las demás pantallas dejan ver el fondo animado ---------- */
  const order = [];
  function syncTop() {
    const open = $$('.fn.open'); for (const f of order.slice()) if (!open.includes(f)) order.splice(order.indexOf(f), 1); for (const f of open) if (!order.includes(f)) order.push(f);
    $$('.fn').forEach((f) => f.classList.toggle('lab-under', !!FX.allbg && order.length > 1 && f !== order[order.length - 1] && f.classList.contains('open')));
  }
  const fnObs = new MutationObserver(syncTop); $$('.fn').forEach((f) => fnObs.observe(f, { attributes: true, attributeFilter: ['class'] }));

  /* ---------- Capas de textura del fondo y de la bandeja ---------- */
  function texLayers() {
    if (GEN[FX.bgTex]) { const w = bg.clientWidth + 80, h = bg.clientHeight + 80, el = layer('lab-bgtex'); el.style.backgroundImage = texUrl(FX.bgTex, w, h, FX.bgTexOpa / 100); el.style.setProperty('--lab-drift', `${FX.bgTexMove || 0}s`); el.classList.toggle('moving', FX.bgTexMove > 0); onRail(); } else drop('lab-bgtex');
    const mats = { cepillado: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 2px), repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0 1px, transparent 1px 3px)', arena: NOISE };
    if (FX.mat !== 'ninguno') { root.style.setProperty('--fx-mat', mats[FX.mat] || texUrl(FX.mat, Math.max(320, innerWidth), 300, FX.matOpa / 100)); root.style.setProperty('--fx-matsize', FX.mat === 'arena' ? '160px' : mats[FX.mat] ? 'auto' : 'cover'); }
    root.classList.toggle('fx-mat', FX.mat !== 'ninguno');
  }

  /* ---------- Luz del cielo según la hora ---------- */
  const SKY = [[0, '#070b24', '#101a40'], [4.5, '#0a1030', '#1c2152'], [6, '#2a2a6a', '#e0794e'], [7.5, '#6a8fd0', '#ffd08a'], [10, '#5aa0e8', '#bfe0ff'], [15, '#5aa0e8', '#cfe6ff'], [18, '#4a6fc0', '#ffb070'], [19.5, '#3a2f78', '#e0605a'], [21, '#101745', '#2a2a6a'], [24, '#070b24', '#101a40']];
  function skyUpdate() {
    const el = $('.lab-sky', bg); if (!el) return;
    const now = new Date(), hr = FX.skyAuto ? now.getHours() + now.getMinutes() / 60 : FX.skyHour;
    let i = SKY.findIndex((k) => k[0] > hr) - 1; if (hr >= 24) i = SKY.length - 2; i = clamp(i, 0, SKY.length - 2); const a = SKY[i], b = SKY[i + 1], t = clamp((hr - a[0]) / (b[0] - a[0]), 0, 1);
    el.firstElementChild.style.background = `linear-gradient(to bottom, ${rgb2hex(mix(hex2rgb(a[1]), hex2rgb(b[1]), t))}, ${rgb2hex(mix(hex2rgb(a[2]), hex2rgb(b[2]), t))})`;
    const day = hr >= 6 && hr < 19, prog = day ? (hr - 6) / 13 : ((hr + 24 - 19) % 24) / 11, orb = el.lastElementChild;
    orb.style.left = `${10 + 80 * prog}%`; orb.style.top = `${78 - 62 * Math.sin(Math.PI * prog)}%`;
    orb.style.background = day ? `radial-gradient(circle, rgba(255,${230 - Math.round(80 * (1 - Math.sin(Math.PI * prog)))},150,0.95) 0 6%, rgba(255,190,120,0.35) 18%, transparent 55%)` : 'radial-gradient(circle, rgba(235,240,255,0.95) 0 5%, rgba(180,200,255,0.3) 16%, transparent 50%)';
  }
  /* ---------- Luz ambiente automática: un velo de color según la hora ---------- */
  const AMB = [[0, '#0a1440', 0.42], [5, '#3a2a6a', 0.34], [7, '#ffb27a', 0.2], [10, '#ffffff', 0], [15, '#ffffff', 0], [17.5, '#ffa050', 0.22], [19, '#ff5a7a', 0.26], [21, '#0a1440', 0.4], [24, '#0a1440', 0.42]];
  const hourNow = () => { const n = new Date(); return FX.skyAuto ? n.getHours() + n.getMinutes() / 60 : FX.skyHour; };
  function ambUpdate() {
    const el = $('.lab-amb'); if (!el) return;
    const hr = hourNow(), i = clamp(AMB.findIndex((k) => k[0] > hr) - 1, 0, AMB.length - 2), a = AMB[i], b = AMB[i + 1], t = clamp((hr - a[0]) / (b[0] - a[0]), 0, 1);
    el.style.background = rgb2hex(mix(hex2rgb(a[1]), hex2rgb(b[1]), t)); el.style.opacity = String((a[2] + (b[2] - a[2]) * t) * FX.ambient / 100 * 1.4);
  }
  /* ---------- Luz de estado: el color de tu batería, y late mientras cargás ---------- */
  function stateUpdate() {
    const el = $('.lab-state', bg); if (!el) return;
    const p = lastPct(), c = p < 20 ? [255, 90, 80] : p < 50 ? [255, 190, 70] : [90, 230, 150];
    el.style.setProperty('--lab-sc', rgb2hex(c)); el.classList.toggle('live', !!S().active);
  }
  setInterval(() => { skyUpdate(); ambUpdate(); stateUpdate(); }, 20000);

  /* ---------- Velos de color sobre toda la app (arriba de todo, debajo del botón Lab) ---------- */
  const over = (name) => { let e = $('.' + name); if (!e) { e = el('div', `lab-over ${name}`); document.body.appendChild(e); } return e; };
  const dropOver = (name) => { const e = $('.' + name); if (e) e.remove(); };
  const LOOKS = { calido: ['sepia(0.15) saturate(1.1)', 25], frio: ['contrast(1.1) saturate(0.9)', -30], sepia: ['sepia(0.85)', 0], bn: ['grayscale(1) contrast(1.1)', 0], vivido: ['saturate(1.5) contrast(1.08)', 0], desvanecido: ['contrast(0.88) brightness(1.06) saturate(0.8)', 0], noir: ['grayscale(1) contrast(1.35) brightness(0.9)', 0] };
  function grade() {
    const lk = LOOKS[FX.look], f = [];
    if (FX.bright !== 100) f.push(`brightness(${FX.bright / 100})`); if (FX.contrast !== 100) f.push(`contrast(${FX.contrast / 100})`); if (FX.satG !== 100) f.push(`saturate(${FX.satG / 100})`); if (FX.hueG) f.push(`hue-rotate(${FX.hueG}deg)`); if (lk) f.push(lk[0]);
    app.style.filter = f.join(' ');
    const temp = FX.temp + (lk ? lk[1] : 0);
    if (temp) { const t = over('lab-temp'); t.style.background = temp > 0 ? 'rgb(255,150,50)' : 'rgb(60,140,255)'; t.style.opacity = String(Math.min(1, Math.abs(temp) / 100) * 0.22); } else dropOver('lab-temp');
    if (FX.toneColor) { const t = over('lab-tone'); t.style.background = FX.toneColor; t.style.opacity = String(FX.toneOpa / 100); t.style.mixBlendMode = FX.toneMode; } else dropOver('lab-tone');
    FX.ambient > 0 ? over('lab-amb') : dropOver('lab-amb'); ambUpdate();
    if (FX.duo) { const a = hex2rgb(FX.duoA || '#0b1020'), b = hex2rgb(FX.duoB || '#7cf0c8'); ['R', 'G', 'B'].forEach((ch, i) => $('#duo' + ch).setAttribute('tableValues', `${(a[i] / 255).toFixed(3)} ${(b[i] / 255).toFixed(3)}`)); bg.style.filter = 'url(#labDuo)'; } else bg.style.filter = '';
  }
  /* ---------- Luz al tocar: un pulso del color de la ficha donde apoyás el dedo ---------- */
  document.addEventListener('pointerdown', (e) => {
    if (!FX.touchLight || e.target.closest('.lab-sheet, .lab-btn')) return;
    const host = layer('lab-pulses'), r = bg.getBoundingClientRect(), d = el('i');
    d.style.left = `${e.clientX - r.left}px`; d.style.top = `${e.clientY - r.top}px`; host.appendChild(d);
    if (d.animate) d.animate([{ transform: 'translate(-50%, -50%) scale(0.15)', opacity: 0.95 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }], { duration: 950, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).onfinish = () => d.remove(); else d.remove();
  }, true);

  /* ---------- Luces con la inclinación del teléfono ---------- */
  let tiltOn = false;
  function onOrient(e) {
    const x = clamp(50 + (e.gamma || 0) * 1.6, 5, 95), y = clamp(35 + ((e.beta || 45) - 45) * 1.1, 5, 95), tray = $('.tray');
    if (tray) { tray.style.setProperty('--mx', `${x}%`); tray.style.setProperty('--my', `${y}%`); }
    lightAz = ((e.gamma || 0) * 2); setBevel();
  }
  function setTiltLight(on, gesture) {
    if (on && !tiltOn) {
      const go = () => { addEventListener('deviceorientation', onOrient); tiltOn = true; };
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { if (gesture) DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') go(); else { FX.tiltLight = false; apply(); build(); } }).catch(() => {}); else go(); } else go();
    } else if (!on && tiltOn) { removeEventListener('deviceorientation', onOrient); tiltOn = false; lightAz = 0; setBevel(); }
  }

  /* ---------- Luz que sigue al dedo ---------- */
  const tray = $('.tray');
  const spot = (e) => { if (!(FX.spot || FX.rim) || !tray) return; const r = tray.getBoundingClientRect(); tray.style.setProperty('--mx', `${e.clientX - r.left}px`); tray.style.setProperty('--my', `${e.clientY - r.top}px`); };
  if (tray) { tray.addEventListener('pointermove', spot); tray.addEventListener('pointerdown', spot); }

  /* ---------- Háptica (interruptor invisible de Safari) y sonido ---------- */
  const hl = Object.assign(document.createElement('label'), { style: 'position:fixed;left:-80px;top:0;opacity:0;pointer-events:none' }), hi = document.createElement('input');
  hi.type = 'checkbox'; hi.setAttribute('switch', ''); hl.appendChild(hi); document.body.appendChild(hl);
  let ac = null;
  const buzz = () => { if (FX.haptic) { try { hl.click(); } catch (_) {} } };
  const blip = () => {
    if (!FX.sound) return;
    try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = 'sine'; o.frequency.value = 900; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.06); } catch (_) {}
  };
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('button, .slot') && !e.target.closest('.lab-sheet')) { buzz(); blip(); } }, true);
  let lastI = -1;
  rail.addEventListener('touchmove', () => { const i = Math.round(rail.scrollLeft / 100); if (i !== lastI) { lastI = i; buzz(); blip(); } }, { passive: true });

  /* ---------- Título: cambio con desenfoque ---------- */
  if (head) new MutationObserver(() => { if (FX.titleBlur && head.animate) head.animate([{ filter: 'blur(10px)', opacity: 0, transform: 'translateY(10px)' }, { filter: 'blur(0)', opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); }).observe(head, { childList: true });

  /* ---------- Entrada del inicio ---------- */
  function intro() { $$('.slot .c', rail).forEach((c, i) => c.animate && c.animate([{ translate: '0 -90px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 760, delay: i * 70, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'backwards' })); const t = $('.tray'); if (t && t.animate) t.animate([{ translate: '0 80px', opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 620, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' }); }

  /* ---------- Entrada escalonada de las listas ---------- */
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: Array.from({ length: 12 }, (_, i) => `html.fx-stagger .fn.open :is(.scroll, .hh, .center) > :nth-child(${i + 1}) { animation: labrise 520ms var(--ease-out) ${(i + 1) * 40}ms backwards; }`).join('\n') }));

  /* =====================================================================================================
   * Aplicar todo
   * ===================================================================================================== */
  function apply() {
    const cl = root.classList, st = root.style, on = (c, v) => cl.toggle(c, !!v), V = (k, v) => st.setProperty(k, v);
    // fichas
    on('fx-tilt', FX.tilt > 0); V('--fx-tilt', FX.tilt); on('fx-shine', FX.shine); on('fx-spin', FX.spin > 0); V('--fx-spin', FX.spin || 60); on('fx-filled', FX.filled);
    on('fx-float', FX.float); on('fx-shadow', FX.shadow); on('fx-glow', FX.glow > 0); V('--fx-glow', FX.glow); on('fx-csize', FX.chipSize !== 100); V('--fx-csz', FX.chipSize);
    ['oro', 'plata', 'cobre', 'iridiscente'].forEach((m) => on('fx-metal-' + m, FX.metal === m)); on('fx-metal', FX.metal !== 'ninguno');
    on('fx-bevel', FX.bevel > 0); setBevel(); V('--fx-texopa', FX.texOpa); on('fx-texspin', FX.texSpin > 0); V('--fx-texspin', FX.texSpin || 60);
    on('fx-hue', FX.hue !== 0 || FX.sat !== 100 || FX.spread > 0); V('--fx-hue', FX.hue); V('--fx-sat', FX.sat); V('--fx-spread', FX.spread);
    on('fx-cc', FX.chipColor); if (FX.chipColor) V('--fx-cc', FX.chipColor); on('fx-ce', FX.edgeColor); if (FX.edgeColor) V('--fx-ce', FX.edgeColor);
    applyTex(); slotColors();
    // colores del fondo
    on('fx-tint', FX.tint !== 14); V('--fx-tint', FX.tint); on('fx-bgk', FX.bgkFree); if (FX.bgkFree) V('--fx-bgk', FX.bgkFree); on('fx-accent', FX.accent); if (FX.accent) V('--fx-accent', FX.accent);
    if (FX.gradA && FX.gradB) layer('lab-grad').style.background = `linear-gradient(${FX.gradAng}deg, ${FX.gradA}, ${FX.gradB})`; else drop('lab-grad');
    FX.breathe ? layer('lab-breathe') : drop('lab-breathe');
    texLayers();
    // capas animadas
    FX.aurora ? layer('lab-aurora', '<i></i><i></i><i></i>') : drop('lab-aurora');
    if (FX.grain > 0) { const g = layer('lab-grain'); g.style.backgroundImage = NOISE; g.style.opacity = FX.grain / 100; } else drop('lab-grain');
    if (FX.vignette > 0) layer('lab-vig').style.background = `radial-gradient(ellipse at 50% 42%, transparent 50%, rgba(0, 0, 0, ${FX.vignette / 100}) 100%)`; else drop('lab-vig');
    const psig = `${FX.particles}|${FX.quality}`, ssig = `${FX.scene}|${FX.quality}|${FX.sceneInt}`;
    if (psig !== apply.psig) { apply.psig = psig; particles(); }
    if (ssig !== apply.ssig) { apply.ssig = ssig; scene(); }
    on('fx-allbg', FX.allbg); V('--fx-dim', FX.dim / 100); FX.allbg ? layer('lab-dim') : drop('lab-dim'); syncTop();
    on('fx-wave', FX.wave > 0); V('--fx-wave', FX.wave || 9); on('fx-wave1', FX.waveN === 1); on('fx-wave2', FX.waveN === 2); V('--fx-wopa', FX.waveOpa / 100);
    // luz
    V('--fx-sky', FX.sky / 100); FX.sky > 0 ? layer('lab-sky', '<i></i><i></i>') : drop('lab-sky'); skyUpdate();
    V('--fx-cl', FX.chipLight / 100); FX.chipLight > 0 ? layer('lab-clight', '<i></i>') : drop('lab-clight');
    V('--fx-rays', FX.rays / 100); FX.rays > 0 ? layer('lab-rays') : drop('lab-rays');
    V('--fx-bokeh', FX.bokeh / 100); if (FX.bokeh > 0) { const b = layer('lab-bokeh'); if (!b.children.length) { const R = rng(7); for (let i = 0; i < 10; i++) { const e = document.createElement('i'), s = 40 + R() * 130; e.style.cssText = `left:${R() * 100}%;top:${R() * 100}%;width:${s}px;height:${s}px;--d:${14 + R() * 20}s;--o:${(0.08 + R() * 0.14).toFixed(2)};animation-delay:${-R() * 20}s;filter:blur(${2 + R() * 6}px)`; b.appendChild(e); } } } else drop('lab-bokeh');
    V('--fx-flare', FX.flare / 100); FX.flare > 0 ? layer('lab-flare', '<i class="s"></i><i class="a"></i><i class="b"></i><i class="c"></i>') : drop('lab-flare');
    V('--fx-leak', FX.leak / 100); FX.leak > 0 ? layer('lab-leak') : drop('lab-leak');
    V('--fx-fog', FX.fog / 100); FX.fog > 0 ? layer('lab-fog', '<i></i><i></i><i></i>') : drop('lab-fog');
    // luz principal: una dirección y un color gobiernan el reflejo de las fichas, sus sombras, el relieve y un degradé en el fondo
    { const kr = FX.keyAng * Math.PI / 180, kc = FX.keyColor || '#fff1d6', fm = (n) => `${n.toFixed(1)}`;
      V('--kc', kc); on('fx-key', FX.key > 0); V('--fx-key', FX.key / 100); V('--lx', `${fm(50 + Math.cos(kr) * 38)}%`); V('--ly', `${fm(50 + Math.sin(kr) * 38)}%`); V('--ksx', `${fm(-Math.cos(kr) * 10)}px`); V('--ksy', `${fm(-Math.sin(kr) * 10)}px`); V('--kang', `${FX.keyAng - 90}deg`);
      const g = $('#labKG'); if (g) { g.setAttribute('cx', fm(0.5 + Math.cos(kr) * 0.38)); g.setAttribute('cy', fm(0.5 + Math.sin(kr) * 0.38)); $('#labKG0').setAttribute('stop-color', kc); $('#labKG1').setAttribute('stop-color', kc); }
      FX.key > 0 ? layer('lab-key') : drop('lab-key'); applyTex(); setBevel(); }
    V('--fx-cone', FX.cone / 100); FX.cone > 0 ? layer('lab-cone', '<i></i>') : drop('lab-cone');
    V('--fx-orbit', FX.orbit / 100); FX.orbit > 0 ? layer('lab-orbit', '<i></i><i></i>') : drop('lab-orbit');
    V('--fx-state', FX.stateLight / 100); FX.stateLight > 0 ? layer('lab-state', '<i></i>') : drop('lab-state'); stateUpdate();
    if (!FX.touchLight) drop('lab-pulses');
    on('fx-neon', FX.neon > 0); V('--fx-neon', FX.neon / 100); on('fx-neoncycle', FX.neon > 0 && FX.neonCycle); on('fx-chiprim', FX.chipRim);
    grade();
    on('fx-rim', FX.rim); on('fx-spot', FX.spot || FX.tiltLight); on('fx-tiltlight', FX.tiltLight); setTiltLight(FX.tiltLight, true);
    on('fx-tglow', FX.titleGlow > 0); V('--fx-tg', FX.titleGlow); on('fx-shimmer', FX.shimmer);
    // bandeja
    on('fx-glass', FX.glass > 0); V('--fx-ga', FX.glass); on('fx-blur', FX.blur > 0); V('--fx-blur', FX.blur); on('fx-rad', FX.rad !== 44); V('--fx-rad', FX.rad);
    // movimiento
    ['push', 'sheet', 'zoom', 'fade'].forEach((t) => on('fx-tr-' + t, FX.trans === t)); on('fx-stagger', FX.stagger);
    // texto
    ['rounded', 'serif', 'mono'].forEach((f) => on('fx-font-' + f, FX.font === f)); on('fx-hw', FX.hw !== 300); V('--fx-hw', FX.hw); on('fx-ls', FX.ls !== -35); V('--fx-ls', FX.ls);
    onRail(); save(); showJson();
  }

  /* =====================================================================================================
   * Hoja del laboratorio
   * ===================================================================================================== */
  const el = (tag, cls, html = '') => Object.assign(document.createElement(tag), { className: cls || '', innerHTML: html });
  const UI = [
    ['Fichas', [
      ['rg', 'tilt', 'Carrusel 3D', 'Las fichas se inclinan al pasar', 0, 60, 2, '°'],
      ['sw', 'shine', 'Destello', 'Un reflejo cruza la ficha activa'],
      ['rg', 'spin', 'Aro que gira', 'Segundos por vuelta (0 = quieto)', 0, 120, 5, ' s'],
      ['sw', 'pop', 'Rebote al elegir', 'La ficha del centro salta al tocarla'],
      ['sw', 'float', 'Flotar', 'La ficha activa sube y baja suave'],
      ['sw', 'shadow', 'Sombra', 'Sombra bajo la ficha activa'],
      ['rg', 'glow', 'Resplandor de color', 'Un halo del color de la ficha', 0, 40, 2, ' px'],
      ['sw', 'filled', 'Íconos rellenos'],
      ['rg', 'chipSize', 'Tamaño de las fichas', '', 80, 125, 5, '%'],
      ['sg', 'metal', 'Metal', 'Reflejo que gira al pasar', [['ninguno', 'Ninguno'], ['oro', 'Oro'], ['plata', 'Plata'], ['cobre', 'Cobre'], ['iridiscente', 'Iridiscente']]],
      ['rg', 'bevel', 'Relieve', 'Bordes en alto con luz', 0, 10, 1, ''],
      ['rg', 'bevelAng', 'Dirección de la luz del relieve', '', 0, 360, 15, '°'],
      ['sg', 'tex', 'Textura', 'Sobre la textura de cada ficha', TEXN],
      ['rg', 'texOpa', 'Intensidad de la textura', '', 10, 100, 5, '%'],
      ['rg', 'texSpin', 'Textura que gira', 'Segundos por vuelta (0 = quieta)', 0, 120, 5, ' s'],
      ['rg', 'hue', 'Matiz', 'Gira todos los colores', -180, 180, 5, '°'],
      ['rg', 'sat', 'Saturación', '', 0, 200, 5, '%'],
      ['co', 'chipColor', 'Color libre de las fichas'],
      ['co', 'edgeColor', 'Color libre del borde'],
    ]],
    ['Fondo', [
      ['rg', 'tint', 'Intensidad del tinte', 'Como en la app: 14', 0, 40, 1, '%'],
      ['co', 'bgkFree', 'Color libre del fondo', 'Reemplaza el color de la ficha'],
      ['co', 'gradA', 'Degradé: color de arriba'],
      ['co', 'gradB', 'Degradé: color de abajo'],
      ['rg', 'gradAng', 'Ángulo del degradé', '', 0, 360, 15, '°'],
      ['sw', 'breathe', 'Respirar', 'El color del fondo late despacio'],
      ['sg', 'bgTex', 'Textura del fondo', '', TEXN],
      ['rg', 'bgTexOpa', 'Intensidad de la textura', '', 2, 40, 1, '%'],
      ['rg', 'bgTexMove', 'Deriva de la textura', 'Segundos (0 = quieta)', 0, 120, 5, ' s'],
      ['rg', 'particles', 'Partículas', 'Puntitos que suben despacio', 0, 80, 5, ''],
      ['sw', 'aurora', 'Manchas de color', 'Se mueven despacio'],
      ['rg', 'grain', 'Grano de película', '', 0, 40, 2, '%'],
      ['rg', 'vignette', 'Viñeta', 'Oscurece los bordes', 0, 80, 5, '%'],
      ['rg', 'wave', 'Ondas: segundos por ciclo', '0 = como en la app (9 s)', 0, 20, 1, ' s'],
      ['sg', 'waveN', 'Cantidad de ondas', '', [[1, '1'], [2, '2'], [3, '3']]],
      ['rg', 'waveOpa', 'Intensidad de las ondas', '', 0, 200, 10, '%'],
    ]],
    ['Color', [
      ['sg', 'look', 'Look', 'Un acabado para toda la app', [['ninguno', 'Ninguno'], ['calido', 'Cálido'], ['frio', 'Frío cine'], ['sepia', 'Sepia'], ['bn', 'Blanco y negro'], ['vivido', 'Vívido'], ['desvanecido', 'Desvanecido'], ['noir', 'Noir']]],
      ['rg', 'temp', 'Temperatura', 'Frío ← → cálido', -100, 100, 5, ''],
      ['rg', 'bright', 'Brillo', '', 50, 150, 5, '%'],
      ['rg', 'contrast', 'Contraste', '', 50, 150, 5, '%'],
      ['rg', 'satG', 'Saturación general', '', 0, 200, 5, '%'],
      ['rg', 'hueG', 'Matiz general', 'Gira todos los colores de la app', -180, 180, 5, '°'],
      ['co', 'toneColor', 'Capa de color', 'Un velo sobre toda la app'],
      ['rg', 'toneOpa', 'Intensidad de la capa', '', 0, 60, 2, '%'],
      ['sg', 'toneMode', 'Mezcla de la capa', '', [['soft-light', 'Suave'], ['overlay', 'Superponer'], ['color', 'Color'], ['multiply', 'Multiplicar'], ['screen', 'Pantalla'], ['normal', 'Normal']]],
      ['sw', 'duo', 'Duotono en el fondo', 'Todo el fondo en dos colores'],
      ['co', 'duoA', 'Duotono: sombras'],
      ['co', 'duoB', 'Duotono: luces'],
      ['rg', 'spread', 'Arcoíris de fichas', 'Cada ficha gira un poco más su matiz', 0, 60, 5, '°'],
      ['co', 'accent', 'Color de acento', 'Enlaces, selecciones y puntos'],
    ]],
    ['Escenas', [
      ['sg', 'scene', 'Escena animada', 'Cosas reales moviéndose detrás de la app', SCENEN],
      ['rg', 'sceneInt', 'Cantidad', '', 0, 100, 5, '%'],
      ['rg', 'sceneSpd', 'Velocidad', '', 30, 250, 10, '%'],
      ['sw', 'allbg', 'En todas las pantallas', 'Las demás pantallas dejan ver el fondo'],
      ['rg', 'dim', 'Oscurecer detrás del texto', 'Solo en las demás pantallas', 0, 80, 5, '%'],
      ['sg', 'quality', 'Calidad', 'Más baja gasta menos batería', [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']]],
    ]],
    ['Iluminación', [
      ['rg', 'key', 'Luz principal', 'Una luz que ordena todo: reflejo en las fichas, sombras, relieve y fondo', 0, 100, 5, '%'],
      ['rg', 'keyAng', 'Dirección de la luz', 'Desde dónde viene (225° = arriba a la izquierda)', 0, 360, 15, '°'],
      ['co', 'keyColor', 'Color de la luz principal', 'Cálida por defecto'],
      ['rg', 'cone', 'Foco cenital', 'Un cono de luz que cae desde arriba', 0, 100, 5, '%'],
      ['rg', 'ambient', 'Luz ambiente automática', 'Tiñe toda la app según la hora', 0, 100, 5, '%'],
      ['rg', 'sky', 'Luz del cielo', 'Cambia con la hora: amanecer, día, atardecer, noche', 0, 100, 5, '%'],
      ['sw', 'skyAuto', 'Usar la hora real', 'Vale para el cielo y la luz ambiente'],
      ['rg', 'skyHour', 'Probar otra hora', 'Si no usás la hora real', 0, 24, 0.5, ' h'],
      ['rg', 'stateLight', 'Luz de estado', 'Verde, ámbar o roja según tu batería; late si estás cargando', 0, 100, 5, '%'],
      ['rg', 'orbit', 'Luz orbital', 'Manchas del color de la ficha que giran', 0, 100, 5, '%'],
      ['sw', 'touchLight', 'Luz al tocar', 'Un pulso de luz donde apoyás el dedo'],
      ['rg', 'neon', 'Neón en la bandeja', 'Borde que brilla con el color de la ficha', 0, 100, 5, '%'],
      ['sw', 'neonCycle', 'Neón que cambia de color'],
      ['sw', 'chipRim', 'Borde luminoso en las fichas'],
      ['rg', 'chipLight', 'Luz de la ficha activa', 'Ilumina el fondo con su color', 0, 100, 5, '%'],
      ['rg', 'rays', 'Rayos de luz', 'Entran por una esquina', 0, 100, 5, '%'],
      ['rg', 'bokeh', 'Bokeh', 'Luces desenfocadas flotando', 0, 100, 5, '%'],
      ['rg', 'flare', 'Destello de lente', '', 0, 100, 5, '%'],
      ['rg', 'leak', 'Fuga de luz', 'Cálida, estilo película', 0, 100, 5, '%'],
      ['rg', 'fog', 'Niebla', 'Abajo, se mueve despacio', 0, 100, 5, '%'],
      ['sw', 'rim', 'Borde luminoso', 'Brilla el borde de la bandeja donde tocás'],
      ['sw', 'spot', 'Luz que sigue al dedo', 'Un brillo sobre la bandeja'],
      ['sw', 'tiltLight', 'Luz con la inclinación', 'Mové el teléfono (pide permiso en iPhone)'],
      ['rg', 'titleGlow', 'Resplandor del título', '', 0, 40, 2, ' px'],
      ['sw', 'shimmer', 'Brillo que cruza el título'],
    ]],
    ['Bandeja', [
      ['rg', 'glass', 'Opacidad del cristal', '0 = como en la app (82 %)', 0, 100, 5, '%'],
      ['rg', 'blur', 'Desenfoque del cristal', '0 = como en la app (14 px)', 0, 40, 2, ' px'],
      ['rg', 'rad', 'Esquinas de la bandeja', 'Como en la app: 44', 0, 70, 2, ' px'],
      ['sg', 'mat', 'Material', 'Textura sobre la bandeja', [['ninguno', 'Ninguno'], ['cepillado', 'Metal cepillado'], ['arena', 'Arena'], ['carbono', 'Carbono'], ['cuero', 'Cuero'], ['madera', 'Madera'], ['marmol', 'Mármol'], ['tela', 'Tela'], ['neumatico', 'Neumático'], ['panal', 'Panal'], ['seigaiha', 'Olas japonesas'], ['azulejos', 'Azulejos']]],
      ['rg', 'matOpa', 'Intensidad del material', '', 5, 100, 5, '%'],
    ]],
    ['Movimiento', [
      ['sg', 'trans', 'Al abrir una pantalla', '', [['normal', 'Normal'], ['push', 'Desde el costado'], ['sheet', 'Desde abajo'], ['zoom', 'Zoom'], ['fade', 'Aparece']]],
      ['sw', 'stagger', 'Entrada escalonada', 'Las filas aparecen una tras otra'],
      ['sw', 'intro', 'Entrada del inicio', 'Las fichas caen al abrir la app'],
      ['sw', 'titleBlur', 'Título con desenfoque', 'Al cambiar de ficha'],
      ['sw', 'titlePar', 'Título que acompaña', 'Se desliza con las fichas'],
      ['sw', 'haptic', 'Vibración al tocar', 'Solo en iPhone con iOS 18 o más'],
      ['sw', 'sound', 'Sonido suave al tocar'],
    ]],
    ['Texto', [
      ['sg', 'font', 'Letra', '', [['normal', 'Normal'], ['rounded', 'Redondeada'], ['serif', 'Serif en títulos'], ['mono', 'Monoespaciada']]],
      ['rg', 'hw', 'Grosor de los títulos', 'Como en la app: 300', 100, 700, 50, ''],
      ['rg', 'ls', 'Espacio entre letras del título', 'Como en la app: −35', -80, 40, 5, ''],
    ]],
  ];
  const BUILTIN = [
    ['Mi mezcla', { shine: true, spin: 55, pop: true, filled: true, tex: 'topografia', grain: 40, vignette: 80 }],
    ['Mi mezcla + luz', { shine: true, spin: 55, pop: true, filled: true, tex: 'topografia', grain: 40, vignette: 80, key: 65, keyAng: 225, bevel: 4, cone: 30, stateLight: 40, orbit: 30, touchLight: true, look: 'frio', neon: 50 }],
    ['Estudio', { key: 75, keyAng: 225, bevel: 5, cone: 45, metal: 'plata', shadow: true, vignette: 40, contrast: 108 }],
    ['Atardecer', { ambient: 80, skyAuto: false, skyHour: 18.5, sky: 60, rays: 50, flare: 35, leak: 30, look: 'calido', key: 50, keyAng: 330 }],
    ['Neón', { neon: 80, neonCycle: true, chipRim: true, glow: 20, orbit: 55, vignette: 50, look: 'vivido', touchLight: true }],
    ['Noche de ciudad', { scene: 'ciudad', sceneInt: 60, allbg: true, vignette: 45, sky: 40, skyAuto: false, skyHour: 22, glow: 16, shadow: true, trans: 'zoom' }],
    ['Tormenta', { scene: 'tormenta', sceneInt: 70, vignette: 55, grain: 14, allbg: true, dim: 45, glass: 55, blur: 22 }],
    ['Mar', { scene: 'olas', sky: 55, skyAuto: false, skyHour: 7.5, rays: 40, glass: 60, blur: 24, tex: 'seigaiha', texOpa: 40 }],
    ['Ruta', { scene: 'carretera', vignette: 50, glow: 20, float: true, metal: 'plata', mat: 'neumatico', matOpa: 22, tex: 'neumatico' }],
    ['Red eléctrica', { scene: 'red', sceneInt: 65, glow: 24, shine: true, spin: 30, tex: 'circuito', trans: 'fade' }],
    ['Estrellas', { scene: 'estrellas', vignette: 40, chipLight: 50, flare: 35, bokeh: 30, tex: 'fibonacci' }],
    ['Cristal', { glass: 55, blur: 28, rad: 60, spot: true, rim: true, tilt: 26, shine: true, trans: 'sheet', bevel: 4 }],
    ['Taller', { tex: 'carbono', metal: 'oro', bevel: 6, mat: 'cepillado', matOpa: 30, shadow: true, font: 'mono' }],
    ['Todo apagado', {}],
  ];
  const mixes = () => { try { return JSON.parse(localStorage.getItem(MIX_KEY)) || {}; } catch (_) { return {}; } };
  const saveMixes = (m) => { try { localStorage.setItem(MIX_KEY, JSON.stringify(m)); } catch (_) {} };
  const btn = el('button', 'lab-btn', 'Lab'), sheet = el('div', 'lab-sheet'), tabs = el('div', 'lab-tabs'), body = el('div', 'lab-body');
  btn.setAttribute('aria-label', 'Laboratorio de efectos'); sheet.inert = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Laboratorio de efectos');
  sheet.innerHTML = '<div class="lab-head"><div><h2>Laboratorio</h2><p>Todo apagado = idéntica a la app. Probá y decime qué te gusta.</p></div><button class="lab-x" aria-label="Cerrar">×</button></div>';
  sheet.append(tabs, body);
  const open = (v) => { sheet.classList.toggle('open', v); sheet.inert = !v; };
  btn.addEventListener('click', () => open(!sheet.classList.contains('open')));
  $('.lab-x', sheet).addEventListener('click', () => open(false));
  document.addEventListener('pointerdown', (e) => { if (sheet.classList.contains('open') && !e.target.closest('.lab-sheet, .lab-btn')) open(false); }, true);

  let tab = 0;
  function row(it) {
    const [kind, key, label, sub] = it, r = el('div', 'lab-row'), text = el('div', '', `${label}${sub ? `<small>${sub}</small>` : ''}`);
    r.appendChild(text);
    if (kind === 'sw') {
      const s = el('button', 'lab-sw'); s.setAttribute('role', 'switch'); s.setAttribute('aria-checked', !!FX[key]);
      s.addEventListener('click', () => { FX[key] = !FX[key]; s.setAttribute('aria-checked', FX[key]); apply(); if (key === 'intro' && FX.intro) intro(); }); r.appendChild(s);
    } else if (kind === 'rg') {
      const [, , , , min, max, step, unit] = it, i = el('input'), o = el('output', '', `${FX[key]}${unit}`);
      Object.assign(i, { type: 'range', min, max, step, value: FX[key] }); i.setAttribute('aria-label', label);
      i.addEventListener('input', () => { FX[key] = Number(i.value); o.textContent = `${FX[key]}${unit}`; apply(); }); r.append(o, i);
    } else if (kind === 'sg') {
      const opts = it[4], g = el('div', 'lab-seg');
      opts.forEach(([v, l]) => { const b = el('button', '', l); b.setAttribute('aria-pressed', String(FX[key]) === String(v)); b.addEventListener('click', () => { FX[key] = v; $$('button', g).forEach((x) => x.setAttribute('aria-pressed', x === b)); apply(); }); g.appendChild(b); });
      r.classList.add('stack'); r.appendChild(g);
    } else if (kind === 'co') {
      const wrap = el('div', 'lab-seg nowrap'), c = el('input'), x = el('button', '', FX[key] ? 'Quitar' : 'Sin usar');
      Object.assign(c, { type: 'color', value: FX[key] || '#4fb58a' }); c.setAttribute('aria-label', label);
      c.addEventListener('input', () => { FX[key] = c.value; x.textContent = 'Quitar'; apply(); });
      x.addEventListener('click', () => { FX[key] = null; x.textContent = 'Sin usar'; apply(); });
      wrap.append(c, x); r.appendChild(wrap);
    }
    return r;
  }
  const json = el('pre', 'lab-json');
  const diff = () => Object.fromEntries(Object.entries(FX).filter(([k, v]) => v !== DEF[k]));
  function showJson() { const d = diff(); json.textContent = Object.keys(d).length ? JSON.stringify(d, null, 1) : 'Sin cambios: igual a la app.'; }
  function mixesTab() {
    body.append(el('h4', '', 'Combinaciones'));
    const pr = el('div', 'lab-presets');
    BUILTIN.forEach(([n, v]) => { const b = el('button', '', n); b.addEventListener('click', () => { FX = { ...DEF, ...v }; apply(); if (FX.intro) intro(); }); pr.appendChild(b); });
    body.appendChild(pr);
    body.append(el('h4', '', 'Mis mezclas'));
    const mine = el('div', 'lab-presets'), m = mixes();
    Object.keys(m).forEach((n) => { const b = el('button', '', n), x = el('button', 'del', '×'); x.setAttribute('aria-label', `Borrar ${n}`); b.addEventListener('click', () => { FX = { ...DEF, ...m[n] }; apply(); }); x.addEventListener('click', () => { const q = mixes(); delete q[n]; saveMixes(q); build(); }); const w = el('span', 'lab-mix'); w.append(b, x); mine.appendChild(w); });
    const sv = el('button', 'lab-act', 'Guardar la mezcla actual'); sv.addEventListener('click', () => { const n = (prompt('Nombre de la mezcla') || '').trim(); if (n) { const q = mixes(); q[n] = diff(); saveMixes(q); build(); } });
    body.append(mine, sv, el('h4', '', 'Compartir o importar'));
    const ta = el('textarea', 'lab-ta'); ta.placeholder = 'Pegá acá una mezcla (JSON) y tocá «Aplicar»'; ta.value = JSON.stringify(diff());
    const ap = el('button', 'lab-act', 'Aplicar lo pegado'), cp = el('button', 'lab-act', 'Copiar la actual'), rs = el('button', 'lab-act danger', 'Restablecer todo');
    ap.addEventListener('click', () => { try { FX = { ...DEF, ...JSON.parse(ta.value) }; apply(); build(); } catch (_) { ta.value = 'Ese texto no es una mezcla válida.'; } });
    cp.addEventListener('click', () => { ta.value = JSON.stringify(diff()); ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (_) {} });
    rs.addEventListener('click', () => { FX = { ...DEF }; apply(); build(); });
    const bar = el('div', 'lab-presets'); bar.append(ap, cp, rs);
    body.append(ta, bar, el('h4', '', 'Lo que está encendido'), json); showJson();
  }
  function build() {
    tabs.innerHTML = ''; body.innerHTML = '';
    [...UI.map((u) => u[0]), 'Mezclas'].forEach((n, i) => { const b = el('button', '', n); b.setAttribute('aria-pressed', i === tab); b.addEventListener('click', () => { tab = i; build(); }); tabs.appendChild(b); });
    if (tab < UI.length) { UI[tab][1].forEach((it) => body.appendChild(row(it))); body.append(el('h4', '', 'Lo que está encendido'), json); showJson(); } else mixesTab();
    body.scrollTop = 0;
  }
  build(); document.body.append(btn, sheet);
  apply(); if (FX.intro) intro();
})();
