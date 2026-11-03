  /* ================= Programar carga: asistente paso a paso ================= */
  const GAP = 0.5; // % mínimo entre el inicio y el objetivo
  const wrap = (n) => ((n % 1440) + 1440) % 1440;
  const mm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
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
  const fmtDur = (mins) => { mins = Math.max(0, Math.round(mins)); const h = Math.floor(mins / 60), m = mins % 60; return h ? `${h} h ${m} min` : `${m} min`; };

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
      config, sync, apply,
      setEnabled(on) { tray.classList.toggle('off', !on); nbs.forEach((b) => (b.disabled = !on)); ruler.tabIndex = on ? 0 : -1; },
      setHint(t) { hint.textContent = t; },
    };
  }

  /* ----- Estado del asistente ----- */
  const W = { step: 0, from: 20, stopMin: 7 * 60, goal: null, later: false, startMin: 23 * 60, odo: null };
  const STEPS = [
    { id: 'from', q: '¿Con cuánta batería enchufás?' },
    { id: 'stop', q: '¿A qué hora cortás?' },
    { id: 'goal', q: '¿Hasta cuánta batería querés llegar?', optional: true },
    { id: 'start', q: '¿Cuándo empieza?' },
    { id: 'odo', q: '¿Cuál es el odómetro?', optional: true },
    { id: 'sum', q: 'Todo listo' },
  ];
  const lastOdo = () => { const c = S.charges.filter((x) => x.odometerKm != null).sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0]; return c ? c.odometerKm : null; };
  const setPct = (v) => r1(Math.max(0, Math.min(99.5, v)));

  /** Cómo se ve cada pregunta en el dial: qué valor edita, con qué pasos y cómo se muestra. */
  function stepCfg(id) {
    const pct = { kind: 'num', min: 0, max: 100, step: 0.1, ppv: 80, major: 1, every: 10, tick: String, nudges: [[-1, '−1', 'Restar 1'], [-0.1, '−0,1', 'Restar 0,1'], [0.1, '+0,1', 'Sumar 0,1'], [1, '+1', 'Sumar 1']] };
    const clock = { kind: 'time', min: 0, max: 1435, step: 5, ppv: 80 / 60, major: 60, every: 120, tick: (n) => String(n / 60).padStart(2, '0'), nudges: [[-60, '−1 h', 'Una hora antes'], [-15, '−15', '15 minutos antes'], [15, '+15', '15 minutos después'], [60, '+1 h', 'Una hora después']] };
    if (id === 'from') return { ...pct, aria: 'Batería al enchufar', get: () => W.from, set: (v) => { W.from = setPct(v); }, seed: W.from, label: () => pctTxt(W.from) };
    if (id === 'goal') return { ...pct, aria: 'Objetivo de batería', get: () => W.goal, set: (v) => { W.goal = r1(Math.max(W.from + GAP, Math.min(100, v))); }, seed: Math.max(80, W.from + GAP), label: () => (W.goal == null ? 'Omitir' : pctTxt(W.goal)) };
    if (id === 'stop') return { ...clock, aria: 'Hora de corte', get: () => W.stopMin, set: (v) => { W.stopMin = wrap(v); }, seed: W.stopMin, label: () => mm(W.stopMin) };
    if (id === 'start') return { ...clock, aria: 'Hora de inicio', get: () => W.startMin, set: (v) => { W.startMin = wrap(v); }, seed: W.startMin, label: () => (W.later ? mm(W.startMin) : 'Ahora') };
    if (id === 'odo') return { kind: 'num', noRuler: true, aria: 'Odómetro', get: () => W.odo, set: (v) => { W.odo = Math.max(0, Math.round(v)); }, seed: lastOdo() || 0, label: () => (W.odo == null ? 'Omitir' : int(W.odo)), nudges: [[-10, '−10'], [-1, '−1'], [1, '+1'], [10, '+10']] };
    return null;
  }

  const dial = makeDial($('#wTray'), () => wizNext());

  /** Valores de partida: % de inicio típico del historial; si hay una carga programada, sus datos. */
  function initProg() {
    const starts = S.charges.filter((c) => c.startPct != null).map((c) => c.startPct);
    Object.assign(W, { step: 0, from: starts.length ? r1(starts.reduce((a, b) => a + b, 0) / starts.length) : 20, stopMin: 7 * 60, goal: null, later: false, startMin: 23 * 60, odo: null });
    const a = S.active;
    if (a) {
      const st = new Date(a.startAt), sp = new Date(a.stopAt);
      Object.assign(W, { from: a.startPct, later: a.mode === 'scheduled', startMin: st.getHours() * 60 + st.getMinutes(), stopMin: sp.getHours() * 60 + sp.getMinutes(), goal: a.goal, odo: a.odo });
    }
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

  /** Autonomía con el odómetro (opcional): suma el tramo desde la última carga al consumo real. */
  function autoLine(now, endPct, kwh) {
    const B = S.vehicle.batteryKwh, has = W.odo != null;
    const prev = S.charges.filter((c) => c.odometerKm != null).sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0];
    let list = S.charges, seg = '';
    if (has) {
      if (prev && W.odo <= prev.odometerKm) seg = `El odómetro tiene que ser mayor al de tu última carga (${int(prev.odometerKm)} km).`;
      else {
        list = [...S.charges, { location: 'home', startAt: now.toISOString(), odometerKm: W.odo, kwh, startPct: W.from, endPct }];
        const km = prev ? W.odo - prev.odometerKm : 0, used = prev && prev.endPct != null ? ((prev.endPct - W.from) / 100) * B : 0;
        if (prev && km >= 10 && used > 0) seg = ` Desde tu última carga: ${dec((used / km) * 100, 1)} kWh/100 km en ${int(km)} km.`;
      }
    }
    const rc = L.rangeConsumption(S.vehicle, L.realConsumption(list, B));
    return { km: L.rangeAtPct(B, rc.whKm, endPct), text: seg };
  }

  /* ----- Pantalla del asistente ----- */
  const wInput = $('#wInput'), wValue = $('#wValue');
  const cur = () => STEPS[W.step];

  function wizRender() {
    const st = cur(), c = stepCfg(st.id);
    $('#wQ').textContent = st.q;
    $('#wDots').innerHTML = STEPS.map((_, i) => `<i class="${i < W.step ? 'done' : i === W.step ? 'on' : ''}"></i>`).join('');
    $('#wDots').setAttribute('aria-label', `Paso ${W.step + 1} de ${STEPS.length}`);
    $('#wSkip').hidden = !st.optional;
    wInput.hidden = true; wValue.hidden = !c;
    $('#wExtra').innerHTML = '';
    if (st.id === 'start') {
      $('#wExtra').innerHTML = `<div class="seg wide" role="group" aria-label="Cuándo empieza" id="wSeg"><button data-later="0" aria-pressed="${!W.later}">Ahora</button><button data-later="1" aria-pressed="${W.later}">Más tarde</button></div>`;
    }
    if (c) {
      c.onChange = wizUpdate;
      dial.config(c, 'Tocá el centro para continuar');
      dial.setEnabled(st.id !== 'start' || W.later);
    } else {
      dial.config({ kind: 'num', noRuler: true, max: 0, step: 1, ppv: 1, major: 1, every: 1, tick: String, nudges: [[0, ''], [0, ''], [0, ''], [0, '']], get: () => 0, seed: 0, set() {}, label: () => 'Programar', onChange() {} }, 'Tocá el centro para programar');
      dial.setEnabled(false);
    }
    wizUpdate();
  }

  /** Actualiza número grande, línea de contexto y barra de franjas según el paso y los valores. */
  function wizUpdate() {
    const st = cur(), now = new Date(), B = S.vehicle.batteryKwh, ctx = $('#wCtx');
    $('#wBands').innerHTML = '';
    const set = (num, unit = '') => { $('#wNum').textContent = num; $('#wUnit').textContent = unit; };
    if (st.id === 'from') {
      const rc = L.rangeConsumption(S.vehicle, L.realConsumption(S.charges, B));
      set(pctTxt(W.from), '%'); ctx.textContent = `≈ ${L.rangeAtPct(B, rc.whKm, W.from)} km de autonomía ahora`;
    } else if (st.id === 'stop') {
      const p = planCalc(now, false);
      set(mm(W.stopMin));
      ctx.textContent = p.cost ? `Si empezás ahora llegás a ≈ ${pctTxt(p.est.pct)}% · ${kwhTxt(p.est.kwhDelivered)} kWh · ${money(p.cost.total)}` : '';
    } else if (st.id === 'goal') {
      set(W.goal == null ? '—' : pctTxt(W.goal), W.goal == null ? '' : '%');
      ctx.textContent = W.goal == null ? 'Opcional: con un objetivo te digo a qué hora empezar.' : `${kwhTxt(L.kwhFromPct(W.from, W.goal, B) || 0)} kWh a cargar`;
    } else if (st.id === 'start') {
      const p = planCalc(now, W.later), s = bestStart(now);
      set(W.later ? mm(W.startMin) : 'Ahora');
      ctx.textContent = p.cost ? `≈ ${pctTxt(p.est.pct)}% a las ${mm(W.stopMin)} · ${kwhTxt(p.est.kwhDelivered)} kWh · ${money(p.cost.total)}` : '';
      if (p.cost) $('#wBands').innerHTML = bands(p.cost.valleKwh, p.cost.llanoKwh, p.cost.puntaKwh);
      if (s && s.start > now) {
        const m = s.start.getHours() * 60 + s.start.getMinutes();
        $('#wExtra').querySelector('.sug')?.remove();
        $('#wExtra').insertAdjacentHTML('beforeend', `<p class="note sug">Para llegar a ${pctTxt(W.goal)}%, lo mejor es empezar a las ${mm(m)} (${Math.round(s.valleShare * 100)}% en Valle, ${money(s.best.total)}).${W.later && W.startMin === m ? '' : ` <button class="link inl-link" id="useSug" data-m="${m}">Usar esa hora</button>`}</p>`);
      }
    } else if (st.id === 'odo') {
      const p = planCalc(now, W.later), a = autoLine(now, W.goal ?? p.est.pct, p.est.kwhDelivered);
      set(W.odo == null ? '—' : int(W.odo), W.odo == null ? '' : 'km');
      ctx.textContent = W.odo == null ? 'Opcional: con el odómetro se afina tu consumo real y la autonomía.' : `Autonomía al terminar ≈ ${a.km} km. ${a.text}`;
    } else {
      wizSummary(now);
    }
    // el círculo central muestra el valor (o "Omitir" si el dato es opcional y está vacío)
    const c = stepCfg(st.id); if (c) dial.sync(false);
  }

  function wizSummary(now) {
    const p = planCalc(now, W.later), B = S.vehicle.batteryKwh, end = W.goal ?? p.est.pct, a = autoLine(now, end, p.est.kwhDelivered);
    $('#wNum').textContent = ''; $('#wUnit').textContent = '';
    $('#wCtx').textContent = '';
    const row = (l, v, em = '') => `<div class="kv"><span>${l}${em ? `<em>${em}</em>` : ''}</span><b>${v}</b></div>`;
    $('#wExtra').innerHTML = row('Empieza', W.later ? `${hhmm(p.start)}` : 'Ahora', W.later ? '' : 'en cuanto confirmes')
      + row('Corta', hhmm(p.stop)) + row('Batería', `${pctTxt(W.from)}% → ≈ ${pctTxt(p.est.pct)}%`, W.goal != null ? `objetivo ${pctTxt(W.goal)}%` : '')
      + row('Energía', `${kwhTxt(p.est.kwhDelivered)} kWh`) + (p.cost ? row('Costo estimado', money(p.cost.total), `${Math.round((p.cost.valleKwh / p.est.kwhDelivered) * 100)}% en Valle`) : '')
      + row('Autonomía', `≈ ${a.km} km`, W.odo != null ? `odómetro ${int(W.odo)} km` : '');
  }

  /* ----- Navegación ----- */
  function wizNext() {
    if (cur().id === 'sum') { scheduleCharge(); return; }
    if (cur().id === 'odo' && W.odo != null) { // un odómetro menor al anterior no sirve
      const prev = lastOdo();
      if (prev != null && W.odo <= prev) { $('#wCtx').textContent = `Tiene que ser mayor al de tu última carga (${int(prev)} km).`; return; }
    }
    advance();
  }
  /** Pasa al paso siguiente. Al entrar a "Cuándo empieza" con un objetivo, propone la hora sugerida (todo en Valle). */
  function advance() {
    W.step++;
    if (cur().id === 'start') {
      const s = bestStart(new Date());
      if (s && s.start > new Date()) { W.later = true; W.startMin = s.start.getHours() * 60 + s.start.getMinutes(); }
    }
    wizRender();
  }
  $('#wBack').addEventListener('click', () => { if (W.step > 0) { W.step--; wizRender(); } else closeFn(); });
  $('#wSkip').addEventListener('click', () => { if (cur().id === 'goal') W.goal = null; if (cur().id === 'odo') W.odo = null; advance(); });
  $('#wExtra').addEventListener('click', (e) => {
    const s = e.target.closest('[data-later]'), u = e.target.closest('#useSug');
    if (s) { W.later = s.dataset.later === '1'; document.querySelectorAll('#wSeg button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.later === '1') === W.later)); dial.setEnabled(W.later); dial.sync(true); wizUpdate(); }
    else if (u) { W.later = true; W.startMin = Number(u.dataset.m); document.querySelectorAll('#wSeg button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.later === '1') === W.later)); dial.setEnabled(true); dial.sync(true); wizUpdate(); }
  });

  /* Tocar el número grande abre el teclado para escribir el valor exacto. */
  wValue.addEventListener('click', () => {
    const st = cur(), c = stepCfg(st.id); if (!c) return;
    wInput.inputMode = c.kind === 'time' ? 'numeric' : 'decimal';
    wInput.placeholder = c.kind === 'time' ? 'HH:MM' : '';
    wInput.value = c.get() == null ? '' : c.kind === 'time' ? mm(c.get()) : c.noRuler ? String(c.get()) : kwhTxt(c.get()).replace(',0', '');
    wValue.hidden = true; wInput.hidden = false; wInput.focus(); wInput.select();
  });
  function wizCommit() {
    if (wInput.hidden) return;
    const c = stepCfg(cur().id), raw = wInput.value;
    wInput.hidden = true; wValue.hidden = false;
    if (!c) return;
    const v = c.kind === 'time' ? parseClock(raw) : num(raw);
    if (v != null && isFinite(v)) { if (cur().id === 'start') W.later = true; c.set(v); dial.sync(true); }
    if (cur().id === 'start') { document.querySelectorAll('#wSeg button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.later === '1') === W.later)); dial.setEnabled(true); }
    wizUpdate();
  }
  wInput.addEventListener('blur', wizCommit);
  wInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') wInput.blur(); });

  function renderProg() { wizRender(); }

  /** Crea la carga activa: "Ahora" arranca a contar ya; "Más tarde" queda en espera hasta la hora de inicio. */
  function scheduleCharge() {
    const now = new Date();
    if (!isFinite(W.from) || !(nominalKw() > 0)) { $('#wCtx').textContent = 'Configurá tu cargador en Autonomía.'; return; }
    const start = W.later ? nextAt(W.startMin, now, now) : now, stop = nextAt(W.stopMin, start, start);
    S.active = { mode: W.later ? 'scheduled' : 'live', startAt: start.toISOString(), stopAt: stop.toISOString(), startPct: W.from, goal: W.goal, odo: W.odo };
    confirmAt = null; confirmShown = false; persist();
    closeFn(); renderStatus(); tick();
    flash(W.later ? `Programada · empieza a las ${hhmm(start)}` : `Cargando desde ${pctTxt(W.from)}%`);
  }

