/*
 * Lógica de cargas de un auto eléctrico en Uruguay.
 * Módulo puro (sin DOM): funciona en el navegador (window.CargaLogic) y en Node (require).
 *
 * Portado y ampliado desde el repo francofuy/carga-ev (tarifa.ts, estimation.ts, consumption.ts,
 * network-prices.ts, db/charges.ts). Lo que cambia respecto del original está marcado con [MEJORA].
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CargaLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================= Tarifa UTE Residencial Triple Horaria ================= */

  /** Pliego tarifario UTE 2026, $/kWh (decreto MIEM 113/2026). */
  const UTE_2026_RATES = { valle: 2.443, llano: 5.172, punta: 12.034 };
  const DEFAULT_PUNTA_START = 19; // 4 horas seguidas elegidas entre 17:00 y 23:00 → inicio 17, 18 o 19
  const PUNTA_START_OPTIONS = [17, 18, 19];

  /**
   * [MEJORA] Feriados nacionales fijos no laborables (mm-dd). UTE trata feriados como fin de semana
   * (sin franja Punta); el repo original no tenía calendario. No incluye los móviles (Carnaval,
   * Semana de Turismo): conviene verificarlos con UTE.
   */
  const FIXED_HOLIDAYS = ['01-01', '05-01', '07-18', '08-25', '12-25'];
  const pad2 = (n) => String(n).padStart(2, '0');
  const isHoliday = (d) => FIXED_HOLIDAYS.includes(pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()));

  /** Valle 00–07 todos los días; Punta 4 h elegidas, solo días hábiles; Llano el resto. */
  function classifyHour(date, puntaStart) {
    const hour = date.getHours();
    const dow = date.getDay();
    const nonWorking = dow === 0 || dow === 6 || isHoliday(date);
    if (hour < 7) return 'valle';
    if (!nonWorking && hour >= puntaStart && hour < puntaStart + 4) return 'punta';
    return 'llano';
  }

  /* ================= Física de la carga (kW, % de batería) ================= */

  const ETA_AC = 0.92;
  const CC_CV_THRESHOLD_PCT = 80;
  const CV_TAPER_END_FACTOR = 0.25;

  const chargerKw = (amps, volts, eta = ETA_AC) => (volts * amps * eta) / 1000;

  function taperFactor(pct) {
    if (pct < CC_CV_THRESHOLD_PCT) return 1;
    const progress = Math.min(1, (pct - CC_CV_THRESHOLD_PCT) / (100 - CC_CV_THRESHOLD_PCT));
    return 1 - progress * (1 - CV_TAPER_END_FACTOR);
  }

  /** % y kWh entregados entre startAt y targetTime, integrando minuto a minuto. */
  function estimateAtTime(startPct, startAt, targetTime, nominalKw, batteryKwh, calibration = 1) {
    const totalMinutes = Math.max(0, Math.round((targetTime - startAt) / 60000));
    const maxKwh = batteryKwh - (batteryKwh * startPct) / 100;
    const perMinute = (nominalKw * calibration) / 60;
    let pct = startPct, delivered = 0;
    for (let m = 0; m < totalMinutes; m++) {
      if (pct >= 100) break;
      delivered += perMinute * taperFactor(pct);
      pct = startPct + (delivered / batteryKwh) * 100;
    }
    return { pct: Math.min(100, pct), kwhDelivered: Math.min(delivered, maxKwh) };
  }

  /** [MEJORA] Minutos necesarios para entregar `kwh` desde startPct (con la cola CV). null si no se llega. */
  function minutesToDeliver(startPct, kwh, nominalKw, batteryKwh, calibration = 1) {
    const perMinute = (nominalKw * calibration) / 60;
    if (perMinute <= 0 || kwh <= 0) return null;
    let pct = startPct, delivered = 0;
    for (let m = 1; m <= 24 * 60; m++) {
      delivered += perMinute * taperFactor(pct);
      pct = startPct + (delivered / batteryKwh) * 100;
      if (delivered >= kwh - 1e-9 || pct >= 100) return m; // al llegar a 100% la batería no recibe más
    }
    return null;
  }

  /** Factor de calibración: kWh reales / kWh teóricos, promediado sobre cargas pasadas en Casa con % y horas. */
  function computeCalibration(pastHome, nominalKw, batteryKwh) {
    const ratios = [];
    for (const c of pastHome) {
      if (!c.startAt || !c.endAt || c.startPct == null || c.endPct == null) continue;
      const t = estimateAtTime(c.startPct, new Date(c.startAt), new Date(c.endAt), nominalKw, batteryKwh, 1);
      if (t.kwhDelivered > 0) ratios.push(c.kwh / t.kwhDelivered);
    }
    if (!ratios.length) return { factor: 1, samples: 0 };
    return { factor: ratios.reduce((a, b) => a + b, 0) / ratios.length, samples: ratios.length };
  }

  /* ================= Costo de una carga ================= */

  /**
   * Costo de una carga en Casa.
   * Sin `opts`: reparte los kWh parejo en toda la ventana (comportamiento del repo original).
   * [MEJORA] Con `opts.nominalKw`: la carga arranca al inicio a potencia nominal (con cola CV si hay
   * `startPct` y `batteryKwh`) y termina cuando entregó los kWh; el resto de la ventana es tiempo
   * enchufado sin consumo. Evita cobrar como "Valle" energía que nunca se entregó de madrugada.
   */
  function computeHomeChargeCost(startAt, endAt, kwh, rates, puntaStart, opts) {
    const totalMinutes = Math.round((endAt - startAt) / 60000);
    if (totalMinutes <= 0) throw new Error('La hora de fin debe ser posterior a la de inicio.');
    if (!(kwh > 0)) throw new Error('Los kWh cargados deben ser mayores a cero.');

    let weights; // kWh relativos por minuto activo
    let assumption = 'ventana';
    const kw = opts && opts.nominalKw > 0 ? opts.nominalKw * (opts.calibration || 1) : 0;
    if (kw > 0) {
      const perMinute = kw / 60;
      const hasPct = opts.startPct != null && opts.batteryKwh > 0;
      let pct = hasPct ? opts.startPct : 0, delivered = 0;
      weights = [];
      for (let m = 0; m < totalMinutes && delivered < kwh; m++) {
        const e = perMinute * (hasPct ? taperFactor(pct) : 1);
        weights.push(e);
        delivered += e;
        if (hasPct) pct = opts.startPct + (delivered / opts.batteryKwh) * 100;
      }
      assumption = hasPct ? 'potencia+cola' : 'potencia';
    } else {
      weights = new Array(totalMinutes).fill(1);
    }
    const sum = weights.reduce((a, b) => a + b, 0);
    const out = { valleKwh: 0, llanoKwh: 0, puntaKwh: 0 };
    for (let i = 0; i < weights.length; i++) {
      const band = classifyHour(new Date(startAt.getTime() + i * 60000), puntaStart);
      out[band + 'Kwh'] += (weights[i] / sum) * kwh;
    }
    const total = out.valleKwh * rates.valle + out.llanoKwh * rates.llano + out.puntaKwh * rates.punta;
    return { ...out, total, activeMinutes: weights.length, finishedAt: new Date(startAt.getTime() + weights.length * 60000), assumption };
  }

  function computePublicChargeCost(pricePerKwh, kwh, fixedFee = 0) {
    if (!(kwh > 0)) throw new Error('Los kWh cargados deben ser mayores a cero.');
    if (!(pricePerKwh > 0)) throw new Error('El precio por kWh debe ser mayor a cero.');
    if (fixedFee < 0) throw new Error('El cargo fijo no puede ser negativo.');
    return pricePerKwh * kwh + fixedFee;
  }

  /** kWh = batería × (hasta − desde) / 100. Devuelve null si el rango es inválido. */
  function kwhFromPct(fromPct, toPct, batteryKwh) {
    if (![fromPct, toPct, batteryKwh].every(Number.isFinite) || fromPct < 0 || toPct > 100 || toPct <= fromPct || !(batteryKwh > 0)) return null;
    return (batteryKwh * (toPct - fromPct)) / 100;
  }

  /** [MEJORA] Cuánto más gastaste por no cargar todo en Valle (a tarifas actuales). */
  const valleSavings = (c, rates) => (c.llanoKwh || 0) * (rates.llano - rates.valle) + (c.puntaKwh || 0) * (rates.punta - rates.valle);

  /**
   * [MEJORA] "¿Cuándo empiezo a cargar?": para terminar a `deadline` con todo (o casi todo) en Valle.
   * Devuelve el inicio recomendado, el costo así y el costo si empezás en `altStart` (por defecto, ahora).
   */
  function suggestStart({ fromPct, toPct, deadline, nominalKw, batteryKwh, calibration, rates, puntaStart, altStart }) {
    const kwh = kwhFromPct(fromPct, toPct, batteryKwh);
    if (kwh == null || !(nominalKw > 0)) return null;
    const minutes = minutesToDeliver(fromPct, kwh, nominalKw, batteryKwh, calibration);
    if (minutes == null) return null;
    const opts = { nominalKw, calibration, startPct: fromPct, batteryKwh };
    const start = new Date(deadline.getTime() - minutes * 60000);
    const best = computeHomeChargeCost(start, deadline, kwh, rates, puntaStart, opts);
    let alt = null;
    if (altStart && altStart < deadline) {
      const altEnd = new Date(altStart.getTime() + minutes * 60000);
      alt = computeHomeChargeCost(altStart, altEnd, kwh, rates, puntaStart, opts);
      alt.start = altStart;
    }
    return { kwh, minutes, start, best, alt, valleShare: best.valleKwh / kwh };
  }

  /* ================= Consumo y autonomía ================= */

  const whKmToKwh100 = (whKm) => whKm / 10;
  const autonomyKm = (batteryKwh, whKm) => (whKm > 0 ? Math.round(batteryKwh / (whKm / 1000)) : 0);
  /** Autonomía con la batería al `pct`%. */
  const rangeAtPct = (batteryKwh, whKm, pct) => autonomyKm((batteryKwh * pct) / 100, whKm);

  const MIN_SEGMENT_KM = 10;
  const sane = (whKm) => whKm >= 60 && whKm <= 600;

  const chargeTime = (c) => new Date(c.startAt || c.createdAt).getTime();

  /**
   * Consumo real "de carga a carga" con odómetro.
   * [MEJORA] 1) promedia ponderado por km (Σkwh/Σkm), no el promedio de cocientes de cada tramo, que
   * sobrepesa los tramos cortos; 2) descarta tramos de menos de 10 km o inconsistentes;
   * 3) si hay % de batería, mide también el consumo del lado de la batería (sin pérdidas de carga) con
   * (fin% de la carga anterior − inicio% de la siguiente) × batería: es el dato correcto para autonomía.
   */
  function realConsumption(charges, batteryKwh) {
    const rows = charges.filter((c) => c.odometerKm != null).sort((a, b) => chargeTime(a) - chargeTime(b));
    if (rows.length < 2) return null;
    let wallKwh = 0, wallKm = 0, n = 0, batKwh = 0, batKm = 0, nb = 0;
    for (let i = 1; i < rows.length; i++) {
      const km = rows[i].odometerKm - rows[i - 1].odometerKm;
      if (km < MIN_SEGMENT_KM) continue;
      if (sane((rows[i].kwh / km) * 1000)) { wallKwh += rows[i].kwh; wallKm += km; n++; }
      const a = rows[i - 1], b = rows[i];
      if (batteryKwh && a.endPct != null && b.startPct != null) {
        const used = ((a.endPct - b.startPct) / 100) * batteryKwh;
        if (used > 0 && sane((used / km) * 1000)) { batKwh += used; batKm += km; nb++; }
      }
    }
    if (!n && !nb) return null;
    return {
      wallWhKm: n ? (wallKwh / wallKm) * 1000 : null,
      batteryWhKm: nb ? (batKwh / batKm) * 1000 : null,
      samples: n, samplesBattery: nb, km: Math.max(wallKm, batKm),
    };
  }

  /** Consumo que se usa para la autonomía: batería (real) > pared×η (real) > homologado. */
  function rangeConsumption(vehicle, real) {
    if (real && real.batteryWhKm) return { whKm: real.batteryWhKm, source: 'real-bateria', samples: real.samplesBattery };
    if (real && real.wallWhKm) return { whKm: real.wallWhKm * ETA_AC, source: 'real-pared', samples: real.samples };
    return { whKm: vehicle.consumptionWhKm, source: 'homologado', samples: 0 };
  }

  /* ================= Estadísticas ================= */

  const startOfMonth = (d, back = 0) => new Date(d.getFullYear(), d.getMonth() - back, 1);

  function statsBetween(charges, from, to) {
    const list = charges.filter((c) => { const t = chargeTime(c); return t >= from && t < to; });
    const sum = (arr, f) => arr.reduce((a, c) => a + f(c), 0);
    const home = list.filter((c) => c.location === 'home'), pub = list.filter((c) => c.location === 'public');
    const total = sum(list, (c) => c.cost), kwh = sum(list, (c) => c.kwh);
    const homeKwh = sum(home, (c) => c.kwh);
    const share = (k) => (homeKwh > 0 ? (sum(home, (c) => c[k + 'Kwh']) / homeKwh) * 100 : 0);

    // [MEJORA] $/km: no cuenta el costo de la primera carga con odómetro (cubre km anteriores al primer dato).
    const withOdo = list.filter((c) => c.odometerKm != null).sort((a, b) => chargeTime(a) - chargeTime(b));
    let costPerKm = null;
    if (withOdo.length >= 2) {
      const first = withOdo[0], last = withOdo[withOdo.length - 1], km = last.odometerKm - first.odometerKm;
      if (km > 0) costPerKm = sum(list.filter((c) => chargeTime(c) > chargeTime(first)), (c) => c.cost) / km;
    }
    return {
      total, count: list.length, kwh, avgPerKwh: kwh > 0 ? total / kwh : 0,
      homeKwh, publicKwh: sum(pub, (c) => c.kwh), homeCost: sum(home, (c) => c.cost), publicCost: sum(pub, (c) => c.cost),
      vallePct: share('valle'), llanoPct: share('llano'), puntaPct: share('punta'), costPerKm,
    };
  }

  /** [MEJORA] Mes en curso vs el mismo tramo del mes anterior (el repo comparaba contra el mes anterior completo). */
  function compareToPrevMonth(charges, now) {
    const ms = startOfMonth(now), pms = startOfMonth(now, 1);
    const elapsed = now - ms;
    const cur = statsBetween(charges, ms, new Date(now.getTime() + 1)).total;
    const prev = statsBetween(charges, pms, new Date(Math.min(pms.getTime() + elapsed + 1, ms.getTime()))).total;
    return { cur, prev, deltaPct: prev > 0 ? ((cur - prev) / prev) * 100 : null };
  }

  /* ================= Precios de cargadores públicos (evuruguay.com) ================= */

  /** Snapshot del CSV del 2026-11-03 (red de resguardo si no hay conexión ni caché). */
  const FALLBACK_NETWORK_ROWS = [
    { empresa: "UTE 'Rápidos' (CC)", fee: 132.9, price: 11.8 },
    { empresa: "UTE 'Rápidos' Predios Privados (CC)", fee: 199.4, price: 11.8 },
    { empresa: "UTE 'Lentos' (AC)", fee: 54.8, price: 10.4 },
    { empresa: 'Eone (22 a 18hrs)', fee: 0, price: 18.3 },
    { empresa: 'Eone (18 a 23hrs)', fee: 0, price: 23.851 },
    { empresa: 'DMC (00 a 06hrs)', fee: 0, price: 9 },
    { empresa: 'DMC (06 a 00hrs)', fee: 0, price: 19.5 },
    { empresa: 'Evergo', fee: 122, price: 19.52 },
    { empresa: 'Mobility CCS2', fee: 130, price: 12.5 },
    { empresa: 'Mobility CCS2 (18 a 22hrs)', fee: 130, price: 25.6 },
    { empresa: 'Mobility GBT (18 a 22hrs)', fee: 130, price: 30 },
    { empresa: 'Mobility GBT (00 a 7hrs)', fee: 130, price: 21.6 },
    { empresa: 'Mobility GBT', fee: 130, price: 26.4 },
    { empresa: 'DISA (18 a 22hrs)', fee: 120, price: 16 },
    { empresa: 'DISA (00 a 07hrs)', fee: 120, price: 10 },
    { empresa: 'DISA', fee: 120, price: 12 },
  ];

  const NETWORK_DEFS = [
    { key: 'UTE', re: /^UTE/i }, { key: 'eOne', re: /^Eone/i }, { key: 'DMC', re: /^DMC/i },
    { key: 'Evergo', re: /^Evergo/i }, { key: 'Mobility', re: /^Mobility/i }, { key: 'DISA', re: /^DISA/i },
  ];

  function parseCsv(text) {
    const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const [empresa, fee, price] = lines[i].trim().split(',');
      const p = parseFloat(price);
      if (!empresa || !isFinite(p)) continue;
      rows.push({ empresa: empresa.trim(), fee: isFinite(parseFloat(fee)) ? parseFloat(fee) : 0, price: p });
    }
    return rows;
  }

  /** "N a Mhrs" → [N, M]. [MEJORA] Si M <= N cruza la medianoche ("22 a 18", "06 a 00"): se normaliza. */
  function parseTimeRange(label) {
    const m = label.match(/(\d{1,2})\s*a\s*(\d{1,2})\s*hrs/i);
    if (!m) return null;
    const start = +m[1];
    let end = +m[2];
    if (!isFinite(start) || !isFinite(end)) return null;
    if (end === 0) end = 24;
    return [start, end];
  }
  const inRange = (hour, [s, e]) => (s < e ? hour >= s && hour < e : hour >= s || hour < e);

  function groupNetworkRows(rows) {
    const groups = new Map();
    for (const r of rows) {
      const def = NETWORK_DEFS.find((d) => d.re.test(r.empresa));
      if (!def) continue;
      const rest = r.empresa.replace(def.re, '').trim();
      const label = rest || 'Estándar';
      if (!groups.has(def.key)) groups.set(def.key, []);
      groups.get(def.key).push({ empresa: r.empresa, label, fee: r.fee, price: r.price, timeRange: parseTimeRange(label) });
    }
    return [...groups].map(([key, variants]) => ({ key, variants }));
  }

  /** Variante vigente a esa hora; si ninguna franja coincide, la variante sin horario. */
  function pickVariant(group, now) {
    const h = now.getHours();
    return group.variants.find((v) => v.timeRange && inRange(h, v.timeRange))
      || group.variants.find((v) => !v.timeRange) || group.variants[0] || null;
  }

  /** [MEJORA] Ranking por precio efectivo (con el cargo fijo repartido en los kWh de esta carga). */
  function rankNetworks(groups, now, kwh) {
    const out = [];
    for (const g of groups) {
      const v = pickVariant(g, now);
      if (v) out.push({ network: g.key, variant: v, effective: (v.price * kwh + v.fee) / kwh });
    }
    return out.sort((a, b) => a.effective - b.effective);
  }


  /** Datos de ejemplo coherentes (km, % de batería, horas, costos) generados con el mismo motor. */
  function makeSeed(now) {
    const B = 60, kw = chargerKw(24, 226), R = UTE_2026_RATES;
    const ute = groupNetworkRows(FALLBACK_NETWORK_ROWS).find((g) => g.key === 'UTE');
    const plan = [[58, 'home', 90, 22.5, 160], [52, 'home', 100, 23, 190], [46, 'public', 80, 13, 210], [41, 'home', 90, 22, 150],
      [35, 'home', 95, 23.5, 260], [30, 'home', 90, 21.5, 190], [24, 'home', 100, 23, 170], [19, 'public', 80, 12.5, 230],
      [13, 'home', 90, 22, 200], [8, 'home', 95, 23, 160], [4, 'home', 90, 22.5, 220], [2, 'home', 90, 23, 140]];
    let pct = 88, odo = 14230, id = 1, leg = 0;
    const cons = [0.139, 0.151, 0.143, 0.168, 0.136, 0.149, 0.158, 0.141, 0.134, 0.153, 0.146, 0.162]; // kWh/km de cada tramo (viaje, ciudad, ruta...)
    const out = [];
    for (const [ago, kind, target, hour, km] of plan) {
      odo += km;
      const startPct = Math.max(10, Math.round((pct - (km * cons[leg++ % cons.length] / B) * 100) * 10) / 10);
      const kwh = Math.round(kwhFromPct(startPct, target, B) * 100) / 100;
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
      const base = { id: id++, sample: true, odometerKm: odo, kwh, startPct, endPct: target, pricePerKwh: null, fixedFee: null, network: null, endAt: null };
      if (kind === 'home') {
        const start = new Date(day.getTime() + hour * 3600e3);
        const end = new Date(start.getTime() + minutesToDeliver(startPct, kwh, kw, B) * 60000);
        const r = computeHomeChargeCost(start, end, kwh, R, 19, { nominalKw: kw, startPct, batteryKwh: B });
        out.push({ ...base, location: 'home', startAt: start.toISOString(), endAt: end.toISOString(), cost: r.total, valleKwh: r.valleKwh, llanoKwh: r.llanoKwh, puntaKwh: r.puntaKwh });
      } else {
        const at = new Date(day.getTime() + hour * 3600e3), v = pickVariant(ute, at);
        out.push({ ...base, location: 'public', startAt: at.toISOString(), pricePerKwh: v.price, fixedFee: v.fee, network: v.empresa, cost: computePublicChargeCost(v.price, kwh, v.fee), valleKwh: 0, llanoKwh: 0, puntaKwh: 0 });
      }
      pct = target;
    }
    return out;
  }


  /* ================= Respaldos ================= */

  /** "2026-07-15 21:30:00" (SQLite, en UTC) o una fecha ISO → ISO; null si no es una fecha. */
  function toIso(s) {
    if (!s) return null;
    const t = String(s), d = new Date(/Z|[+-]\d\d:?\d\d$/.test(t) ? t : t.replace(' ', 'T') + 'Z');
    return isNaN(d) ? null : d.toISOString();
  }
  const numOrNull = (v) => (v == null || v === '' || !isFinite(Number(v)) ? null : Number(v));
  const posOrZero = (v) => (isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

  /** Una carga de cualquier respaldo → el formato de esta app, o null si le faltan datos esenciales. */
  function normalizeCharge(c) {
    if (!c || typeof c !== 'object') return null;
    const location = c.location === 'home' || c.location === 'public' ? c.location : null;
    const startAt = toIso(c.startAt) || toIso(c.createdAt); // las públicas viejas pueden no tener fecha de inicio
    const kwh = Number(c.kwh), cost = Number(c.cost);
    if (!location || !startAt || !(kwh > 0) || !isFinite(cost) || cost < 0) return null;
    return {
      location, startAt, endAt: toIso(c.endAt) || (location === 'home' ? startAt : null), kwh,
      odometerKm: numOrNull(c.odometerKm), pricePerKwh: numOrNull(c.pricePerKwh), fixedFee: numOrNull(c.fixedFee),
      network: c.network ? String(c.network) : null, cost,
      valleKwh: posOrZero(c.valleKwh), llanoKwh: posOrZero(c.llanoKwh), puntaKwh: posOrZero(c.puntaKwh),
      startPct: numOrNull(c.startPct), endPct: numOrNull(c.endPct),
    };
  }

  /**
   * Lee un respaldo de la app vieja (carga-ev, versión 1) o de esta, y se queda solo con lo que sirve:
   * cargas, vehículo, tarifas, franja Punta y cargador. No trae tema, colores, notificaciones, ubicación ni borradores.
   */
  function parseBackup(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.charges)) throw new Error('El archivo no parece un respaldo de Carga.');
    const own = data.app === 'carga', s = own ? data : data.settings || {};
    const charges = []; let skipped = 0;
    for (const c of data.charges) { const n = normalizeCharge(c); if (n) charges.push(n); else skipped++; }
    charges.sort((a, b) => a.startAt.localeCompare(b.startAt));
    const v = data.vehicle, vehicle = v && Number(v.batteryKwh) > 0 && Number(v.consumptionWhKm) > 0
      ? { name: String(v.name || 'Mi auto'), batteryKwh: Number(v.batteryKwh), consumptionWhKm: Number(v.consumptionWhKm) } : null;
    const r = own ? data.rates : { valle: s.tariffValle, llano: s.tariffLlano, punta: s.tariffPunta };
    const rates = r && [r.valle, r.llano, r.punta].every((x) => Number(x) > 0) ? { valle: Number(r.valle), llano: Number(r.llano), punta: Number(r.punta) } : null;
    const ps = Number(own ? data.puntaStart : s.puntaStartHour), amps = Number(own ? data.amps : s.homeChargerAmps), volts = Number(own ? data.volts : s.homeChargerVolts);
    return {
      kind: own ? 'carga' : 'carga-ev', exportedAt: toIso(data.exportedAt), charges, skipped, vehicle, rates,
      puntaStart: PUNTA_START_OPTIONS.includes(ps) ? ps : null, charger: amps > 0 && volts > 0 ? { amps, volts } : null,
      chips: own && data.chips && typeof data.chips === 'object' ? data.chips : null,
      bg: own && data.bg && typeof data.bg === 'object' ? data.bg : null,
      ignored: own ? [] : ['tema y colores', 'personalización visual', 'notificaciones', 'ubicación de casa', 'carga en curso y borradores'],
    };
  }

  const chargeKey = (c) => `${Math.round(Date.parse(c.startAt) / 60000)}|${Number(c.kwh).toFixed(2)}|${c.location}`;

  /**
   * Suma cargas importadas a las existentes sin duplicar (misma hora, kWh y lugar) o las reemplaza.
   * Los datos de ejemplo (`sample: true`) siempre se quitan: al importar datos reales ya no hacen falta.
   */
  function mergeCharges(existing, incoming, mode) {
    const samples = existing.filter((c) => c.sample).length;
    const out = mode === 'replace' ? [] : existing.filter((c) => !c.sample);
    const seen = new Set(out.map(chargeKey));
    let id = Math.max(Date.now(), ...existing.map((c) => c.id + 1)), added = 0, duplicates = 0;
    for (const c of incoming) {
      const k = chargeKey(c);
      if (seen.has(k)) { duplicates++; continue; }
      seen.add(k); out.push({ ...c, id: id++ }); added++;
    }
    return { charges: out, added, duplicates, removedSamples: samples };
  }

  return {
    makeSeed, parseBackup, mergeCharges, normalizeCharge, UTE_2026_RATES, DEFAULT_PUNTA_START, PUNTA_START_OPTIONS, FIXED_HOLIDAYS, ETA_AC,
    classifyHour, isHoliday, chargerKw, taperFactor, estimateAtTime, minutesToDeliver, computeCalibration,
    computeHomeChargeCost, computePublicChargeCost, kwhFromPct, valleSavings, suggestStart,
    whKmToKwh100, autonomyKm, rangeAtPct, realConsumption, rangeConsumption,
    statsBetween, compareToPrevMonth, startOfMonth,
    FALLBACK_NETWORK_ROWS, parseCsv, parseTimeRange, groupNetworkRows, pickVariant, rankNetworks,
  };
});
