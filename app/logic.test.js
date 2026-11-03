// Tests de la lógica: node app/logic.test.js
const assert = require('node:assert/strict');
const L = require('./logic.js');

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const R = L.UTE_2026_RATES;
let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

// 2026-11-02 es lunes; 2026-11-07 sábado; 2026-08-25 martes (feriado).
test('franjas: valle, punta hábil, llano, fin de semana y feriado', () => {
  assert.equal(L.classifyHour(new Date(2026, 10, 2, 3), 19), 'valle');
  assert.equal(L.classifyHour(new Date(2026, 10, 2, 20), 19), 'punta');
  assert.equal(L.classifyHour(new Date(2026, 10, 2, 23), 19), 'llano'); // la punta 19–23 termina a las 23
  assert.equal(L.classifyHour(new Date(2026, 10, 7, 20), 19), 'llano'); // sábado
  assert.equal(L.classifyHour(new Date(2026, 7, 25, 20), 19), 'llano'); // feriado entre semana
  assert.equal(L.classifyHour(new Date(2026, 10, 7, 3), 19), 'valle'); // valle también el fin de semana
});

test('costo en ventana pareja (comportamiento original)', () => {
  const b = L.computeHomeChargeCost(new Date(2026, 10, 2, 23), new Date(2026, 10, 3, 3), 20, R, 19);
  close(b.llanoKwh, 5); close(b.valleKwh, 15); close(b.puntaKwh, 0);
  close(b.total, 5 * R.llano + 15 * R.valle);
});

test('[mejora] la carga corta no se reparte sobre el tiempo enchufado sin consumo', () => {
  // 10 kWh a 5 kW tardan 2 h: 23:00–01:00, aunque la ventana enchufada sea de 4 h
  const b = L.computeHomeChargeCost(new Date(2026, 10, 2, 23), new Date(2026, 10, 3, 3), 10, R, 19, { nominalKw: 5 });
  close(b.llanoKwh, 5); close(b.valleKwh, 5);
  close(b.total, 5 * R.llano + 5 * R.valle);
  assert.equal(b.activeMinutes, 120);
});

test('[mejora] ventana más corta de lo necesario: se reparte en la ventana', () => {
  const b = L.computeHomeChargeCost(new Date(2026, 10, 3, 1), new Date(2026, 10, 3, 2), 20, R, 19, { nominalKw: 5 });
  close(b.valleKwh, 20); close(b.total, 20 * R.valle);
});

test('rangos horarios que cruzan la medianoche (06 a 00, 22 a 18)', () => {
  assert.deepEqual(L.parseTimeRange('(06 a 00hrs)'), [6, 24]);
  const groups = L.groupNetworkRows(L.FALLBACK_NETWORK_ROWS);
  const dmc = groups.find((g) => g.key === 'DMC'), eone = groups.find((g) => g.key === 'eOne');
  const at = (h) => new Date(2026, 10, 2, h, 30);
  assert.equal(L.pickVariant(dmc, at(3)).price, 9);
  assert.equal(L.pickVariant(dmc, at(10)).price, 19.5);
  assert.equal(L.pickVariant(dmc, at(23)).price, 19.5);
  assert.equal(L.pickVariant(eone, at(12)).price, 18.3);
  assert.equal(L.pickVariant(eone, at(20)).price, 23.851);
  assert.equal(L.pickVariant(eone, at(23)).price, 18.3);
});

test('ranking de redes con cargo fijo repartido', () => {
  const rank = L.rankNetworks(L.groupNetworkRows(L.FALLBACK_NETWORK_ROWS), new Date(2026, 10, 2, 12), 30);
  assert.ok(rank[0].effective <= rank[rank.length - 1].effective);
  const ute = rank.find((r) => r.network === 'UTE');
  close(ute.effective, (ute.variant.price * 30 + ute.variant.fee) / 30);
});

test('kWh por % de batería', () => {
  close(L.kwhFromPct(20, 80, 60), 36);
  assert.equal(L.kwhFromPct(80, 20, 60), null);
  assert.equal(L.kwhFromPct(0, 101, 60), null);
});

test('estimación: la cola CV hace más lento el final', () => {
  const kw = L.chargerKw(24, 226); close(kw, 4.99008);
  const a = L.estimateAtTime(20, new Date(2026, 10, 2, 22), new Date(2026, 10, 3, 2), kw, 60);
  const b = L.estimateAtTime(80, new Date(2026, 10, 2, 22), new Date(2026, 10, 3, 2), kw, 60);
  assert.ok(a.kwhDelivered > b.kwhDelivered);
  assert.ok(b.pct <= 100);
  const m = L.minutesToDeliver(20, 36, kw, 60);
  assert.ok(m > 36 / (kw / 60) - 1); // al menos el tiempo a potencia plena
});

