/* =====================================================================
   MAPA DEL TERRENO (vista superior)
   Pinta el terreno píxel a píxel en un canvas fuera de pantalla:
     1. color según el tipo de suelo,
     2. sombreado del relieve (luz desde el noroeste),
     3. curvas de nivel cada "intervalo" metros (más marcadas cada 5).
   El resultado se guarda y solo se vuelve a pintar si cambia el terreno,
   el tamaño o el tema; en cada cuadro solo se copia (drawImage).
   Depende de: utils/canvas.js, config/parametros.js
   ===================================================================== */
'use strict';

/* terreno: { h, suelo }; lim: { xmin, xmax, ymin, ymax } [m]
   pxPorM: píxeles reales por metro; C: colores()                         */
function renderizarTerreno(terreno, lim, pxPorM, C, intervalo = 1) {
  const W = Math.max(1, Math.round((lim.xmax - lim.xmin) * pxPorM));
  const H = Math.max(1, Math.round((lim.ymax - lim.ymin) * pxPorM));
  const paso = 1 / pxPorM;   // metros por píxel

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  // Colores de cada suelo en [r, g, b]
  const paleta = {};
  Object.keys(SUELOS).forEach((k) => { paleta[k] = rgbDeHex(C['suelo-' + k]); });

  // 1) Altura y suelo de cada píxel (la fila 0 es el borde norte: y = ymax)
  const alt = new Float32Array(W * H);
  const sue = new Array(W * H);
  for (let py = 0; py < H; py++) {
    const y = lim.ymax - (py + 0.5) * paso;
    for (let px = 0; px < W; px++) {
      const x = lim.xmin + (px + 0.5) * paso;
      const i = py * W + px;
      alt[i] = terreno.h(x, y);
      sue[i] = terreno.suelo(x, y);
    }
  }

  // 2) Color, sombreado y curvas de nivel
  const luz = [-0.5, 0.5, Math.SQRT1_2];   // vector unitario: desde el noroeste, 45° de altura
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const iDer = px < W - 1 ? i + 1 : i, iIzq = px > 0 ? i - 1 : i;
      const iArr = py > 0 ? i - W : i,     iAba = py < H - 1 ? i + W : i;

      // Gradiente del terreno (dh/dx, dh/dy) con diferencias entre píxeles vecinos
      const hx = (alt[iDer] - alt[iIzq]) / (((iDer - iIzq) || 1) * paso);
      const hy = (alt[iArr] - alt[iAba]) / ((((iAba - iArr) / W) || 1) * paso);

      // Sombreado: producto punto entre la normal del suelo y la luz (1 = plano)
      const n = 1 / Math.sqrt(hx * hx + hy * hy + 1);
      const brillo = (-hx * luz[0] - hy * luz[1] + luz[2]) * n / luz[2];
      let f = Math.min(1.25, Math.max(0.55, brillo));

      // Curva de nivel: el píxel cambia de "piso" respecto del vecino derecho o inferior
      const nivel = Math.floor(alt[i] / intervalo);
      const nDer = Math.floor(alt[iDer] / intervalo), nAba = Math.floor(alt[iAba] / intervalo);
      if (nivel !== nDer || nivel !== nAba) {
        const mayor = Math.max(nivel, nDer, nAba);
        f *= mayor % 5 === 0 ? 0.45 : 0.62;
      }

      const c = paleta[sue[i]];
      d[4 * i]     = Math.min(255, c[0] * f);
      d[4 * i + 1] = Math.min(255, c[1] * f);
      d[4 * i + 2] = Math.min(255, c[2] * f);
      d[4 * i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/* Calcula dónde cabe un mapa de límites "lim" dentro de un canvas de w × h px,
   centrado y con margen. Devuelve k (px por metro) y el origen en pantalla.  */
function encajarMapa(lim, w, h, margen = 8) {
  const anchoM = lim.xmax - lim.xmin, altoM = lim.ymax - lim.ymin;
  const k = Math.max(0.1, Math.min((w - 2 * margen) / anchoM, (h - 2 * margen) / altoM));
  const ox = (w - anchoM * k) / 2, oy = (h - altoM * k) / 2;
  return {
    k, ox, oy, ancho: anchoM * k, alto: altoM * k,
    // Conversión mundo ↔ pantalla (y del mundo hacia arriba)
    aPantalla: (x, y) => ({ x: ox + (x - lim.xmin) * k, y: oy + (lim.ymax - y) * k }),
    aMundo: (sx, sy) => ({ x: lim.xmin + (sx - ox) / k, y: lim.ymax - (sy - oy) / k })
  };
}

// Aplica al contexto la transformación mundo → pantalla de una vista de encajarMapa
function transformarAMundo(ctx, vista, lim) {
  ctx.translate(vista.ox - lim.xmin * vista.k, vista.oy + lim.ymax * vista.k);
  ctx.scale(vista.k, -vista.k);
}

/* Huella del eje del remolque de una ruta evaluada (r = resultado de evaluarRuta),
   en línea punteada. Se dibuja en coordenadas del mundo; k = px por metro.  */
function dibujarHuellaRemolque(ctx, r, color, k) {
  ctx.strokeStyle = color; ctx.lineWidth = 2.5 / k;
  ctx.setLineDash([2 / k, 3 / k]);
  ctx.beginPath(); ctx.moveTo(r.x1[0], r.y1[0]);
  for (let i = 1; i < r.x1.length; i++) ctx.lineTo(r.x1[i], r.y1[i]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* Postura del robot en el punto de la ruta evaluada más cercano a la distancia s.
   r = resultado de evaluarRuta. φ se estima de la curvatura: φ = atan(L0·dθ0/ds). */
function poseEnRuta(r, s, L0, L1) {
  const n = r.s.length;
  const i = Math.max(0, Math.min(n - 1, Math.round(s / 0.25)));
  const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
  const curv = b > a ? normalizarAngulo(r.th0[b] - r.th0[a]) / (r.s[b] - r.s[a]) : 0;
  const phiMax = rad(PARAMS.phiMaxDeg);
  return {
    x0: r.x0[i], y0: r.y0[i], th0: r.th0[i], th1: r.th1[i],
    phi: Math.max(-phiMax, Math.min(phiMax, Math.atan(L0 * curv))),
    L0, L1, s: r.s[i], E: r.E[i], beta: r.beta[i], i
  };
}
