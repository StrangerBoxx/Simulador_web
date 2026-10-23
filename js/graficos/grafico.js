/* =====================================================================
   GRÁFICOS DE LÍNEAS (mini-librería propia, sin dependencias)
   dibujarGrafico(canvas, opciones):
     series: [{ x:[], y:[], color, ancho, punteada, nombre }]
     xmin, xmax, ymin, ymax (si faltan se calculan)
     etiquetaX, etiquetaY, guias: [{ y, color, texto }], guiasX: [{ x, color }]
   Depende de: utils/canvas.js, utils/matematica.js
   ===================================================================== */
'use strict';

// Paso "bonito" para las marcas de los ejes (1, 2 o 5 × potencia de 10)
function pasoBonito(rango, nMarcas) {
  const crudo = rango / nMarcas;
  const mag = Math.pow(10, Math.floor(Math.log10(crudo)));
  const f = crudo / mag;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
}

function dibujarGrafico(canvas, op) {
  const { ctx, w, h } = ajustarCanvas(canvas);
  const C = colores();
  ctx.clearRect(0, 0, w, h);

  // Rango de los datos
  let xmin = op.xmin, xmax = op.xmax, ymin = op.ymin, ymax = op.ymax;
  const todosX = [], todosY = [];
  op.series.forEach((s) => { todosX.push(...s.x); todosY.push(...s.y); });
  if (xmin === undefined) xmin = todosX.length ? Math.min(...todosX) : 0;
  if (xmax === undefined) xmax = todosX.length ? Math.max(...todosX) : 1;
  if (ymin === undefined) ymin = todosY.length ? Math.min(...todosY) : 0;
  if (ymax === undefined) {   // máximo de los datos + 5 % de margen para que la curva no toque el borde
    ymax = todosY.length ? Math.max(...todosY) : 1;
    ymax += 0.05 * (ymax - ymin);
  }
  if (xmax - xmin < 1e-9) xmax = xmin + 1;
  if (ymax - ymin < 1e-9) { ymax += 0.5; ymin -= 0.5; }

  // Márgenes del área de trazado
  const m = { l: 52, r: 12, t: 10, b: op.etiquetaX ? 34 : 22 };
  const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const X = (x) => m.l + (x - xmin) / (xmax - xmin) * pw;
  const Y = (y) => m.t + (1 - (y - ymin) / (ymax - ymin)) * ph;

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.lineWidth = 1;

  // Cuadrícula y marcas del eje Y
  const py = pasoBonito(ymax - ymin, Math.max(2, Math.floor(ph / 40)));
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = Math.ceil(ymin / py) * py; v <= ymax + 1e-9; v += py) {
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(m.l, Y(v)); ctx.lineTo(m.l + pw, Y(v)); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillText(fmt(v, py < 1 ? 1 : 0), m.l - 6, Y(v));
  }
  // Cuadrícula y marcas del eje X
  const px = pasoBonito(xmax - xmin, Math.max(2, Math.floor(pw / 80)));
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let v = Math.ceil(xmin / px) * px; v <= xmax + 1e-9; v += px) {
    ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(X(v), m.t); ctx.lineTo(X(v), m.t + ph); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.fillText(fmt(v, px < 1 ? 1 : 0), X(v), m.t + ph + 4);
  }
  // Marco
  ctx.strokeStyle = C['grid-fuerte']; ctx.strokeRect(m.l, m.t, pw, ph);

  // Etiquetas de los ejes
  ctx.fillStyle = C.muted;
  if (op.etiquetaX) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(op.etiquetaX, m.l + pw, h - 2); }
  if (op.etiquetaY) {
    ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(op.etiquetaY, 0, 0); ctx.restore();
  }

  // Todo lo que sigue queda recortado al área de trazado
  ctx.save();
  ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();

  // Líneas guía horizontales (p. ej. ±β_max)
  (op.guias || []).forEach((g) => {
    ctx.strokeStyle = g.color; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.l, Y(g.y)); ctx.lineTo(m.l + pw, Y(g.y)); ctx.stroke();
    ctx.setLineDash([]);
    if (g.texto) {
      ctx.fillStyle = g.color; ctx.textAlign = 'left'; ctx.textBaseline = g.y >= 0 ? 'top' : 'bottom';
      ctx.fillText(g.texto, m.l + 4, Y(g.y) + (g.y >= 0 ? 3 : -3));
    }
  });

  // Líneas guía verticales (p. ej. posición actual de la animación)
  (op.guiasX || []).forEach((g) => {
    ctx.strokeStyle = g.color; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(g.x), m.t); ctx.lineTo(X(g.x), m.t + ph); ctx.stroke();
    ctx.setLineDash([]);
  });

  // Series
  op.series.forEach((s) => {
    if (s.x.length < 2) return;
    ctx.strokeStyle = s.color; ctx.lineWidth = s.ancho || 2;
    ctx.setLineDash(s.punteada ? [6, 4] : []);
    ctx.beginPath();
    for (let i = 0; i < s.x.length; i++) {
      const xx = X(s.x[i]), yy = Y(s.y[i]);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.restore();

  // Leyenda (arriba a la izquierda, con fondo) si las series tienen nombre
  const conNombre = op.series.filter((s) => s.nombre);
  if (conNombre.length) {
    const anchoTxt = Math.max(...conNombre.map((s) => ctx.measureText(s.nombre).width));
    ctx.fillStyle = C.surface; ctx.globalAlpha = 0.85;
    ctx.fillRect(m.l + 4, m.t + 3, anchoTxt + 36, conNombre.length * 15 + 6);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    conNombre.forEach((s, i) => {
      const yy = m.t + 6 + i * 15;
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.setLineDash(s.punteada ? [4, 3] : []);
      ctx.beginPath(); ctx.moveTo(m.l + 10, yy + 6); ctx.lineTo(m.l + 26, yy + 6); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = C.text; ctx.fillText(s.nombre, m.l + 32, yy);
    });
  }
}
