  /* ================= Asistentes: una pregunta por pantalla ================= */
  const r2 = (v) => Math.round(v * 100) / 100;
  const r1 = (v) => Math.round(v * 10) / 10;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const field = (id, label, input, hint = '') => `<div class="field"><label for="${id}">${label}</label>${input}${hint ? `<p class="hintt">${hint}</p>` : ''}</div>`;
  const GAP = 0.5; // % mínimo entre dos porcentajes (inicio y fin / objetivo)
  const wrap = (n) => ((n % 1440) + 1440) % 1440;
  const mm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const minOf = (d) => d.getHours() * 60 + d.getMinutes();
  const fmtDur = (mins) => { mins = Math.max(0, Math.round(mins)); const h = Math.floor(mins / 60), m = mins % 60; return h ? `${h} h ${m} min` : `${m} min`; };
  /** "23:30", "2330" o "930" → minutos desde la medianoche; null si no es una hora. */
  function parseClock(s) {
    s = String(s).trim();
    let h, m;
    if (s.includes(':')) [h, m] = s.split(':').map(Number);
    else { const d = s.replace(/\D/g, ''); if (d.length < 3 || d.length > 4) return null; h = Number(d.slice(0, -2)); m = Number(d.slice(-2)); }
    return h >= 0 && h < 24 && m >= 0 && m < 60 ? h * 60 + m : null;
  }
  /** Próxima vez que el reloj marca `min`, siempre posterior a `after` (mismo criterio que el repo original). */
  function nextAt(min, base, after) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, min);
    if (d <= after) d.setDate(d.getDate() + 1);
    return d;
  }
  const lastOdo = () => { const c = S.charges.filter((x) => x.odometerKm != null).sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0]; return c ? c.odometerKm : null; };
  const setPct = (v) => r1(Math.max(0, Math.min(99.5, v)));

  /** Botones de ajuste fino: un toque suma un paso; mantenido, repite y acelera de a poco (x1, x2 a 1,5 s, x5 a 3 s). */
  function holdRepeat(btn, step) {
    let timer = 0, rep = 0;
    const stop = () => { clearTimeout(timer); clearInterval(rep); };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault(); stop(); step(1);
      const t0 = performance.now();
      timer = setTimeout(() => { rep = setInterval(() => { const held = performance.now() - t0; step(held > 3000 ? 5 : held > 1500 ? 2 : 1); }, 110); }, 420);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('click', (e) => { if (e.detail === 0) step(1); }); // teclado
  }

  /** Aviso breve arriba de Inicio (p. ej. "Carga guardada"). */
  let flashTimer = 0;
  function flash(msg) {
    const bar = $('#topBar'); clearTimeout(flashTimer);
    bar.innerHTML = `<span class="toast">${msg}</span>`;
    flashTimer = setTimeout(renderTop, 2800);
  }

  /**
   * Dial reutilizable (círculo central + ajuste fino + regla). `cfg` describe el valor: { get, set, seed, min, max,
   * step, ppv (px por unidad), major, every, nudges: [[delta, texto, aria] x4], label(), tick(n), noRuler, onChange }.
   */
  function makeDial(tray, onGo) {
    tray.innerHTML = '<svg class="pointer" width="20" height="10" viewBox="0 0 20 10" aria-hidden="true"><path d="M0 0h20L10 10z" fill="#fff"/></svg>'
      + '<div class="dial"><button class="nudge l p0"></button><button class="nudge s p1"></button><button class="go"><span class="goval"></span></button><button class="nudge s p2"></button><button class="nudge l p3"></button></div>'
      + '<div class="ruler" tabindex="0" role="slider"><div class="ruler-in"><div class="ticks"></div></div></div><i class="mark" aria-hidden="true"></i><p class="hint"></p>';
    const $$ = (s) => tray.querySelector(s);
    const ruler = $$('.ruler'), ticks = $$('.ticks'), rin = $$('.ruler-in'), goV = $$('.goval'), goBtn = $$('.go'), hint = $$('.hint');
    const nbs = [...tray.querySelectorAll('.nudge')];
    let cfg = null, prog = false, progT = 0, snapT = 0;

    const cur = () => (cfg.get() ?? cfg.seed);
    function toRuler(v) {
      prog = true; clearTimeout(progT); progT = setTimeout(() => (prog = false), 140);
      ruler.scrollTo({ left: Math.min(Math.max(v, 0), cfg.max) * cfg.ppv, behavior: 'instant' });
    }
    function sync(moveRuler) {
      const t = cfg.label();
      goV.textContent = t; goV.style.fontSize = `${t.length <= 4 ? 46 : t.length === 5 ? 38 : t.length <= 7 ? 30 : 24}px`;
      if (moveRuler && !cfg.noRuler) toRuler(cur());
      ruler.setAttribute('aria-valuenow', cur());
    }
    function config(c, hintText) {
      cfg = c; hint.textContent = hintText;
      tray.classList.toggle('noruler', !!c.noRuler);
      if (!c.noRuler) {
        const w = ruler.clientWidth || 402, half = w / 2;
        rin.style.width = `${c.max * c.ppv + w + 2}px`;
        ticks.style.cssText = `left:${half}px;width:${c.max * c.ppv + 2}px;--minor:${c.step * c.ppv}px;--major:${c.major * c.ppv}px`;
        let labels = '';
        for (let n = 0; n <= c.max; n += c.every) labels += `<span style="left:${half + n * c.ppv}px">${c.tick(n)}</span>`;
        rin.querySelectorAll('span').forEach((s) => s.remove());
        rin.insertAdjacentHTML('beforeend', labels);
        ruler.setAttribute('aria-valuemin', 0); ruler.setAttribute('aria-valuemax', c.max); ruler.setAttribute('aria-label', c.aria || 'Valor');
      }
      nbs.forEach((b, i) => { b.textContent = c.nudges[i][1]; b.setAttribute('aria-label', c.nudges[i][2] || c.nudges[i][1]); });
      sync(true);
    }
    function apply(v) { cfg.set(v); sync(true); cfg.onChange(); }
    ruler.addEventListener('scroll', () => {
      if (prog || !cfg || cfg.noRuler) return;
      const v = Math.min(cfg.max, Math.round(ruler.scrollLeft / cfg.ppv / cfg.step) * cfg.step);
      cfg.set(cfg.step < 1 ? r1(v) : v); sync(false); cfg.onChange();
      clearTimeout(snapT);
      snapT = setTimeout(() => { prog = true; ruler.scrollTo({ left: cur() * cfg.ppv, behavior: 'smooth' }); setTimeout(() => (prog = false), 350); }, 160);
    }, { passive: true });
    ruler.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d != null && cfg) { e.preventDefault(); apply(cur() + d * cfg.step); }
    });
    nbs.forEach((b, i) => holdRepeat(b, (mult) => { const d = cfg.nudges[i][0]; apply(cur() + d * (cfg.kind === 'num' ? mult : 1)); }));
    goBtn.addEventListener('click', () => onGo());
    (function mouseDrag() { // solo vista previa de escritorio
      let md = null;
      ruler.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') md = { x: e.clientX, l: ruler.scrollLeft, moved: false }; });
      addEventListener('pointermove', (e) => {
        if (!md) return;
        const dx = e.clientX - md.x;
        if (!md.moved && Math.abs(dx) > 3) { md.moved = true; ruler.classList.add('mouse-drag'); }
        if (md.moved) ruler.scrollLeft = md.l - dx;
      });
      addEventListener('pointerup', () => { md = null; ruler.classList.remove('mouse-drag'); });
    })();
    return {
      config, sync,
      setEnabled(on) { tray.classList.toggle('off', !on); nbs.forEach((b) => (b.disabled = !on)); ruler.tabIndex = on ? 0 : -1; },
    };
  }

  /** Configuraciones de dial que se repiten en los asistentes. */
  const PCT_CFG = { kind: 'num', min: 0, max: 100, step: 0.1, ppv: 80, major: 1, every: 10, tick: String, nudges: [[-1, '−1', 'Restar 1'], [-0.1, '−0,1', 'Restar 0,1'], [0.1, '+0,1', 'Sumar 0,1'], [1, '+1', 'Sumar 1']] };
  const KWH_CFG = { ...PCT_CFG, max: 120, every: 5 };
  const CLOCK_CFG = { kind: 'time', min: 0, max: 1435, step: 5, ppv: 80 / 60, major: 60, every: 120, tick: (n) => String(n / 60).padStart(2, '0'), nudges: [[-60, '−1 h', 'Una hora antes'], [-15, '−15', '15 minutos antes'], [15, '+15', '15 minutos después'], [60, '+1 h', 'Una hora después']] };
  const PRICE_CFG = { ...PCT_CFG, max: 60, ppv: 40, every: 5 };
  const FEE_CFG = { kind: 'num', min: 0, max: 400, step: 1, ppv: 3, major: 10, every: 50, tick: String, nudges: [[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']] };
  const odoCfg = (W) => ({ kind: 'num', noRuler: true, aria: 'Odómetro', get: () => W.odo, set: (v) => { W.odo = Math.max(0, Math.round(v)); }, seed: lastOdo() || 0, label: () => (W.odo == null ? 'Omitir' : int(W.odo)), nudges: [[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']] });

  /**
   * Autonomía con el odómetro (opcional): suma el tramo desde la última carga al consumo real,
   * medido del lado de la batería con (fin % anterior − inicio % actual) × batería / km.
   */
  function autoLine(now, fromPct, endPct, kwh, odo) {
    const B = S.vehicle.batteryKwh, has = odo != null;
    const prev = S.charges.filter((c) => c.odometerKm != null).sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0];
    let list = S.charges, seg = '';
    if (has) {
      if (prev && odo <= prev.odometerKm) seg = `El odómetro tiene que ser mayor al de tu última carga (${int(prev.odometerKm)} km).`;
      else {
        list = [...S.charges, { location: 'home', startAt: now.toISOString(), odometerKm: odo, kwh, startPct: fromPct, endPct }];
        const km = prev ? odo - prev.odometerKm : 0, used = prev && prev.endPct != null && fromPct != null ? ((prev.endPct - fromPct) / 100) * B : 0;
        if (prev && km >= 10 && used > 0) seg = ` Desde tu última carga: ${dec((used / km) * 100, 1)} kWh/100 km en ${int(km)} km.`;
      }
    }
    const rc = L.rangeConsumption(S.vehicle, L.realConsumption(list, B));
    return { km: endPct != null ? L.rangeAtPct(B, rc.whKm, endPct) : null, text: seg };
  }
  const odoCheck = (W) => { const prev = lastOdo(); return W.odo != null && prev != null && W.odo <= prev ? `Tiene que ser mayor al de tu última carga (${int(prev)} km).` : null; };
  const row = (l, v, em = '') => `<div class="kv"><span>${l}${em ? `<em>${em}</em>` : ''}</span><b>${v}</b></div>`;
  const seg2 = (act, items, sel) => `<div class="seg wide" role="group">${items.map(([v, l]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${String(sel) === String(v)}">${l}</button>`).join('')}</div>`;

  /**
   * Motor del asistente. `def.steps()` devuelve los pasos actuales (la lista puede cambiar según las respuestas).
   * Cada paso: { id, q, optional, dial() | choices()+value()+pick(v), view(), enabled(), enter(), check(), skip(), act(name, data) }.
   */
  function createWizard(root, def) {
    root.innerHTML = '<header class="fn-bar w"><button class="icon wback" aria-label="Atrás"><svg width="22" height="22" viewBox="0 0 22 22"><path d="M14 4l-7 7 7 7"/></svg></button><div class="dots" role="img"></div><button class="icon txt wskip" hidden>Omitir</button></header>'
      + '<div class="fn-body"><div class="center"><p class="q" role="status" aria-live="polite"></p><button class="value wvalue" aria-label="Escribir el valor exacto"><span class="num"></span><span class="unit"></span></button>'
      + '<input class="value-input winput" type="text" autocomplete="off" aria-label="Valor" hidden><p class="meta wctx"></p><div class="wbands" style="display:contents"></div><div class="wextra"></div></div><div class="tray2 wtray"></div></div>';
    const $$ = (s) => root.querySelector(s);
    const input = $$('.winput'), valueBtn = $$('.wvalue'), extra = $$('.wextra');
    let step = 0;
    const list = () => def.steps();
    const cur = () => { const l = list(); step = Math.min(step, l.length - 1); return l[step]; };
    const dial = makeDial($$('.wtray'), () => next());

    function choiceHtml(st) {
      const items = st.choices(), sel = String(st.value());
      return `<div class="choices${items.length > 3 ? ' two' : ''}" role="group">${items.map((it) => `<button class="choice" data-pick="${esc(it.v)}" aria-pressed="${String(it.v) === sel}"><b>${esc(it.label)}</b>${it.sub ? `<em>${esc(it.sub)}</em>` : ''}</button>`).join('')}</div>`;
    }
    function update() {
      const st = cur(), v = st.view ? st.view() : {};
      $$('.num').textContent = v.num ?? ''; $$('.unit').textContent = v.unit ?? ''; $$('.wctx').textContent = v.ctx ?? '';
      $$('.wbands').innerHTML = v.bands ?? '';
      extra.innerHTML = (st.choices ? choiceHtml(st) : '') + (v.extra ?? '');
      if (st.dial) dial.sync(false);
    }
    function render() {
      const l = list(), st = cur();
      $$('.q').textContent = st.q;
      $$('.dots').innerHTML = l.map((_, i) => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"></i>`).join('');
      $$('.dots').setAttribute('aria-label', `Paso ${step + 1} de ${l.length}`);
      $$('.wskip').hidden = !st.optional;
      input.hidden = true;
      const dc = st.dial ? st.dial() : null;
      valueBtn.hidden = !dc;
      if (dc) {
        dc.onChange = update;
        dial.config(dc, 'Tocá el centro para continuar');
        dial.setEnabled(st.enabled ? st.enabled() : true);
      } else {
        const last = st.id === 'sum';
        dial.config({ kind: 'num', noRuler: true, max: 0, step: 1, ppv: 1, major: 1, every: 1, tick: String, nudges: [[0, ''], [0, ''], [0, ''], [0, '']], get: () => 0, seed: 0, set() {}, label: () => (last ? def.cta : 'Siguiente'), onChange() {} }, last ? `Tocá el centro para ${def.verb}` : 'Tocá el centro para continuar');
        dial.setEnabled(false);
      }
      update();
    }
    function goTo(n) { step = n; const st = cur(); if (st.enter) st.enter(); render(); }
    function next() {
      const st = cur(), err = st.check && st.check();
      if (err) { $$('.wctx').textContent = err; return; }
      if (st.id === 'sum') { def.finish(); return; }
      goTo(step + 1);
    }
    $$('.wback').addEventListener('click', () => { if (step > 0) goTo(step - 1); else closeFn(); });
    $$('.wskip').addEventListener('click', () => { const st = cur(); if (st.skip) st.skip(); goTo(step + 1); });
    extra.addEventListener('click', (e) => {
      const st = cur(), p = e.target.closest('[data-pick]'), a = e.target.closest('[data-act]');
      if (p && st.pick) { st.pick(p.dataset.pick); render(); }
      else if (a && st.act) { st.act(a.dataset.act, a.dataset); render(); }
    });
    // Tocar el número grande abre el teclado para escribir el valor exacto.
    valueBtn.addEventListener('click', () => {
      const dc = cur().dial && cur().dial(); if (!dc) return;
      input.inputMode = dc.kind === 'time' ? 'numeric' : 'decimal'; input.placeholder = dc.kind === 'time' ? 'HH:MM' : '';
      const g = dc.get();
      input.value = g == null ? '' : dc.kind === 'time' ? mm(g) : fmtNum(g, 0, 2);
      valueBtn.hidden = true; input.hidden = false; input.focus(); input.select();
    });
    function commit() {
      if (input.hidden) return;
      const dc = cur().dial && cur().dial(), raw = input.value;
      input.hidden = true; valueBtn.hidden = false;
      if (!dc) return;
      const v = dc.kind === 'time' ? parseClock(raw) : num(raw);
      if (v != null && isFinite(v)) dc.set(v);
      render();
    }
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    return { render, start() { step = 0; const st = cur(); if (st.enter) st.enter(); } };
  }

  /* ================= Programar carga ================= */
  const W = { from: 20, stopMin: 7 * 60, goal: null, later: false, startMin: 23 * 60, odo: null };

  /** Valores de partida: % de inicio típico del historial; si hay una carga programada, sus datos. */
  function initProg() {
    const starts = S.charges.filter((c) => c.startPct != null).map((c) => c.startPct);
    Object.assign(W, { from: starts.length ? r1(starts.reduce((a, b) => a + b, 0) / starts.length) : 20, stopMin: 7 * 60, goal: null, later: false, startMin: 23 * 60, odo: null });
    const a = S.active;
    if (a) {
      const st = new Date(a.startAt), sp = new Date(a.stopAt);
      Object.assign(W, { from: a.startPct, later: a.mode === 'scheduled', startMin: minOf(st), stopMin: minOf(sp), goal: a.goal, odo: a.odo });
    }
    progWiz.start();
  }

  /** Plan con los datos cargados hasta ahora. `later` = si el inicio es a una hora fija o ahora. */
  function planCalc(now, later) {
    const B = S.vehicle.batteryKwh, kw = nominalKw(), calib = calibration().factor;
    const start = later ? nextAt(W.startMin, now, now) : now;
    const stop = nextAt(W.stopMin, start, start);
    const est = L.estimateAtTime(W.from, start, stop, kw, B, calib);
    const cost = est.kwhDelivered > 0.01
      ? L.computeHomeChargeCost(start, stop, est.kwhDelivered, S.rates, S.puntaStart, { nominalKw: kw, calibration: calib, startPct: W.from, batteryKwh: B }) : null;
    return { B, kw, calib, start, stop, est, cost };
  }
  /** Mejor hora de inicio para llegar al objetivo cortando a la hora de salida (casi todo en Valle). */
  function bestStart(now) {
    if (W.goal == null || !(nominalKw() > 0)) return null;
    return L.suggestStart({ fromPct: W.from, toPct: W.goal, deadline: nextAt(W.stopMin, now, now), nominalKw: nominalKw(), batteryKwh: S.vehicle.batteryKwh, calibration: calibration().factor, rates: S.rates, puntaStart: S.puntaStart, altStart: now });
  }

  const PROG_STEPS = [
    { id: 'from', q: '¿Con cuánta batería enchufás?',
      dial: () => ({ ...PCT_CFG, aria: 'Batería al enchufar', get: () => W.from, set: (v) => { W.from = setPct(v); }, seed: W.from, label: () => pctTxt(W.from) }),
      view: () => { const rc = L.rangeConsumption(S.vehicle, L.realConsumption(S.charges, S.vehicle.batteryKwh)); return { num: pctTxt(W.from), unit: '%', ctx: `≈ ${L.rangeAtPct(S.vehicle.batteryKwh, rc.whKm, W.from)} km de autonomía ahora` }; } },
    { id: 'stop', q: '¿A qué hora cortás?',
      dial: () => ({ ...CLOCK_CFG, aria: 'Hora de corte', get: () => W.stopMin, set: (v) => { W.stopMin = wrap(v); }, seed: W.stopMin, label: () => mm(W.stopMin) }),
      view: () => { const p = planCalc(new Date(), false); return { num: mm(W.stopMin), ctx: p.cost ? `Si empezás ahora llegás a ≈ ${pctTxt(p.est.pct)}% · ${kwhTxt(p.est.kwhDelivered)} kWh · ${money(p.cost.total)}` : '' }; } },
    { id: 'goal', q: '¿Hasta cuánta batería querés llegar?', optional: true,
      dial: () => ({ ...PCT_CFG, aria: 'Objetivo de batería', get: () => W.goal, set: (v) => { W.goal = r1(Math.max(W.from + GAP, Math.min(100, v))); }, seed: Math.max(80, W.from + GAP), label: () => (W.goal == null ? 'Omitir' : pctTxt(W.goal)) }),
      skip: () => { W.goal = null; },
      view: () => ({ num: W.goal == null ? '—' : pctTxt(W.goal), unit: W.goal == null ? '' : '%', ctx: W.goal == null ? 'Opcional: con un objetivo te digo a qué hora empezar.' : `${kwhTxt(L.kwhFromPct(W.from, W.goal, S.vehicle.batteryKwh) || 0)} kWh a cargar` }) },
    { id: 'start', q: '¿Cuándo empieza?',
      dial: () => ({ ...CLOCK_CFG, aria: 'Hora de inicio', get: () => W.startMin, set: (v) => { W.startMin = wrap(v); W.later = true; }, seed: W.startMin, label: () => (W.later ? mm(W.startMin) : 'Ahora') }),
      enabled: () => W.later,
      // con un objetivo, la hora de inicio arranca en la sugerida (todo en Valle)
      enter: () => { const s = bestStart(new Date()); if (s && s.start > new Date()) { W.later = true; W.startMin = minOf(s.start); } },
      act: (name, d) => { if (name === 'later') W.later = d.v === '1'; else if (name === 'usesug') { W.later = true; W.startMin = Number(d.m); } },
      view: () => {
        const now = new Date(), p = planCalc(now, W.later), s = bestStart(now);
        let extra = seg2('later', [[0, 'Ahora'], [1, 'Más tarde']], W.later ? 1 : 0);
        if (s && s.start > now) { const m = minOf(s.start); extra += `<p class="note">Para llegar a ${pctTxt(W.goal)}%, lo mejor es empezar a las ${mm(m)} (${Math.round(s.valleShare * 100)}% en Valle, ${money(s.best.total)}).${W.later && W.startMin === m ? '' : ` <button class="link inl-link" data-act="usesug" data-m="${m}">Usar esa hora</button>`}</p>`; }
        return { num: W.later ? mm(W.startMin) : 'Ahora', ctx: p.cost ? `≈ ${pctTxt(p.est.pct)}% a las ${mm(W.stopMin)} · ${kwhTxt(p.est.kwhDelivered)} kWh · ${money(p.cost.total)}` : '', bands: p.cost ? bands(p.cost.valleKwh, p.cost.llanoKwh, p.cost.puntaKwh) : '', extra };
      } },
    { id: 'odo', q: '¿Cuál es el odómetro?', optional: true,
      dial: () => odoCfg(W), skip: () => { W.odo = null; }, check: () => odoCheck(W),
      view: () => { const p = planCalc(new Date(), W.later), a = autoLine(new Date(), W.from, W.goal ?? p.est.pct, p.est.kwhDelivered, W.odo); return { num: W.odo == null ? '—' : int(W.odo), unit: W.odo == null ? '' : 'km', ctx: W.odo == null ? 'Opcional: con el odómetro se afina tu consumo real y la autonomía.' : `Autonomía al terminar ≈ ${a.km} km. ${a.text}` }; } },
    { id: 'sum', q: 'Todo listo',
      view: () => {
        const now = new Date(), p = planCalc(now, W.later), a = autoLine(now, W.from, W.goal ?? p.est.pct, p.est.kwhDelivered, W.odo);
        return { extra: row('Empieza', W.later ? hhmm(p.start) : 'Ahora', W.later ? '' : 'en cuanto confirmes') + row('Corta', hhmm(p.stop))
          + row('Batería', `${pctTxt(W.from)}% → ≈ ${pctTxt(p.est.pct)}%`, W.goal != null ? `objetivo ${pctTxt(W.goal)}%` : '') + row('Energía', `${kwhTxt(p.est.kwhDelivered)} kWh`)
          + (p.cost ? row('Costo estimado', money(p.cost.total), `${Math.round((p.cost.valleKwh / p.est.kwhDelivered) * 100)}% en Valle`) : '') + row('Autonomía', `≈ ${a.km} km`, W.odo != null ? `odómetro ${int(W.odo)} km` : '') };
      } },
  ];
  const progWiz = createWizard($('#fn-prog'), { steps: () => PROG_STEPS, cta: 'Programar', verb: 'programar', finish: () => scheduleCharge() });
  const renderProg = () => progWiz.render();

  /** Crea la carga activa: "Ahora" arranca a contar ya; "Más tarde" queda en espera hasta la hora de inicio. */
  function scheduleCharge() {
    const now = new Date();
    if (!isFinite(W.from) || !(nominalKw() > 0)) { $('#fn-prog .wctx').textContent = 'Configurá tu cargador en Autonomía.'; return; }
    const start = W.later ? nextAt(W.startMin, now, now) : now, stop = nextAt(W.stopMin, start, start);
    S.active = { mode: W.later ? 'scheduled' : 'live', startAt: start.toISOString(), stopAt: stop.toISOString(), startPct: W.from, goal: W.goal, odo: W.odo };
    confirmAt = null; confirmShown = false; persist();
    closeFn(); renderStatus(); tick();
    flash(W.later ? `Programada · empieza a las ${hhmm(start)}` : `Cargando desde ${pctTxt(W.from)}%`);
  }

  /* ================= Registrar carga (ya cargada) ================= */
  const R = { kind: 'home', by: 'kwh', kwh: 25, from: 20, to: 80, when: 'now', day: 0, endMin: 0, startMin: 0, startTouched: false, net: '', varIdx: 0, price: null, fee: null, odo: null };

  /** Valores de partida a partir del historial: la última carga y el % de inicio típico. */
  function initCargar() {
    const sorted = [...S.charges].sort((a, b) => new Date(b.startAt) - new Date(a.startAt)), starts = S.charges.filter((c) => c.startPct != null).map((c) => c.startPct);
    const from = starts.length ? r1(starts.reduce((a, b) => a + b, 0) / starts.length) : 20;
    Object.assign(R, { kind: 'home', by: 'kwh', kwh: sorted[0] ? r1(sorted[0].kwh) : 25, from, to: Math.max(from + GAP, sorted[0] && sorted[0].endPct != null ? sorted[0].endPct : 80), when: 'now', day: 0, endMin: minOf(new Date()), startTouched: false, net: '', varIdx: 0, price: null, fee: null, odo: null });
    regWiz.start();
  }
  const rGroup = () => groups().find((g) => g.key === R.net) || null;
  const rVariant = () => { const g = rGroup(); return g ? g.variants[Math.min(R.varIdx, g.variants.length - 1)] : null; };
  const rKwh = () => (R.by === 'kwh' ? R.kwh : r2(L.kwhFromPct(R.from, R.to, S.vehicle.batteryKwh) || 0));
  /** Elige la red (por defecto UTE) con la variante vigente a esta hora y su precio sugerido. */
  function setNet(key) {
    const g = groups().find((x) => x.key === key) || groups().find((x) => x.key === 'UTE') || groups()[0];
    if (!g) return;
    R.net = g.key; R.varIdx = Math.max(0, g.variants.indexOf(L.pickVariant(g, new Date())));
    useVariantPrice();
  }
  function useVariantPrice() { const v = rVariant(); if (v) { R.price = v.price; R.fee = v.fee; } }
  /** Momento en que terminó la carga: "recién" = ahora; si no, el día (hoy o ayer) y la hora elegidos. */
  function rEnd(now) {
    if (R.when === 'now') return now;
    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - R.day, 0, R.endMin);
    if (d > now) d = new Date(d.getTime() - 864e5); // esa hora de hoy todavía no llegó
    return d;
  }
  /** Duración estimada de la carga por la potencia del cargador (con cola CV si se cargó por %). */
  function rMinutes(kwh) {
    const kw = nominalKw();
    if (!(kwh > 0 && kw > 0)) return 120;
    return Math.max(10, R.by === 'pct' ? L.minutesToDeliver(R.from, kwh, kw, S.vehicle.batteryKwh, calibration().factor) || 120 : Math.ceil((kwh / kw) * 60));
  }
  function rWindow(now, kwh) {
    const end = rEnd(now);
    if (R.when === 'pick' && R.startTouched) {
      let s = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 0, R.startMin);
      if (s >= end) s = new Date(s.getTime() - 864e5);
      return { start: s, end };
    }
    return { start: new Date(end.getTime() - rMinutes(kwh) * 60000), end };
  }
  /** Costo con el motor (nunca se guarda un costo tipeado a mano); null si falta algún dato. */
  function rCalc(now) {
    const kwh = rKwh();
    if (!(kwh > 0)) return null;
    try {
      if (R.kind === 'home') {
        const w = rWindow(now, kwh);
        const r = L.computeHomeChargeCost(w.start, w.end, kwh, S.rates, S.puntaStart, { nominalKw: nominalKw(), calibration: calibration().factor, startPct: R.by === 'pct' ? R.from : null, batteryKwh: S.vehicle.batteryKwh });
        return { kwh, w, r, cost: r.total };
      }
      return { kwh, price: R.price, fee: R.fee || 0, at: rEnd(now), cost: L.computePublicChargeCost(R.price, kwh, R.fee || 0) };
    } catch (e) { return { kwh, error: e.message }; }
  }
  const dayTxt = (d, now) => (d.toDateString() === now.toDateString() ? 'hoy' : d.toDateString() === new Date(now.getTime() - 864e5).toDateString() ? 'ayer' : shortDate(d));

  const REG_STEPS = () => {
    const s = [REG.where, REG.how];
    if (R.by === 'kwh') s.push(REG.kwh); else s.push(REG.pfrom, REG.pto);
    if (R.kind === 'public') { s.push(REG.net); if ((rGroup() ? rGroup().variants.length : 0) > 1) s.push(REG.variant); s.push(REG.price); if ((R.fee || 0) > 0) s.push(REG.fee); }
    s.push(REG.when);
    if (R.when === 'pick') { s.push(REG.hend); if (R.kind === 'home') s.push(REG.hstart); }
    s.push(REG.odo, REG.sum);
    return s;
  };
  const REG = {
    where: { id: 'where', q: '¿Dónde cargaste?',
      choices: () => [{ v: 'home', label: 'Casa', sub: 'cargador propio, tarifa de UTE' }, { v: 'public', label: 'Pública', sub: 'red de cargadores o trabajo' }],
      value: () => R.kind, pick: (v) => { R.kind = v; if (v === 'public' && !R.net) setNet('UTE'); } },
    how: { id: 'how', q: '¿Cómo querés cargar el dato?',
      choices: () => [{ v: 'kwh', label: 'Por kWh', sub: 'lo que marcó el cargador o el medidor' }, { v: 'pct', label: 'Por % de batería', sub: 'lo que mostró el auto al empezar y al terminar' }],
      value: () => R.by, pick: (v) => { R.by = v; } },
    kwh: { id: 'kwh', q: '¿Cuántos kWh cargaste?',
      dial: () => ({ ...KWH_CFG, aria: 'kWh cargados', get: () => R.kwh, set: (v) => { R.kwh = Math.min(200, Math.max(0.1, r2(v))); }, seed: R.kwh, label: () => kwhTxt(R.kwh) }),
      view: () => ({ num: kwhTxt(R.kwh), unit: 'kWh', ctx: 'Tocá el número para escribirlo con decimales, ej. 23,47.' }) },
    pfrom: { id: 'pfrom', q: '¿Con cuánta batería empezaste?',
      dial: () => ({ ...PCT_CFG, aria: 'Batería al empezar', get: () => R.from, set: (v) => { R.from = setPct(v); if (R.to < R.from + GAP) R.to = r1(Math.min(100, R.from + GAP)); }, seed: R.from, label: () => pctTxt(R.from) }),
      view: () => { const rc = L.rangeConsumption(S.vehicle, L.realConsumption(S.charges, S.vehicle.batteryKwh)); return { num: pctTxt(R.from), unit: '%', ctx: `≈ ${L.rangeAtPct(S.vehicle.batteryKwh, rc.whKm, R.from)} km de autonomía en ese momento` }; } },
    pto: { id: 'pto', q: '¿Con cuánta terminaste?',
      dial: () => ({ ...PCT_CFG, aria: 'Batería al terminar', get: () => R.to, set: (v) => { R.to = r1(Math.max(R.from + GAP, Math.min(100, v))); }, seed: R.to, label: () => pctTxt(R.to) }),
      view: () => ({ num: pctTxt(R.to), unit: '%', ctx: `${pctTxt(R.from)}% → ${pctTxt(R.to)}% = ${kwhTxt(rKwh())} kWh` }) },
    net: { id: 'net', q: '¿En qué red cargaste?',
      choices: () => groups().map((g) => ({ v: g.key, label: g.key })), value: () => R.net, pick: (v) => setNet(v) },
    variant: { id: 'variant', q: '¿Qué franja o conector?',
      choices: () => (rGroup() ? rGroup().variants.map((v, i) => ({ v: i, label: v.label, sub: `${money2(v.price)}/kWh${v.fee > 0 ? ` + ${money(v.fee)} fijo` : ''}` })) : []),
      value: () => R.varIdx, pick: (v) => { R.varIdx = Number(v); useVariantPrice(); } },
    price: { id: 'price', q: '¿Cuánto cobraron por kWh?',
      dial: () => ({ ...PRICE_CFG, aria: 'Precio por kWh', get: () => R.price, set: (v) => { R.price = r2(Math.max(0.1, v)); }, seed: (rVariant() || {}).price || 10, label: () => (R.price == null ? '—' : fmtNum(R.price, 2, 2)) }),
      view: () => { const v = rVariant(); return { num: R.price == null ? '—' : fmtNum(R.price, 2, 2), unit: '$/kWh', ctx: v ? `Sugerido ${money2(v.price)} (datos ${net.source}). Tocá el número para escribirlo.` : '' }; } },
    fee: { id: 'fee', q: '¿Cuánto es el cargo fijo?', optional: true,
      dial: () => ({ ...FEE_CFG, aria: 'Cargo fijo', get: () => R.fee, set: (v) => { R.fee = r1(Math.max(0, v)); }, seed: R.fee || 0, label: () => fmtNum(R.fee || 0, 0, 1) }),
      skip: () => { R.fee = 0; },
      view: () => ({ num: fmtNum(R.fee || 0, 0, 1), unit: '$', ctx: 'Se cobra una vez por sesión, no depende de los kWh.' }) },
    when: { id: 'when', q: '¿Cuándo cargaste?',
      choices: () => [{ v: 'now', label: 'Recién terminé', sub: R.kind === 'home' ? 'el horario se estima con la potencia de tu cargador' : 'ahora mismo' }, { v: 'pick', label: 'Elegir el horario', sub: 'otro día u otra hora' }],
      value: () => R.when, pick: (v) => { R.when = v; } },
    hend: { id: 'hend', get q() { return R.kind === 'home' ? '¿A qué hora terminó?' : '¿A qué hora fue?'; },
      dial: () => ({ ...CLOCK_CFG, aria: 'Hora', get: () => R.endMin, set: (v) => { R.endMin = wrap(v); }, seed: R.endMin, label: () => mm(R.endMin) }),
      act: (name, d) => { if (name === 'day') R.day = Number(d.v); },
      view: () => { const now = new Date(), e = rEnd(now); return { num: mm(R.endMin), ctx: `${cap(dayTxt(e, now))} a las ${hhmm(e)}${R.day === 0 && minOf(e) !== R.endMin ? ' (esa hora de hoy todavía no llegó)' : ''}`, extra: seg2('day', [[0, 'Hoy'], [1, 'Ayer']], R.day) }; } },
    hstart: { id: 'hstart', q: '¿A qué hora empezó?',
      dial: () => ({ ...CLOCK_CFG, aria: 'Hora de inicio', get: () => R.startMin, set: (v) => { R.startMin = wrap(v); R.startTouched = true; }, seed: R.startMin, label: () => mm(R.startMin) }),
      // por defecto, la hora que sale de los kWh y la potencia del cargador
      enter: () => { if (!R.startTouched) R.startMin = minOf(new Date(rEnd(new Date()).getTime() - rMinutes(rKwh()) * 60000)); },
      view: () => { const c = rCalc(new Date()); return { num: mm(R.startMin), ctx: c && c.w ? `Dura ${fmtDur((c.w.end - c.w.start) / 60000)} · ${money(c.cost)}` : '', bands: c && c.r ? bands(c.r.valleKwh, c.r.llanoKwh, c.r.puntaKwh) : '' }; } },
    odo: { id: 'odo', q: '¿Cuál es el odómetro?', optional: true,
      dial: () => odoCfg(R), skip: () => { R.odo = null; }, check: () => odoCheck(R),
      view: () => {
        const kwh = rKwh(), a = R.by === 'pct' ? autoLine(new Date(), R.from, R.to, kwh, R.odo) : null;
        return { num: R.odo == null ? '—' : int(R.odo), unit: R.odo == null ? '' : 'km', ctx: R.odo == null ? 'Opcional: con el odómetro se afina tu consumo real y la autonomía.' : a ? `Autonomía al terminar ≈ ${a.km} km. ${a.text}` : 'Listo: se usa para calcular tu consumo real.' };
      } },
    sum: { id: 'sum', q: 'Todo listo',
      view: () => {
        const now = new Date(), c = rCalc(now);
        if (!c) return { extra: '<p class="note">Falta indicar cuánto cargaste.</p>' };
        if (c.error) return { extra: `<p class="note" style="color:var(--warn)">${esc(c.error)}</p>` };
        const a = R.by === 'pct' ? autoLine(now, R.from, R.to, c.kwh, R.odo) : null;
        let h = row('Dónde', R.kind === 'home' ? 'Casa' : esc((rVariant() || {}).empresa || R.net))
          + row('Energía', `${kwhTxt(c.kwh)} kWh`, R.by === 'pct' ? `${pctTxt(R.from)}% → ${pctTxt(R.to)}%` : '');
        if (R.kind === 'home') h += row('Horario', `${hhmm(c.w.start)} a ${hhmm(c.w.end)}`, cap(dayTxt(c.w.end, now)));
        else h += row('Precio', `${money2(c.price)}/kWh`, c.fee > 0 ? `+ ${money(c.fee)} de cargo fijo` : '') + row('Cuándo', `${cap(dayTxt(c.at, now))} ${hhmm(c.at)}`);
        h += row('Costo', money(c.cost), c.r ? `${Math.round((c.r.valleKwh / c.kwh) * 100)}% en Valle` : '');
        if (a) h += row('Autonomía', `≈ ${a.km} km`, R.odo != null ? `odómetro ${int(R.odo)} km` : '');
        else if (R.odo != null) h += row('Odómetro', `${int(R.odo)} km`);
        return { extra: h, bands: c.r ? bands(c.r.valleKwh, c.r.llanoKwh, c.r.puntaKwh) : '' };
      } },
  };
  const regWiz = createWizard($('#fn-cargar'), { steps: REG_STEPS, cta: 'Guardar', verb: 'guardar', finish: () => saveCharge() });
  const renderCargar = () => regWiz.render();

  let saving = false;
  function saveCharge() {
    const now = new Date(), c = rCalc(now);
    if (!c || c.error || saving) { if (c && c.error) $('#fn-cargar .wctx').textContent = c.error; return; }
    const err = odoCheck(R);
    if (err) { $('#fn-cargar .wctx').textContent = err; return; }
    saving = true; setTimeout(() => (saving = false), 800); // un doble toque no guarda dos veces
    const base = { id: Date.now(), kwh: c.kwh, odometerKm: R.odo, startPct: R.by === 'pct' ? R.from : null, endPct: R.by === 'pct' ? R.to : null, pricePerKwh: null, fixedFee: null, network: null, endAt: null };
    const ch = R.kind === 'home'
      ? { ...base, location: 'home', startAt: c.w.start.toISOString(), endAt: c.r.finishedAt.toISOString(), cost: c.cost, valleKwh: c.r.valleKwh, llanoKwh: c.r.llanoKwh, puntaKwh: c.r.puntaKwh }
      : { ...base, location: 'public', startAt: c.at.toISOString(), pricePerKwh: c.price, fixedFee: c.fee, network: (rVariant() || {}).empresa || R.net || 'Otro', cost: c.cost, valleKwh: 0, llanoKwh: 0, puntaKwh: 0 };
    S.charges.push(ch); persist();
    while (stack.length) closeFn();
    renderAll();
    flash(`Carga guardada · ${money(ch.cost)}`);
  }

