/* =====================================================================
   CANVAS NÍTIDO Y COLORES
   Un canvas tiene dos tamaños: el CSS (lo que se ve) y el interno (píxeles
   reales). En pantallas de alta resolución (devicePixelRatio = 2 o 3)
   se multiplica el tamaño interno para que no se vea borroso.
   ===================================================================== */
'use strict';

function ajustarCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const W = Math.round(w * dpr), H = Math.round(h * dpr);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);   // desde aquí se dibuja en píxeles CSS
  return { ctx, w, h };
}

// Los canvas leen los colores de las variables CSS (css/variables.css),
// así respetan el modo oscuro. Se guardan en caché hasta que cambie el tema.
// versionColores sube con cada cambio de tema: sirve para saber cuándo
// hay que volver a pintar imágenes guardadas (p. ej. los mapas de terreno).
let cacheColores = null;
let versionColores = 0;
function colores() {
  if (!cacheColores) {
    const cs = getComputedStyle(document.documentElement);
    const leer = (n) => cs.getPropertyValue('--' + n).trim();
    cacheColores = {};
    ['canvas-bg', 'grid', 'grid-fuerte', 'text', 'muted', 'border', 'tractor', 'tractor-borde',
     'remolque', 'remolque-borde', 'rueda', 'barra', 'huella-t', 'huella-r',
     'ruta-directa', 'ruta-energia', 'ok', 'warn', 'bad', 'surface',
     'suelo-pavimento', 'suelo-compacto', 'suelo-pasto', 'suelo-tierra', 'suelo-arena']
      .forEach((n) => { cacheColores[n] = leer(n); });
  }
  return cacheColores;
}
const invalidarColores = () => { cacheColores = null; versionColores++; };

// Convierte "#rrggbb" en [r, g, b] (para pintar píxel a píxel)
function rgbDeHex(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