test('cargar hasta 100% con kWh redondeados no devuelve null', () => {
  const kw = L.chargerKw(24, 226);
  const kwh = Math.round(L.kwhFromPct(45.3, 100, 60) * 10) / 10; // redondeo hacia arriba posible
  const m = L.minutesToDeliver(45.3, kwh, kw, 60);
  assert.ok(Number.isFinite(m) && m > 0);
});

test('[mejora] cuándo empezar: termina a las 07:00 casi todo en Valle', () => {
  const kw = L.chargerKw(24, 226);
  const s = L.suggestStart({ fromPct: 20, toPct: 80, deadline: new Date(2026, 10, 3, 7), nominalKw: kw, batteryKwh: 60, calibration: 1, rates: R, puntaStart: 19, altStart: new Date(2026, 10, 2, 19) });
  close(s.kwh, 36);
  assert.ok(s.valleShare > 0.9);
  assert.ok(s.alt.total > s.best.total); // empezar a las 19 sale más caro
});

test('consumo real: ponderado por km y descarta tramos cortos', () => {
  const t = (d) => new Date(2026, 9, d).toISOString();
  const charges = [
    { startAt: t(1), odometerKm: 1000, kwh: 30, endPct: 90, startPct: 30 },
    { startAt: t(5), odometerKm: 1200, kwh: 28, endPct: 90, startPct: 33 },   // 200 km → 140 Wh/km (pared)
    { startAt: t(6), odometerKm: 1205, kwh: 9, endPct: 90, startPct: 80 },    // 5 km: se descarta
    { startAt: t(9), odometerKm: 1405, kwh: 30, endPct: 90, startPct: 28 },   // 200 km → 150 Wh/km
  ];
  const r = L.realConsumption(charges, 60);
  close(r.wallWhKm, ((28 + 30) / 400) * 1000);
  assert.equal(r.samples, 2);
  // lado batería: (90−33)% y (90−28)% de 60 kWh en 200 km c/u
  close(r.batteryWhKm, (((57 + 62) / 100) * 60) / 400 * 1000);
  assert.equal(L.rangeConsumption({ consumptionWhKm: 135 }, r).source, 'real-bateria');
  assert.equal(L.rangeConsumption({ consumptionWhKm: 135 }, null).source, 'homologado');
});

test('autonomía a distintos %', () => {
  assert.equal(L.autonomyKm(60, 135), 444);
  assert.equal(L.rangeAtPct(60, 135, 80), 356);
});

test('estadísticas: $/km sin contar la primera carga con odómetro y porcentajes', () => {
  const mk = (d, loc, kwh, cost, o, v = 0, l = 0, p = 0) => ({ startAt: new Date(2026, 9, d, 12).toISOString(), location: loc, kwh, cost, odometerKm: o, valleKwh: v, llanoKwh: l, puntaKwh: p });
  const charges = [mk(2, 'home', 20, 100, 1000, 20), mk(10, 'public', 30, 400, 1200), mk(20, 'home', 10, 50, 1300, 5, 5)];
  const s = L.statsBetween(charges, new Date(2026, 9, 1), new Date(2026, 10, 1));
  close(s.total, 550); close(s.costPerKm, (400 + 50) / 300);
  close(s.vallePct, (25 / 30) * 100); close(s.llanoPct, (5 / 30) * 100);
  close(s.avgPerKwh, 550 / 60);
});

test('comparación con el mismo tramo del mes anterior', () => {
  const mk = (m, d, cost) => ({ startAt: new Date(2026, m, d, 12).toISOString(), location: 'home', kwh: 10, cost });
  const charges = [mk(9, 2, 100), mk(9, 25, 900), mk(10, 2, 150)];
  const c = L.compareToPrevMonth(charges, new Date(2026, 10, 3, 9));
  close(c.cur, 150); close(c.prev, 100); close(c.deltaPct, 50);
});

test('datos de ejemplo: cargas coherentes con odómetro y % crecientes', () => {
  const s = L.makeSeed(new Date(2026, 10, 3, 12));
  assert.equal(s.length, 12);
  assert.ok(s.every((c) => c.cost > 0 && c.kwh > 0));
  const odo = s.map((c) => c.odometerKm);
  assert.deepEqual(odo, [...odo].sort((a, b) => a - b));
  assert.ok(s.filter((c) => c.location === 'home').every((c) => new Date(c.endAt) > new Date(c.startAt)));
  const r = L.realConsumption(s, 60);
  assert.ok(r.batteryWhKm > 120 && r.batteryWhKm < 170);
});

