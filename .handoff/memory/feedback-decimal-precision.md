---
name: feedback-decimal-precision
description: "Los valores de carga (kWh, % de batería) deben admitir decimales reales; nunca solo números redondos"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6204ba5a-3303-4c5a-8b8b-5fcc2700c151
  modified: 2026-11-03T03:29:54.710Z
---

El usuario señaló que las fichas de 5 en 5 kWh eran "muy redondas": un cargador real muestra hasta 2 decimales (23,47 kWh) y el % de batería puede ser decimal (47,3).

**Why:** registrar cargas reales exige la precisión que muestran el cargador y el auto; redondear distorsiona costo y consumo.
**How to apply:** kWh hasta 2 decimales, % hasta 1. Combinar regla deslizable + botones de ajuste fino (±0,1 / ±1, con mantener para repetir) + teclado decimal al tocar el número. Aplica a todo campo numérico nuevo (ver `app/carga.html`, `app/LOGICA.md`).
