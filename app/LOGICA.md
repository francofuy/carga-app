# Lógica de cargas

Código en `app/logic.js` (sin interfaz; 19 tests en `app/logic.test.js`: `node app/logic.test.js`).
Portado de `francofuy/carga-ev` (solo la lógica, nada del diseño) y ampliado.

## Qué se portó igual
- **Tarifa UTE Residencial Triple Horaria 2026**: Valle $2,443 · Llano $5,172 · Punta $12,034 por kWh (verificado contra el decreto MIEM 113/2026). Valle 00–07 todos los días; Punta 4 h elegidas entre 17 y 23, solo días hábiles; Llano el resto. Editable.
- **Costo de carga en Casa**: se clasifica minuto a minuto y cada carga guarda su costo al registrarla (editar tarifas no reescribe el historial).
- **Costo de carga pública**: precio × kWh + cargo fijo.
- **kWh por % de batería**: batería × (hasta − desde) / 100.
- **Estimador**: potencia = V × A × 0,92; a partir de 80% la carga baja de ritmo (cola CV); factor de calibración con las cargas pasadas en Casa.
- **Precios públicos** desde `evuruguay.com/cargadores_all.csv` (en vivo → guardado → resguardo). Fuente no oficial.
- **Consumo real** de carga a carga con odómetro; autonomía = batería / consumo.
- Estadísticas: gasto, $/kWh, % Valle/Llano/Punta, $/km, tendencia de 6 meses.

## Qué se mejoró (marcado `[MEJORA]` en el código)
1. **Franjas horarias que cruzan la medianoche.** El CSV actual trae `DMC (06 a 00hrs)` y `Eone (22 a 18hrs)`; el código original nunca las reconocía como vigentes. Ahora sí.
2. **Feriados.** Los feriados fijos (1/1, 1/5, 18/7, 25/8, 25/12) cuentan como fin de semana, sin Punta. Los móviles (Carnaval, Semana de Turismo) no están.
3. **Carga que termina antes de desenchufar.** Con la potencia del cargador, la energía se asigna solo a las horas en que realmente se cargó, no a todo el tiempo enchufado.
4. **Cuándo empezar.** Dado desde %, hasta % y hora de salida, calcula a qué hora empezar para que casi todo caiga en Valle, y cuánto cuesta frente a empezar a otra hora.
5. **Consumo real ponderado por km** (ΣkWh / Σkm) en vez de promediar cocientes por tramo; se descartan tramos de menos de 10 km. Con % de batería también se mide del lado de la batería, que es el dato correcto para la autonomía.
6. **Autonomía a cualquier nivel de batería** (20–100%) y al terminar una carga por %.
7. **$/km** sin contar la primera carga con odómetro (cubre kilómetros anteriores al primer dato).
8. **Comparación de gasto** contra un tramo de igual largo (30 días vs 30 anteriores; mes vs mismo tramo del mes anterior), no contra el mes anterior completo.
9. **Precio efectivo** de cada red (cargo fijo repartido entre los kWh) y ranking de redes por franja horaria vigente.
10. **Ahorro posible**: cuánto menos se hubiera gastado cargando todo en Valle.

## Programar carga y carga en curso (portado del repo)
- **Programar** (ficha «Programar carga») es un **asistente de una pregunta por pantalla**, con el mismo dial de Registrar (número grande, círculo central, ajuste fino y regla): 1) batería al enchufar (decimales), 2) hora de corte, 3) objetivo % *(opcional, «Omitir»)*, 4) *Ahora* o *Más tarde* con la hora de inicio, 5) odómetro *(opcional)*, 6) resumen y «Programar». Las horas se mueven con −1 h / −15 / +15 / +1 h, con la regla (marcas cada 5 min) o escribiéndolas (`630` → 06:30).
- Estimado en vivo: `%` y kWh al corte, costo y reparto Valle/Llano/Punta. Un horario sin fecha se resuelve como en el repo: inicio = próxima vez que el reloj lo marca; corte = primera vez posterior al inicio.
- [MEJORA] **Objetivo %**: dice a qué hora empezar para llegar a ese % cortando a la hora indicada, casi todo en Valle, y cuánto se ahorra frente a empezar ahora.
- **Carga en curso** (aviso tocable en Inicio): *en espera* (cuenta regresiva, «Empezar ahora», cambiar horarios, cancelar), *cargando* (≈ % y kWh hasta ahora, costo hasta ahora, «Terminar ahora») y *a confirmar* (% final real, kWh reales que se recalculan del %, odómetro opcional). La carga se guarda recién al confirmar.

## Registrar carga (asistente)
Una pregunta por pantalla, con el mismo dial que Programar: **¿Dónde cargaste?** (Casa / Pública) → **¿Cómo querés cargar el dato?** (por kWh o por % de batería) → los datos (kWh; o batería al empezar y al terminar) → *(Pública)* red, franja o conector, precio por kWh y cargo fijo → **¿Cuándo cargaste?** («Recién terminé» estima el horario con la potencia del cargador, o «Elegir el horario» con Hoy/Ayer, hora de fin y de inicio) → odómetro *(opcional)* → resumen con costo, franjas y autonomía → **Guardar**. El camino más corto en Casa son 5 pantallas.

## Borrador de formularios (portado del repo, ampliado)
El repo original guardaba un borrador solo para cargas nuevas. Acá lo tienen los dos asistentes (Registrar y Programar) y el formulario de confirmar una carga terminada: se guarda en cada cambio, se retoma en el mismo paso con los mismos valores y se descarta solo al guardar, programar o salir a propósito.

