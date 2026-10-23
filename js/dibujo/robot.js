/* =====================================================================
   DIBUJO DEL ROBOT (vista superior, en coordenadas del mundo [m])
   r = { x0, y0, th0, th1, phi, L0, L1 }; esc = píxeles por metro
   Cada cuerpo se dibuja en su propio marco: trasladar a su eje y rotar θ.
   ===================================================================== */
'use strict';

function dibujarRobot(ctx, r, esc, C) {
  const x1 = r.x0 - r.L1 * Math.cos(r.th1), y1 = r.y0 - r.L1 * Math.sin(r.th1);
  const lw = 1.5 / esc;   // grosor de línea de 1,5 px aunque estemos en metros

  // --- Remolque (marco local: origen en su eje, x apuntando al enganche)
  const frente = Math.max(0.3, r.L1 - 0.85);   // la caja termina antes del enganche
  ctx.save(); ctx.translate(x1, y1); ctx.rotate(r.th1);
  ctx.fillStyle = C.rueda;
  ctx.fillRect(-0.3, 0.69, 0.6, 0.22); ctx.fillRect(-0.3, -0.91, 0.6, 0.22);
  ctx.fillStyle = C.remolque; ctx.strokeStyle = C['remolque-borde']; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.rect(-0.75, -0.7, frente + 0.75, 1.4); ctx.fill(); ctx.stroke();
  ctx.restore();

  // --- Barra de tiro: del frente del remolque al enganche (eje trasero del tractor)
  ctx.strokeStyle = C.barra; ctx.lineWidth = 3 / esc;
  ctx.beginPath();
  ctx.moveTo(x1 + frente * Math.cos(r.th1), y1 + frente * Math.sin(r.th1));
  ctx.lineTo(r.x0, r.y0); ctx.stroke();

  // --- Tractor (marco local: origen en el eje trasero, x hacia adelante)
  ctx.save(); ctx.translate(r.x0, r.y0); ctx.rotate(r.th0);
  ctx.fillStyle = C.rueda;
  ctx.fillRect(-0.3, 0.55, 0.6, 0.22); ctx.fillRect(-0.3, -0.77, 0.6, 0.22);   // ruedas traseras
  [0.66, -0.66].forEach((yy) => {                                                // ruedas delanteras giradas φ
    ctx.save(); ctx.translate(r.L0, yy); ctx.rotate(r.phi);
    ctx.fillRect(-0.28, -0.11, 0.56, 0.22); ctx.restore();
  });
  ctx.fillStyle = C.tractor; ctx.strokeStyle = C['tractor-borde']; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.rect(-0.45, -0.5, r.L0 + 0.9, 1.0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';                                      // "cabina" (marca el frente)
  ctx.fillRect(r.L0 - 0.35, -0.38, 0.6, 0.76);
  ctx.restore();

  // --- Punto de enganche
  ctx.fillStyle = C.barra;
  ctx.beginPath(); ctx.arc(r.x0, r.y0, 0.13, 0, 2 * Math.PI); ctx.fill();
}
