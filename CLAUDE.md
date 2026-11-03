# Carga — app de registro de cargas de auto eléctrico

Web app para iPhone 17 Pro a pantalla completa. Prototipo actual: `app/carga.html` (un solo archivo, sin build) + `app/logic.js` (lógica pura, con tests: `node app/logic.test.js`).
Pantallas anteriores (`app/prototipo-inicial.html`, `app/fichas.html`) quedan solo como referencia.
Historial: solo el **Calendario** (elegido de una exploración de tres en `app/historial-lab.html`, que queda como referencia con el Libro mayor y la Ruta por odómetro).

## Al diseñar o cambiar UI
Aplicar siempre estas skills (instaladas en `.claude/skills/`):
- `taste-skill` — sobre todo `references/app-screens.md` (es una app de pantallas, no una landing). Chequeos: `node .claude/skills/taste-skill/scripts/lint.mjs --app app/carga.html`.
- `emil-design-eng` (+ `mobile-native`, `animate`, `apple-design`) — detalle, movimiento y sensación nativa.
- `impeccable` — `reference/ios.md`, `craft-floor.md`, `distill.md`. Detector: `sh .claude/skills/impeccable/scripts/impeccable detect --json app/carga.html`.

La dirección visual y sus reglas están en `DESIGN.md`. Leerlo antes de tocar la UI. La lógica de cargas y sus mejoras están en `app/LOGICA.md`.

## Patrón de interacción
- **Inicio:** bandeja de fichas-función; cada ficha abre una función.
- **Cargar datos:** asistentes de una pregunta por pantalla (Registrar y Programar comparten un mismo motor, `createWizard`). Cada pregunta usa el dial: número grande, círculo central, ajuste fino −1 / −0,1 / +0,1 / +1 y regla. Los datos opcionales tienen «Omitir».
- **Borrador:** cada asistente se guarda solo al responder algo (clave `carga.v3.borrador`, vence a las 48 h). Si se cierra la app, Inicio muestra «Borrador sin guardar» con Continuar / Eliminar y se retoma en el mismo paso. «Atrás» desde el primer paso, guardar o programar lo descartan; cerrar sin querer lo conserva. El formulario de confirmar una carga terminada también se conserva (`S.active.cf`).
- Valores con decimales reales: kWh hasta 2, % hasta 1 (ver `app/LOGICA.md`).

## Reglas
- Menos es más: antes de agregar un elemento, preguntarse si se puede esconder o borrar.
- Textos en español rioplatense, formato `$ 31.179` y `22,4 kWh`.
- Del repo `francofuy/carga-ev` solo se toma la lógica, nunca su diseño.
- Los datos de ejemplo se generan en `makeSeed` (`app/logic.js`) y llevan `sample: true`; al importar un respaldo se quitan solos.
- Respaldos e importación: `parseBackup` / `mergeCharges` en `app/logic.js`; solo se traen los datos que la app usa. Ver «Respaldos» en `app/LOGICA.md`.
- Las fichas del inicio son personalizables (`S.chips`, `chipSvg`); ver `DESIGN.md`.