## Cobertura del repo original
| Función del repo | Acá |
|---|---|
| Tarifa UTE triple horaria, costo en Casa y Pública, kWh por % | Sí |
| Estimador de carga (V×A×η, cola CV, calibración) | Sí |
| Precios de cargadores públicos (en vivo → caché → resguardo) | Sí, con franjas que cruzan la medianoche |
| Consumo real con odómetro, autonomía, $/km, estadísticas | Sí, mejorado |
| Programar carga: Ahora / Más tarde, corta a las, carga activa | Sí |
| Confirmar carga con % y kWh reales | Sí |
| Historial con filtro Casa/Pública y eliminar | Sí |
| Editar una carga existente | **Falta** |
| Borrador de carga sin guardar | Sí (asistentes y confirmación) |
| Exportar / importar backup, borrar todos los datos | Sí, en Ajustes (ver «Respaldos») |
| Nombre del vehículo | **Falta** (solo batería y consumo) |
| Notificaciones de inicio y fin, Live Activity / Dynamic Island, aviso «llegaste a Casa» | **No posible en web**: requieren la app nativa (Capacitor + Swift) |

## Entrada de valores con decimales
El cargador muestra la energía con hasta 2 decimales y el % de batería puede ser decimal, así que ningún valor se redondea a números "lindos":
- **kWh**: hasta 2 decimales (`23,47`). **% de batería**: hasta 1 decimal (`47,3`).
- Se cargan combinando tres herramientas, según la tarea: **regla deslizable** (marcas cada 0,1, para barrer rápido), **botones −1 / −0,1 / +0,1 / +1** (ajuste fino; mantenidos, repiten y aceleran de a poco) y **tocar el número** (teclado decimal, valor exacto).
- Los steppers solos no sirven para decimales ni rangos grandes (guía de Maersk); sí sirven para ajustes cortos (NN/g). Por eso se combinan.
- El valor inicial sale del historial: los kWh de la última carga y el % de inicio promedio.
- También en "Cuándo empezar" (desde/hasta con −1 / −0,1 / +0,1 / +1, editables a mano: `36,3`) y en Autonomía (cualquier %).

## Odómetro por carga (opcional)
- Cada carga puede llevar su odómetro: en Registrar (Detalles) y en Cuándo empezar.
- Con el odómetro de esta carga y la anterior se mide el tramo: `(fin % anterior − inicio % actual) × batería / km`. Ese tramo entra al consumo real y la autonomía se recalcula antes de guardar.
- Valida que el odómetro sea mayor al de la última carga; tramos de menos de 10 km no suman.
- Se carga con el mismo dial: la **regla arranca en el último odómetro** y avanza hasta 1.500 km (marcas cada km, números cada 50 km redondos), con ajuste fino −10 / −1 / +1 / +10 y teclado para escribirlo. Sin odómetro previo no hay desde dónde medir y queda solo el ajuste fino.
- "Registrar con estos datos" lleva % de inicio, % final y odómetro de Cuándo empezar a Registrar.

## Respaldos (Ajustes)
- **Importar** (`parseBackup` + `mergeCharges` en `logic.js`, 4 tests): lee un respaldo de `carga-ev` (v1) o de esta app y **se queda solo con lo que sirve**: cargas, vehículo, tarifas UTE, franja Punta y cargador. No trae tema, colores, notificaciones, ubicación de casa ni carga en curso o borradores; la pantalla lo dice antes de importar.
- Cada carga se normaliza: necesita lugar (casa/pública), fecha (si falta `startAt` usa `createdAt`, que en SQLite viene en UTC), kWh > 0 y costo ≥ 0. Las que no cumplen se dejan y se cuentan («2 cargas se dejan…»). Los campos que no se usan no se copian.
- **Sumar o reemplazar.** Sumar no duplica: misma hora (al minuto), mismos kWh y mismo lugar cuenta como repetida. Los **datos de ejemplo** se quitan siempre al importar.
- **Exportar**: archivo `carga-respaldo-AAAA-MM-DD.json` (`app: 'carga'`) con cargas propias (sin ejemplos ni ids), auto, tarifas, franja, cargador y diseño de fichas. En iPhone se comparte (Guardar en Archivos, AirDrop); sin esa opción se descarga. Se guarda la fecha del último respaldo.
- **Borrar todos los datos** deja la app vacía con los valores iniciales y conserva el diseño de las fichas.
- Limitación: se probó con un respaldo armado a mano a partir del formato del repo, no con uno real.

## Fichas personalizables
Cada círculo del inicio es una ficha de póker dibujada en SVG plano: color (8), borde (marcas, puntos, rayas o liso), tono del borde (claro/oscuro), anillo interior (sí/no) y trazo del ícono (fino/normal/grueso). Se guarda en `S.chips`, viaja en el respaldo y se sanea al importar (`cleanChip`). El círculo central de Registrar y Programar toma el color de su ficha. «Usar este diseño en todas» copia una ficha al resto.

## Por verificar
- ¿Los precios del pliego UTE incluyen IVA? Los de los cargadores públicos probablemente sí. Si no coinciden, la comparación casa/pública queda sesgada a favor de casa.
- Criterio exacto de UTE para feriados (y si los móviles cuentan).
- Los kWh en modo % son del lado de la batería; los de un cargador público o del medidor pueden ser mayores por las pérdidas de carga.
