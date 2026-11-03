---
name: feedback-no-copy-repo-design
description: "Del repo francofuy/carga-ev solo se toma la lógica, nada de su diseño"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6204ba5a-3303-4c5a-8b8b-5fcc2700c151
  modified: 2026-11-03T03:29:57.887Z
---

El usuario tiene una app funcional en github.com/francofuy/carga-ev (PWA/Capacitor, Uruguay, UTE triple horaria). Pidió tomar SOLO la lógica de cálculo (cargas, autonomía, tarifas UY, precios de cargadores) y nada de su diseño.

**Why:** no le convenció el diseño anterior (sobrecargado); busca algo mucho más simple, con fichas-función en bandeja inferior.
**How to apply:** reutilizar la lógica (ya portada a `app/logic.js`); no copiar colores, componentes ni pantallas del repo. El diseño parte de `DESIGN.md` y de la referencia de la bandeja de fichas.

Relacionado: [[feedback-decimal-precision]]
