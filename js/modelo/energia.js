/* =====================================================================
   EVALUACIÓN ENERGÉTICA DE UNA RUTA
   El tractor sigue la ruta exactamente; el remolque obedece a la cinemática.
   No usa el DOM (se puede probar con Node).
   Depende de: config/parametros.js, utils/matematica.js
   ===================================================================== */
'use strict';

// Remuestrea una polilínea [{x,y}, ...] cada "paso" metros
function remuestrear(puntos, paso = 0.25) {
  const acum = [0];
  for (let i = 1; i < puntos.length; i++) {
    acum.push(acum[i - 1] + Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y));
  }
  const total = acum[acum.length - 1];
  const n = Math.floor(total / paso + 1e-9);
  const res = [];
  let j = 0;
  for (let k = 0; k <= n; k++) {
    const s = k * paso;
    while (j < puntos.length - 2 && acum[j + 1] < s) j++;
    const tramo = acum[j + 1] - acum[j];
    const f = tramo > 0 ? (s - acum[j]) / tramo : 0;
    res.push({ x: puntos[j].x + f * (puntos[j + 1].x - puntos[j].x),
               y: puntos[j].y + f * (puntos[j + 1].y - puntos[j].y), s });
  }
  // Último punto exacto si el largo no es múltiplo del paso
  if (total - n * paso > 1e-6) {
    const u = puntos[puntos.length - 1];
    res.push({ x: u.x, y: u.y, s: total });
  }
  return res;
}

/* Evalúa una ruta.
   terreno = { h(x,y) altura [m], crr(x,y) coeficiente de rodadura }
   p = { mT, mR, L1, eta, etaR, g }                                       */
function evaluarRuta(puntos, terreno, p) {
  const m = remuestrear(puntos, 0.25);
  const n = m.length;

  // Orientación del tractor = tangente de la ruta (diferencia centrada)
  const th0 = m.map((q, i) => {
    const a = m[Math.max(i - 1, 0)], b = m[Math.min(i + 1, n - 1)];
    return Math.atan2(b.y - a.y, b.x - a.x);
  });

  // Pendiente bajo un punto en la dirección "ang": diferencia centrada con base de 1 m
  const pendiente = (x, y, ang) => {
    const ux = 0.5 * Math.cos(ang), uy = 0.5 * Math.sin(ang);
    return Math.atan((terreno.h(x + ux, y + uy) - terreno.h(x - ux, y - uy)) / 1);
  };

  const r = { s: [], x0: [], y0: [], th0: [], x1: [], y1: [], th1: [], h: [], E: [], beta: [] };
  let th1 = th0[0];            // el remolque parte alineado con el tractor
  let E = 0, subida = 0, pendMax = 0, latMax = 0, betaMax = 0;

  for (let i = 0; i < n; i++) {
    const x0 = m[i].x, y0 = m[i].y;
    const ds = i > 0 ? m[i].s - m[i - 1].s : 0;

    // Cinemática del remolque por tramo: θ1 += (ds/L1)·sin(θ0 − θ1)
    if (i > 0) th1 += (ds / p.L1) * Math.sin(th0[i] - th1);
    const x1 = x0 - p.L1 * Math.cos(th1), y1 = y0 - p.L1 * Math.sin(th1);

    // Pendientes de avance bajo cada cuerpo y pendiente lateral del tractor
    const a0 = pendiente(x0, y0, th0[i]);
    const a1 = pendiente(x1, y1, th1);
    const aLat = pendiente(x0, y0, th0[i] + Math.PI / 2);
    const h0 = terreno.h(x0, y0);

    if (i > 0) {
      // Fuerza de tracción necesaria (gravedad + rodadura) de ambos cuerpos
      const F = p.mT * p.g * (Math.sin(a0) + terreno.crr(x0, y0) * Math.cos(a0))
              + p.mR * p.g * (Math.sin(a1) + terreno.crr(x1, y1) * Math.cos(a1));
      // Energía: se paga F/η al subir; al bajar se recupera solo la fracción η_r
      E += F >= 0 ? F * ds / p.eta : p.etaR * F * ds;
      const dh = h0 - r.h[i - 1];
      if (dh > 0) subida += dh;
    }

    const beta = normalizarAngulo(th0[i] - th1);
    pendMax = Math.max(pendMax, Math.abs(a0));
    latMax = Math.max(latMax, Math.abs(aLat));
    betaMax = Math.max(betaMax, Math.abs(beta));

    r.s.push(m[i].s); r.x0.push(x0); r.y0.push(y0); r.th0.push(th0[i]);
    r.x1.push(x1); r.y1.push(y1); r.th1.push(th1);
    r.h.push(h0); r.E.push(E / 3600); r.beta.push(beta);
  }

  r.distancia = m[n - 1].s;
  r.energiaWh = E / 3600;          // J → Wh
  r.subida = subida;
  r.pendMaxAvance = pendMax;       // [rad]
  r.pendMaxLateral = latMax;       // [rad]
  r.betaMax = betaMax;             // [rad]
  return r;
}

// Caso de verificación obligatorio: terreno plano, suelo compacto, 100 m → 9,367 Wh
function calcularAutoverificacion() {
  const plano = { h: () => 0, crr: () => SUELOS.compacto.crr };
  const r = evaluarRuta([{ x: 0, y: 0 }, { x: 100, y: 0 }], plano, PARAMS);
  const analitico = (PARAMS.mT + PARAMS.mR) * PARAMS.g * SUELOS.compacto.crr * 100 / PARAMS.eta / 3600;
  return { energiaWh: r.energiaWh, analitico, ok: Math.abs(r.energiaWh - 9.367) < 0.0005 };
}
