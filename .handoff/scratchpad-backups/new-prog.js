  /* ================= Programar carga y carga en curso ================= */
  const GAP = 0.5; // % mínimo entre el inicio y el objetivo
  const P = { later: false, startMin: 23 * 60, stopMin: 7 * 60, from: 20, goal: '', odo: '' };
  const wrap = (n) => ((n % 1440) + 1440) % 1440;
  const mm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return isFinite(h) && isFinite(m) ? h * 60 + m : null; };
  /** Próxima vez que el reloj marca `min`, siempre posterior a `after` (mismo criterio que el repo original). */
  function nextAt(min, base, after) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, min);
    if (d <= after) d.setDate(d.getDate() + 1);
    return d;
  }
  const fmtDur = (mins) => { mins = Math.max(0, Math.round(mins)); const h = Math.floor(mins / 60), m = mins % 60; return h ? `${h} h ${m} min` : `${m} min`; };

  /** Valores de partida: % de inicio típico del historial; si hay una carga programada, sus datos. */
  function initProg() {
    const starts = S.charges.filter((c) => c.startPct != null).map((c) => c.startPct);
    P.from = starts.length ? r1(starts.reduce((a, b) => a + b, 0) / starts.length) : 20;
    P.later = false; P.startMin = 23 * 60; P.stopMin = 7 * 60; P.goal = ''; P.odo = '';
    const a = S.active;
    if (a) {
      const st = new Date(a.startAt), sp = new Date(a.stopAt);
      P.from = a.startPct; P.later = a.mode === 'scheduled';
      P.startMin = st.getHours() * 60 + st.getMinutes(); P.stopMin = sp.getHours() * 60 + sp.getMinutes();
      P.goal = a.goal != null ? String(a.goal).replace('.', ',') : ''; P.odo = a.odo != null ? String(a.odo) : '';
    }
    $('#p-goal').value = P.goal; $('#p-odo').value = P.odo;
  }
  const setFrom = (v) => { P.from = r1(Math.max(0, Math.min(99.5, v))); };

  $('#startSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-later]'); if (b) { P.later = b.dataset.later === '1'; renderProg(); } });
  document.querySelectorAll('[data-s]').forEach((b) => holdRepeat(b, (mult) => { setFrom(P.from + Number(b.dataset.d) * mult); renderProg(); }));
  document.querySelectorAll('[data-t]').forEach((b) => holdRepeat(b, () => { const k = b.dataset.t === 'start' ? 'startMin' : 'stopMin'; P[k] = wrap(P[k] + Number(b.dataset.d)); renderProg(); }));
  [['p-start', 'startMin'], ['p-stop', 'stopMin']].forEach(([id, k]) => $('#' + id).addEventListener('change', (e) => { const v = toMin(e.target.value); if (v != null) P[k] = v; renderProg(); }));
  $('#o-from').addEventListener('focus', (e) => e.target.select());
  $('#o-from').addEventListener('change', (e) => { const v = num(e.target.value); if (isFinite(v)) setFrom(v); renderProg(); });
  $('#o-from').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
  $('#p-goal').addEventListener('input', (e) => { P.goal = e.target.value.trim(); renderProg(); });
  $('#p-odo').addEventListener('input', (e) => { P.odo = e.target.value.trim(); renderProg(); });

  /** Plan con los datos del formulario: inicio, corte, % y energía estimados, y costo por franja. */
  function planCalc(now) {
    const B = S.vehicle.batteryKwh, kw = nominalKw(), calib = calibration().factor;
    const start = P.later ? nextAt(P.startMin, now, now) : now;
    const stop = nextAt(P.stopMin, start, start);
    const est = L.estimateAtTime(P.from, start, stop, kw, B, calib);
    const cost = est.kwhDelivered > 0.01
      ? L.computeHomeChargeCost(start, stop, est.kwhDelivered, S.rates, S.puntaStart, { nominalKw: kw, calibration: calib, startPct: P.from, batteryKwh: B }) : null;
    return { B, kw, calib, start, stop, est, cost };
  }

  function renderProg() {
    $('#o-from').value = pctTxt(P.from) + '%';
    $('#p-start').value = mm(P.startMin); $('#p-stop').value = mm(P.stopMin);
    document.querySelectorAll('#startSeg button').forEach((b) => b.setAttribute('aria-pressed', (b.dataset.later === '1') === P.later));
    $('#startRow').hidden = !P.later;
    const now = new Date(), p = planCalc(now), out = $('#pAlt');
    if (!(p.kw > 0)) { $('#pStart').textContent = '—'; $('#pSub').textContent = 'Configurá tu cargador en Autonomía.'; $('#pFind').textContent = ''; out.innerHTML = ''; $('#pAuto').innerHTML = ''; return; }
    $('#pStart').textContent = P.later ? mm(P.startMin) : 'Ahora';
    $('#pStart').style.fontSize = P.later ? '' : 'min(60px, 15vw)';
    $('#pSub').textContent = `corta a las ${mm(P.stopMin)} · ≈ ${pctTxt(p.est.pct)}% · ${kwhTxt(p.est.kwhDelivered)} kWh`;
    $('#pFind').textContent = p.cost ? `${money(p.cost.total)} · ${Math.round((p.cost.valleKwh / p.est.kwhDelivered) * 100)}% en Valle` : '';
    let h = p.cost ? bands(p.cost.valleKwh, p.cost.llanoKwh, p.cost.puntaKwh) : '';
    const goal = num(P.goal);
    if (P.goal !== '' && isFinite(goal) && goal > P.from + GAP && goal <= 100) {
      const deadline = nextAt(P.stopMin, now, now);
      const s = L.suggestStart({ fromPct: P.from, toPct: goal, deadline, nominalKw: p.kw, batteryKwh: p.B, calibration: p.calib, rates: S.rates, puntaStart: S.puntaStart, altStart: now });
      if (s) {
        const late = s.start < now;
        h += `<h3>Para llegar a ${pctTxt(goal)}%</h3>`;
        h += late
          ? `<div class="kv"><span>No alcanza el tiempo<em>necesitás ${fmtDur(s.minutes)}; empezando ahora llegás a ${pctTxt(p.est.pct)}%</em></span></div>`
          : `<div class="kv"><span>Empezá a las ${hhmm(s.start)}<em>${fmtDur(s.minutes)} · ${Math.round(s.valleShare * 100)}% en Valle</em></span><b>${money(s.best.total)}</b></div><button class="link" id="useSug" data-start="${s.start.getHours() * 60 + s.start.getMinutes()}">Usar esa hora</button>`;
        if (s.alt && !late && s.alt.total > s.best.total + 0.5) h += `<p class="note">Empezando ahora costaría ${money(s.alt.total)}: ahorrás ${money(s.alt.total - s.best.total)}.</p>`;
      }
    }
    h += `<p class="note">Potencia estimada ${dec(p.kw, 1)} kW (${S.amps} A × ${S.volts} V, rendimiento 92%)${calibration().samples ? `, calibrada con ${calibration().samples} cargas` : ''}. Pasado el 80% la carga se hace más lenta.</p>`;
    out.innerHTML = h;
    $('#pAuto').innerHTML = progAuto(now, goal > P.from ? goal : p.est.pct, p.est.kwhDelivered);
  }
  $('#pAlt').addEventListener('click', (e) => { const b = e.target.closest('#useSug'); if (b) { P.later = true; P.startMin = +b.dataset.start; renderProg(); } });

  /**
   * Autonomía de esta carga. Con el odómetro (opcional) se suma el tramo desde la última carga al
   * consumo real: (fin % anterior − inicio % actual) × batería, sobre los km recorridos.
   */
  function progAuto(now, endPct, kwh) {
    const B = S.vehicle.batteryKwh, odo = num(P.odo), has = P.odo !== '' && isFinite(odo);
    const prev = S.charges.filter((c) => c.odometerKm != null).sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0];
    let list = S.charges, seg = '';
    if (has) {
      if (prev && odo <= prev.odometerKm) seg = `<p class="note">Tiene que ser mayor al de tu última carga (${int(prev.odometerKm)} km).</p>`;
      else {
        list = [...S.charges, { location: 'home', startAt: now.toISOString(), odometerKm: odo, kwh, startPct: P.from, endPct }];
        if (prev) {
          const km = odo - prev.odometerKm, used = prev.endPct != null ? ((prev.endPct - P.from) / 100) * B : 0;
          if (km < 10) seg = '<p class="note">Menos de 10 km desde la última carga: todavía no suma al consumo.</p>';
          else if (used > 0) seg = `<div class="kv"><span>Desde tu última carga<em>${int(km)} km · ${pctTxt(prev.endPct)}% → ${pctTxt(P.from)}%</em></span><b>${dec((used / km) * 100, 1)} kWh/100 km</b></div>`;
        }
      }
    }
    const rc = L.rangeConsumption(S.vehicle, L.realConsumption(list, B));
    let h = `<h3>Autonomía</h3><div class="kv"><span>Terminás con<em>${dec(L.whKmToKwh100(rc.whKm), 1)} kWh/100 km${has ? ' · con tu odómetro' : ''}</em></span><b>≈ ${L.rangeAtPct(B, rc.whKm, endPct)} km</b></div>` + seg;
    if (!has) h += '<p class="note">Con el odómetro de esta carga se afina tu consumo real y la autonomía.</p>';
    return h;
  }

  /** Crea la carga activa: "Ahora" arranca a contar ya; "Más tarde" queda en espera hasta la hora de inicio. */
  function scheduleCharge() {
    const now = new Date();
    if (!isFinite(P.from) || !(nominalKw() > 0)) return;
    const start = P.later ? nextAt(P.startMin, now, now) : now, stop = nextAt(P.stopMin, start, start);
    const goal = num(P.goal), odo = num(P.odo);
    S.active = { mode: P.later ? 'scheduled' : 'live', startAt: start.toISOString(), stopAt: stop.toISOString(), startPct: P.from, goal: P.goal !== '' && isFinite(goal) ? goal : null, odo: P.odo !== '' && isFinite(odo) ? odo : null };
    confirmAt = null; confirmShown = false; persist();
    closeFn(); renderStatus(); tick();
    flash(P.later ? `Programada · empieza a las ${hhmm(start)}` : `Cargando desde ${pctTxt(P.from)}%`);
  }
  $('#pGo').addEventListener('click', scheduleCharge);

  /* ----- Carga en curso: en espera, cargando, a confirmar ----- */
  let confirmAt = null, confirmShown = false, confirmEnd = null;
  function activeInfo(now) {
    const a = S.active, B = S.vehicle.batteryKwh, kw = nominalKw(), calib = calibration().factor;
    const start = new Date(a.startAt), stop = new Date(a.stopAt);
    const st = confirmAt ? 'ended' : now < start ? 'waiting' : now < stop ? 'charging' : 'ended';
    const est = (to) => L.estimateAtTime(a.startPct, start, to, kw, B, calib);
    const cost = (kwh, to) => (kwh > 0.01 && to > start ? L.computeHomeChargeCost(start, to, kwh, S.rates, S.puntaStart, { nominalKw: kw, calibration: calib, startPct: a.startPct, batteryKwh: B }) : null);
    return { a, st, start, stop, B, kw, calib, est, cost };
  }

  function renderStatus() {
    const bar = $('#activeBar'), a = S.active;
    if (!a) { bar.hidden = true; return; }
    const now = new Date(), I = activeInfo(now);
    bar.hidden = false; bar.classList.toggle('live', I.st === 'charging');
    if (I.st === 'waiting') bar.textContent = `Programada · arranca en ${fmtDur((I.start - now) / 60000)}`;
    else if (I.st === 'charging') bar.textContent = `Cargando · ≈ ${pctTxt(I.est(now).pct)}% · corta ${hhmm(I.stop)}`;
    else bar.textContent = 'Terminó · confirmá tu carga';
  }
  $('#activeBar').addEventListener('click', () => openFn('activa'));

  function renderActiva() {
    const box = $('#activa'), a = S.active;
    if (!a) { box.innerHTML = '<p class="note">No hay ninguna carga programada.</p>'; confirmShown = false; return; }
    const now = new Date(), I = activeInfo(now);
    if (I.st === 'ended') { if (!confirmShown) { renderConfirm(I); confirmShown = true; } return; }
    confirmShown = false;
    if (I.st === 'waiting') {
      const eStop = I.est(I.stop), c = I.cost(eStop.kwhDelivered, I.stop);
      box.innerHTML = `<div class="hero2"><p class="big" style="font-size:min(56px,14vw)">${fmtDur((I.start - now) / 60000)}</p><p class="sub">arranca a las ${hhmm(I.start)} · corta a las ${hhmm(I.stop)}</p><p class="find">Desde ${pctTxt(a.startPct)}%. Al corte ≈ ${pctTxt(eStop.pct)}% (${kwhTxt(eStop.kwhDelivered)} kWh).</p></div>`
        + (c ? `<div class="kv"><span>Costo estimado</span><b>${money(c.total)}</b></div>${bands(c.valleKwh, c.llanoKwh, c.puntaKwh)}` : '')
        + `<button class="pill" id="aNow">Empezar ahora</button><button class="link" id="aEdit">Cambiar horarios</button><button class="link" id="aCancel">Cancelar programación</button>`;
    } else {
      const e = I.est(now), eStop = I.est(I.stop), c = I.cost(e.kwhDelivered, now);
      box.innerHTML = `<div class="hero2"><p class="big">≈ ${pctTxt(e.pct)}<small>%</small></p><p class="sub">${kwhTxt(e.kwhDelivered)} kWh hasta ahora · corta a las ${hhmm(I.stop)}</p><p class="find">Al corte ≈ ${pctTxt(eStop.pct)}% (${kwhTxt(eStop.kwhDelivered)} kWh). Desde ${pctTxt(a.startPct)}% a las ${hhmm(I.start)}.</p></div>`
        + (c ? `<div class="kv"><span>Costo hasta ahora</span><b>${money(c.total)}</b></div>` : '')
        + `<button class="pill" id="aFinish">Terminar ahora</button><button class="link" id="aCancel">Cancelar carga</button>`;
    }
  }

  /** La carga se guarda recién acá, con lo real: % final, kWh (se recalculan del %) y odómetro. */
  function renderConfirm(I) {
    confirmEnd = confirmAt || I.stop;
    const e = I.est(confirmEnd), odo = I.a.odo != null ? I.a.odo : '';
    $('#activa').innerHTML = `<div class="hero2"><p class="sub">Terminó la carga</p><p class="find">Estimado ≈ ${pctTxt(e.pct)}% · ${kwhTxt(e.kwhDelivered)} kWh. Confirmá lo real.</p></div>`
      + field('c-pct', '% final real', `<input id="c-pct" inputmode="decimal" autocomplete="off" value="${pctTxt(e.pct)}">`)
      + field('c-kwh', 'kWh reales', `<input id="c-kwh" inputmode="decimal" autocomplete="off" value="${kwhTxt(e.kwhDelivered)}">`, 'Se calcula del % (batería × diferencia). Cambialo si el cargador marcó otro valor.')
      + field('c-odo', 'Odómetro (km, opcional)', `<input id="c-odo" inputmode="decimal" autocomplete="off" value="${odo}">`)
      + `<p class="note" id="c-err" style="color:var(--warn)"></p><button class="pill" id="cSave">Guardar carga</button><button class="link" id="cDiscard">Descartar</button>`;
  }

  $('#activa').addEventListener('input', (e) => {
    if (e.target.id !== 'c-pct' || !S.active) return;
    const v = num(e.target.value);
    if (isFinite(v)) $('#c-kwh').value = kwhTxt(Math.max(0, r2(((v - S.active.startPct) / 100) * S.vehicle.batteryKwh)));
  });
  $('#activa').addEventListener('click', (e) => {
    const id = e.target.id, a = S.active;
    if (!a) return;
    if (id === 'aNow') { a.startAt = new Date().toISOString(); a.mode = 'live'; persist(); renderActiva(); renderStatus(); }
    else if (id === 'aEdit') { closeFn(); openFn('prog'); }
    else if (id === 'aCancel') { if (confirm('¿Cancelar esta carga?')) { S.active = null; persist(); renderStatus(); closeFn(); } }
    else if (id === 'aFinish') { confirmAt = new Date(); confirmShown = false; renderActiva(); renderStatus(); }
    else if (id === 'cDiscard') { if (confirm('¿Descartar esta carga sin guardarla?')) { S.active = null; confirmAt = null; confirmShown = false; persist(); renderStatus(); closeFn(); } }
    else if (id === 'cSave') saveActive();
  });

  function saveActive() {
    const a = S.active, err = $('#c-err'), pct = num($('#c-pct').value), kwh = num($('#c-kwh').value), odoRaw = $('#c-odo').value.trim(), odo = num(odoRaw);
    if (!isFinite(pct) || pct < 0 || pct > 100) { err.textContent = 'Ingresá un % final válido (0 a 100).'; return; }
    if (!isFinite(kwh) || kwh <= 0) { err.textContent = 'Los kWh reales tienen que ser mayores a cero.'; return; }
    try {
      const start = new Date(a.startAt);
      const r = L.computeHomeChargeCost(start, confirmEnd, r2(kwh), S.rates, S.puntaStart, { nominalKw: nominalKw(), calibration: calibration().factor, startPct: a.startPct, batteryKwh: S.vehicle.batteryKwh });
      S.charges.push({ id: Date.now(), location: 'home', startAt: start.toISOString(), endAt: r.finishedAt.toISOString(), kwh: r2(kwh), odometerKm: odoRaw !== '' && isFinite(odo) ? odo : null, startPct: a.startPct, endPct: r1(pct), pricePerKwh: null, fixedFee: null, network: null, cost: r.total, valleKwh: r.valleKwh, llanoKwh: r.llanoKwh, puntaKwh: r.puntaKwh });
      S.active = null; confirmAt = null; confirmShown = false; persist();
      while (stack.length) closeFn();
      renderAll(); renderStatus();
      flash(`Carga guardada · ${money(r.total)}`);
    } catch (e) { err.textContent = e.message; }
  }

  function tick() {
    renderStatus();
    if (S.active && stack[stack.length - 1] === 'activa') renderActiva();
  }
  setInterval(tick, 1000);

