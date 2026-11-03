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
- **Texturas de ficha:** 10 trazos planos (rayas, cuadrícula, puntos, ondas, rombos, escamas, rayos, círculos, granulado), recortados al cuerpo y tenues; usan `--ce` y `--k` como el resto. Las generan las funciones de `CHIP_TEXTURES`, que sirven también para el fondo.
- **Fondo (Ajustes > Fondo):** un tinte plano (14 % del color de la ficha activa, de un color fijo o ninguno) y una textura al 6 %. Sin degradados, brillos ni desenfoque. El tinte pasa de una ficha a otra al ritmo del carril; la textura se desplaza hasta 80 px (parallax) y las pantallas que se abren encima heredan tinte y posición (`--bgk`, `--tx`, `--tex` en `.phone`). Tres ondas (anillos de 1,5 px, opacidad máx. 0,26) salen de la ficha activa: 9 s por ciclo, 5 s con una carga en curso. Solo `transform` y `opacity`; se pausan con otra pantalla encima y se apagan con «Quieto» o `prefers-reduced-motion`.
- **Material translúcido tintado** (por decisión del dueño; reemplaza «hoja `#141414` y contenedores `#1c1c1e`»): `--glass` (bandeja, hoja del dial, panel del día; con `blur(14px)`), `--glass-in` (opciones, campos, nudges, selector, avisos) y `--glass-hi` (opción elegida). Son el tinte del fondo (`--bgk`) sobre un gris casi negro con transparencia, y siguen al color de la ficha cuadro a cuadro. Legibilidad medida en el peor caso (textura al 6 % + una onda detrás, con los 8 colores): blanco ≥ 9,0:1; `--ink-2` (`#a3a3aa`) ≥ 4,7:1 sobre cualquier superficie; el gris nunca va sobre `--glass-hi` (ahí el texto es blanco). Si se agrega un color o se baja la opacidad, volver a medir.
- **Selectores (`.seg`) con globo de cristal:** la opción elegida la marca un globo translúcido (`.thumb`, lo mueve `segSync`) que se agranda al apretarlo y se puede arrastrar hasta otra opción; al soltar elige la que quedó debajo. Al redibujar un selector el globo sale de su posición anterior y se desliza.
- **Carril de fichas:** sin `scroll-snap-stop` (con `always` frenaba en seco al soltar el dedo): el empuje sigue y frena en una ficha. Con mouse, la suelta también tiene inercia. Lo mismo la regla del dial: con mouse sigue y frena sola (~330 ms) y con el dedo no se acomoda en el valor mientras esté apoyado ni a mitad de un empujón (`held`, `snap`).
- **Logo:** una ficha verde con rayo sobre fondo oscuro y tres ondas, las mismas del inicio (`icons/icon.svg`; PNG de 180, 192 y 512 para iOS y el manifest, renderizados con Chrome headless). `app/manifest.webmanifest` hace la app instalable.
- **Alto:** `.app` es `position: fixed`, no `100dvh`; `--bgk`/`--bgt` viven en `:root`. **Medidas de un iPhone 17 Pro:** pantalla 402 × 874 pt, con 59 arriba (isla dinámica) y 34 abajo (= 93). En la app instalada la bandeja mide 296 y llega a los 874 de la pantalla, pero lo que se ve (app, fondo, bandeja) termina a los ~781, y arriba el contenido queda bajo la isla, donde iOS lo difumina. No se puede dibujar más abajo (se comprobó con las capturas: la caja de la bandeja baja hasta los 875 y el relleno se corta a los ~775). Solución (`fitLower`): en la app instalada (`navigator.standalone` **o** `display-mode: standalone`: iOS 26 ya no siempre marca la primera) y en vertical, primero se MIDE cuánto del borde de abajo no se dibuja (una sonda fija + `IntersectionObserver`; si el sistema no lo informa, se usan los márgenes seguros `env()` de arriba + abajo, que no dependen de un modelo), y `.app` ocupa solo la zona que sí se dibuja: `top: --lower` (= el recorte medido, o env top + env bottom; 93 en un iPhone 17 Pro) y `bottom: --lower-b` (93, o menos si la ventana ya descuenta). Arriba queda vacío; adentro los márgenes seguros valen 0 (`--env-on: 0`). La franja de abajo la pinta iOS con el color de fondo (plano, sin imagen: con una imagen de fondo en el `body` iOS deja de tomarlo) de `html`/`body`: con bandeja (inicio y asistentes, `html.floor`) es `--floor`, el de la bandeja de vidrio ya compuesta; la franja de arriba es un elemento fijo (`.topband`) con el color del fondo. Las fichas del inicio se centran sobre bandeja + franja (`fitTray` → `--tray-shift`; la franja es `screen.height − borde de abajo de la app`, sea que iOS descuente el espacio en la ventana o en la app; sin pasar del borde de la app). El diagnóstico (`report`) se abre con `#debug` en la dirección o manteniendo apretada la línea de arriba del inicio (~1 s). Si en Safari (no instalada) se ve una barra inferior, es la de Safari: hay que agregarla a la pantalla de inicio «como app web».
- **Extremos:** el carril y la regla usan `overscroll-behavior-x: none` (sin rebote elástico) y, con mouse, no hay inercia si ya están en una esquina.
- **Listas de Ajustes:** filas con título y una línea de apoyo, separadas por una línea fina; sin tarjetas.

## Reglas de iOS / mobile
- `viewport-fit=cover`, `env(safe-area-inset-*)`, `100dvh`, `overscroll-behavior: none`, `-webkit-tap-highlight-color: transparent`.
- Targets ≥ 44 pt. Inputs ≥ 16 px (si no, iOS hace zoom). Sin zoom por gestos, por decisión del dueño de la app (decisión de producto, a costa de accesibilidad): `maximum-scale=1, user-scalable=no`, `touch-action: pan-x pan-y` en todos los elementos (los contenedores con scroll cortan la herencia) y, aparte, `gesturestart/change/end`, `touchmove` con dos dedos y Ctrl + rueda se frenan en JS, porque iOS ignora `user-scalable=no`.
- **Se adapta a cualquier pantalla (sin medidas de un modelo):** `.app` ocupa toda la ventana, sin tope de ancho; las pantallas de contenido usan una columna cómoda (`--col`, 640 pt) centrada y la bandeja del inicio llena el ancho. Alturas y tipografía son relativas (`.head` y `.big` también limitadas por `vh`); `--tray-h` (262) define la bandeja y en pantallas bajas (`max-height: 520px`, celular acostado) la del inicio se achica a 190 (`--tray-hh`) y no muestra la pista. El contenido de los asistentes (`.center`) se centra si sobra lugar y se desliza si falta: nunca se corta. Los botones −1 / −0,1 / +0,1 / +1 del dial se escalan con `--nf` (= `min(1, (ancho − 16) / 374)`) para entrar desde ~360 pt de ancho. La textura del fondo se dibuja del tamaño de la ventana y crece si la ventana crece (`bgFit`). Comprobado a 360×640, 375×667, 402×874, 430×932, 820×1180, 1440×900 y 874×402 (acostado): sin desborde y sin elementos fuera de la pantalla.
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