const OLD = () => ({
  version: 1, exportedAt: '2026-10-30T12:00:00Z',
  vehicle: { name: 'Mi BYD', batteryKwh: 60.5, consumptionWhKm: 150, extra: 'x' },
  settings: { tariffValle: 2.4, tariffLlano: 5.1, tariffPunta: 12, puntaStartHour: 18, homeChargerAmps: 16, homeChargerVolts: 230, theme: 'rojo', notifications: true, homeLat: -34.9 },
  charges: [
    { location: 'home', startAt: '2026-10-02T01:00:00Z', endAt: '2026-10-02T05:00:00Z', kwh: 20.5, cost: 50, valleKwh: 20.5, odometerKm: 1000, startPct: 30, endPct: 64, uiColor: 'x' },
    { location: 'public', startAt: null, createdAt: '2026-10-10 15:30:00', kwh: 30, cost: 400, network: 'UTE', pricePerKwh: 12, fixedFee: 40 },
    { location: 'home', startAt: '2026-10-02T01:00:00.000Z', kwh: 20.5, cost: 50 },
    { location: 'moto', startAt: '2026-10-03T01:00:00Z', kwh: 5, cost: 10 },
    { location: 'home', startAt: '2026-10-04T01:00:00Z', kwh: 0, cost: 10 },
    { location: 'home', kwh: 5, cost: 10 },
  ],
  activeCharge: { x: 1 }, drafts: {},
});

test('respaldo viejo: se queda solo con lo útil y descarta lo inválido', () => {
  const b = L.parseBackup(OLD());
  assert.equal(b.kind, 'carga-ev');
  assert.equal(b.charges.length, 3); // la repetida cuenta acá; se saca recién al unir
  assert.equal(b.skipped, 3);
  assert.equal(b.charges[2].startAt, '2026-10-10T15:30:00.000Z'); // fecha SQLite en UTC
  assert.equal(b.charges[0].endAt, '2026-10-02T05:00:00.000Z');
  assert.ok(!('uiColor' in b.charges[0]));
  assert.deepEqual(b.vehicle, { name: 'Mi BYD', batteryKwh: 60.5, consumptionWhKm: 150 });
  assert.deepEqual(b.rates, { valle: 2.4, llano: 5.1, punta: 12 });
  assert.equal(b.puntaStart, 18);
  assert.deepEqual(b.charger, { amps: 16, volts: 230 });
  assert.ok(b.ignored.includes('notificaciones'));
  assert.equal(b.chips, null);
});

test('respaldo: archivo que no es un respaldo da error claro', () => {
  assert.throws(() => L.parseBackup({ foo: 1 }), /no parece un respaldo/);
  assert.throws(() => L.parseBackup(null), /no parece un respaldo/);
});

test('unir cargas: sin duplicados, quita los ejemplos y asigna ids nuevos', () => {
  const inc = L.parseBackup(OLD()).charges;
  const existing = [{ id: 5, sample: true, startAt: '2026-09-01T10:00:00Z', location: 'home', kwh: 10, cost: 30 },
                    { id: 6, startAt: '2026-10-02T01:00:00.000Z', location: 'home', kwh: 20.5, cost: 50 }];
  const m = L.mergeCharges(existing, inc, 'merge');
  assert.equal(m.removedSamples, 1);
  assert.equal(m.duplicates, 2); // la ya existente y la repetida dentro del archivo
  assert.equal(m.added, 1);
  assert.equal(m.charges.length, 2);
  assert.equal(new Set(m.charges.map((c) => c.id)).size, 2);
  const r = L.mergeCharges(existing, inc, 'replace');
  assert.equal(r.charges.length, 2); assert.equal(r.duplicates, 1);
});

test('respaldo propio: sale y vuelve con vehículo, tarifas y fichas', () => {
  const own = { app: 'carga', exportedAt: '2026-11-01T00:00:00Z', vehicle: { name: 'A', batteryKwh: 50, consumptionWhKm: 140 },
    rates: { valle: 2, llano: 5, punta: 12 }, puntaStart: 19, amps: 10, volts: 220, chips: { cargar: { color: '#ff0000' } },
    charges: [{ location: 'home', startAt: '2026-10-02T01:00:00Z', endAt: '2026-10-02T03:00:00Z', kwh: 8, cost: 20 }] };
  const b = L.parseBackup(own);
  assert.equal(b.kind, 'carga'); assert.equal(b.ignored.length, 0);
  assert.equal(b.puntaStart, 19); assert.deepEqual(b.charger, { amps: 10, volts: 220 });
  assert.deepEqual(b.chips, own.chips); assert.equal(b.charges.length, 1);
});

console.log(`\n${n} tests OK`);
