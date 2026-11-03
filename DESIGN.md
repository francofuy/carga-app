# Carga — dirección de diseño

App web (PWA a pantalla completa) para iPhone 17 Pro (402 × 874 pt) que registra las cargas de un auto eléctrico.
Referencia de *tipo* de experiencia: una pantalla, una pregunta, una acción grande. Nada más.

## Principios
- **Una pregunta por pantalla.** Inicio: "¿cuánto gasté?". Registrar: "¿cuánto cargué?". Lo más grande de la pantalla responde esa pregunta.
- **Una acción primaria**, siempre un círculo verde en la hoja inferior. Todo lo demás se esconde (historial = arrastrar la hoja hacia arriba; kWh exactos = tocar el número).
- **Color solo en la acción y el dato principal.** Un único verde (`--accent`). Fondo negro, hoja `#141414`, sin bordes ni sombras: la elevación es por tono.
- **Números como tipografía, no como tarjetas.** Sin KPIs en tiles, sin íconos en círculos de color, sin sparklines, sin gradientes.
- **Sin eyebrow/kicker sobre los títulos, sin tarjetas anidadas.**
- **Un hallazgo por pantalla**, escrito en una línea y calculado desde los datos (nunca tipeado a mano).

- **Fichas de la bandeja:** la separación se mide entre **bordes** (16 px fijos), no entre centros. Con tamaños distintos, centros parejos dejan espacios desiguales. La ficha activa queda siempre exactamente bajo la flecha.

- **Fichas personalizables:** son SVG planos (cuerpo, marcas del borde, anillo, ícono), sin degradés ni brillos. Todo lo que cambia de color usa `--k` (0 = al costado y gris, 1 = al centro y en color). Los 8 colores son fijos, no un selector libre: así nunca queda una ficha ilegible. La ficha central de los asistentes toma el color de su ficha (`--go`).
- **Listas de Ajustes:** filas con título y una línea de apoyo, separadas por una línea fina; sin tarjetas.

## Reglas de iOS / mobile
- `viewport-fit=cover`, `env(safe-area-inset-*)`, `100dvh`, `overscroll-behavior: none`, `-webkit-tap-highlight-color: transparent`.
- Targets ≥ 44 pt. Inputs ≥ 16 px (si no, iOS hace zoom). `touch-action: manipulation`. Nunca `user-scalable=no`.
- Hover solo bajo `(hover: hover)`; en táctil el feedback es `:active`.
- Modo oscuro como único modo por ahora.

## Movimiento (Emil Kowalski)
- Feedback de press: `scale(0.96–0.97)`, 140 ms, ease-out.
- Hoja: curva tipo iOS `cubic-bezier(0.32, 0.72, 0, 1)`, 420 ms, arrastre con velocidad (flick) y snap.
- Entradas: ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, < 360 ms. Nunca `ease-in`, nunca `scale(0)`, nunca `transition: all`.
- Lo que se hace muchas veces (cambiar el chip de kWh) no se anima; lo ocasional (guardar) sí: el total cuenta hasta el valor nuevo en 600 ms.
- `prefers-reduced-motion` respetado.

## Pendiente de decidir
- Nombre real de la app (hoy "Carga" es provisorio).
- Precio por kWh editable (hoy fijo: casa $95, pública $310 — datos de ejemplo).
- Campos extra (odómetro, % de batería, estación). Hoy: fecha, casa/pública, kWh, costo.
- Gráfico de consumo / costo por km: solo si responde una pregunta real.
