# Retomar el proyecto en otra PC

Estado al 3 nov 2026: la app **Carga** funciona completa en el navegador (probada en la vista previa de escritorio, **no** en un iPhone real). Esto es todo lo que hace falta para seguir exactamente desde acá.

## 1. Pasos para retomar

```powershell
git clone <URL de este repo> "NUEVA APP AUTO"
cd "NUEVA APP AUTO"
powershell -ExecutionPolicy Bypass -File .handoff/restore.ps1   # memoria de Claude + conversación
node app/logic.test.js                                           # 19 tests deben pasar
node scripts/serve.mjs                                           # http://localhost:5173/app/carga.html
claude --resume                                                  # elegir la sesión «NUEVA APP AUTO» para seguir la charla
```

- Hace falta Node 20+ y Claude Code. No hay build ni dependencias.
- En Claude Code Desktop, `.claude/launch.json` ya trae el servidor «carga» (puerto 5173).
- Para ver el prototipo en el iPhone: misma red wifi y `http://<IP de la PC>:5173/app/carga.html`.

## 2. Qué hay en el repo

| Ruta | Qué es |
|---|---|
| `app/carga.html` | La app (un solo archivo, sin build). |
| `app/logic.js` | Lógica pura (tarifas UTE, costos, estimador, consumo, redes públicas, respaldos). |
| `app/logic.test.js` | 19 tests: `node app/logic.test.js`. |
| `app/LOGICA.md` | Qué se portó de `carga-ev`, qué se mejoró, cobertura, respaldos, fichas. |
| `app/historial-lab.html` | Exploración de 3 vistas de historial (queda como referencia; se eligió el Calendario). |
| `app/index.html`, `app/fichas.html` | Prototipos anteriores, solo referencia. |
| `CLAUDE.md`, `DESIGN.md`, `PRODUCT.md` | Reglas del proyecto, dirección visual, producto. Leer `DESIGN.md` antes de tocar la UI. |
| `.claude/skills/` | Las skills instaladas: taste-skill, emil-design-eng, impeccable, animate, apple-design, mobile-native, animation-performance, animation-vocabulary. |
| `.claude/launch.json`, `scripts/serve.mjs` | Servidor local. |
| `.impeccable/`, `.taste-skill/` | Salidas y direcciones de diseño generadas por las skills (mocks, preguntas, capturas de inspección). |
| `.handoff/memory/` | Memoria de Claude (preferencias del usuario). |
| `.handoff/session/*.jsonl` | Transcripción completa de la conversación (17 MB). |
| `.handoff/scratchpad-backups/` | Versiones intermedias de `carga.html` y los borradores de los asistentes/historial. Son historia: no hacen falta para correr la app. |
| `.handoff/restore.ps1` | Copia memoria y conversación a la carpeta de Claude de la PC nueva. |

No se incluyó `_skills_src/` (109 MB, tres clones con su propio `.git`); las skills ya están copiadas en `.claude/skills/`. Si se quiere volver a tener las fuentes:

```bash
git clone https://github.com/emilkowalski/skills.git _skills_src/emilkowalski-skills   # f1090be
git clone https://github.com/pbakaus/impeccable.git _skills_src/impeccable             # 9fadc41
git clone https://github.com/Leonxlnx/taste-skill.git _skills_src/taste-skill          # 12af471
```

Otras fuentes consultadas (no incluidas): `francofuy/carga-ev` (app vieja, commit 105a39a; **solo la lógica**) y `nextlevelbuilder/ui-ux-pro-max-skill` v2.15.0.

## 3. Qué tiene la app

Inicio con bandeja de 7 fichas: **Registrar carga**, **Programar carga**, **Historial** (calendario), **Gasto**, **Autonomía**, **Precios y tarifas**, **Ajustes**.

- Registrar y Programar: asistentes de una pregunta por pantalla con dial (número grande, círculo central, ajuste fino −1/−0,1/+0,1/+1, regla deslizable, teclado). Odómetro opcional con regla que arranca en el último valor.
- Borrador automático si se cierra la app; carga en curso (en espera / cargando / a confirmar).
- Decimales reales: kWh hasta 2, % hasta 1.
- Ajustes: importar respaldo (de `carga-ev` v1 o de esta app, solo datos útiles, suma sin duplicar o reemplaza, quita los datos de ejemplo), exportar respaldo (`carga-respaldo-AAAA-MM-DD.json`, hoja de compartir en iPhone), taller de fichas estilo póker (color, borde, tono, anillo, trazo; «usar en todas»; restablecer), quitar datos de ejemplo, borrar todo.
- Estado en `localStorage`: `carga.v3` (datos), `carga.v3.redes` (precios de redes), `carga.v3.borrador`.

## 4. Chequeos que se corrieron cada ronda

```bash
node app/logic.test.js
node .claude/skills/taste-skill/scripts/lint.mjs --app app/carga.html          # último: 0 FAIL, 16 WARN
node .claude/skills/taste-skill/scripts/inspect.mjs --app http://localhost:5173/app/carga.html   # 0 FAIL, 3 WARN (esperables en escritorio)
sh .claude/skills/impeccable/scripts/impeccable detect --json app/carga.html   # []
```

El launcher de Impeccable descarga un binario: no ejecutarlo sin avisar al usuario. El script de UI-UX Pro Max se bloqueó por permisos y no se ejecutó; solo se leyeron sus datos.

## 5. Pendiente

1. **Probar con un respaldo real de la app vieja** (solo se probó con uno armado a mano a partir del formato del repo). Si falta algún dato, ajustar `normalizeCharge` / `parseBackup` en `app/logic.js`.
2. Probar todo en un **iPhone real** (hoja de compartir, teclado decimal, safe areas, gestos de la regla).
3. Editar una carga existente (falta; en `carga-ev` sí estaba).
4. Nombre del vehículo editable (hoy solo batería y consumo).
5. Nombre definitivo de la app (hoy «Carga» es provisorio) y ícono / PWA instalable.
6. Por verificar (ver `app/LOGICA.md`): si los precios del pliego UTE incluyen IVA, criterio de feriados móviles.
7. Imposible en web (necesita app nativa): notificaciones de inicio/fin, Live Activity, aviso «llegaste a casa».

## 6. Reglas que el usuario pidió expresamente

- **NADA del diseño de `carga-ev`**: solo su lógica.
- Decimales en kWh (≤2) y % (≤1), siempre con ajuste fino y teclado.
- Aplicar siempre Taste Skill, Emil Kowalski e Impeccable al cambiar la UI; que no parezca hecho con IA.
- Textos en español rioplatense, formato `$ 31.179` y `22,4 kWh`.
- Menos es más: antes de agregar un elemento, ver si se puede esconder o borrar.
